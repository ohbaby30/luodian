import { analysisResultSchema, type AnalysisResult, type Profile } from "./contracts";
import { type TurnRecord, type SettingsRecord } from "./repository";
import { ZodError } from "zod";

export class ProviderError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "ProviderError";
  }
}

const MAX_OUTPUT_TOKENS = 4096;

export function completionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl.trim());
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`;
  return url.toString();
}

function isTokenPlanBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.startsWith("token-plan-") && hostname.endsWith(".xiaomimimo.com");
  } catch {
    return false;
  }
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ProviderError("AI 没有返回可解析的结构化结果。", 502);
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new ProviderError("AI 返回了无效 JSON，无法继续收口。", 502);
  }
}

function responseText(payload: unknown): string {
  const value = payload as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
  const content = value.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => item.text ?? "").join("");
  throw new ProviderError("AI 响应中没有文本内容。", 502);
}

function structuredError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("；");
  }
  if (error instanceof Error && error.message) return error.message;
  return "结构化响应校验失败。";
}

async function requestProvider(settings: SettingsRecord, messages: Array<{ role: "system" | "user"; content: string }>): Promise<string> {
  if (!settings.providerBaseUrl || !settings.providerModel || !settings.providerApiKey) {
    throw new ProviderError("还没有完成 AI 接口设置。", 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const tokenPlan = isTokenPlanBaseUrl(settings.providerBaseUrl);
    const body: Record<string, unknown> = {
      model: settings.providerModel,
      messages,
    };
    if (tokenPlan) body.max_completion_tokens = MAX_OUTPUT_TOKENS;
    else {
      body.temperature = 0.2;
      body.max_tokens = MAX_OUTPUT_TOKENS;
    }
    if (settings.providerBaseUrl.toLowerCase().includes("longcat") || settings.providerModel.toLowerCase().includes("longcat")) {
      body.thinking = { type: "disabled" };
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tokenPlan) headers["api-key"] = settings.providerApiKey;
    else headers.Authorization = `Bearer ${settings.providerApiKey}`;

    const response = await fetch(completionsUrl(settings.providerBaseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof payload === "object" && payload && "error" in payload ? JSON.stringify(payload.error) : response.statusText;
      throw new ProviderError(`AI 接口返回 ${response.status}：${detail}`, response.status);
    }
    return responseText(payload);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProviderError("AI 请求超时，请稍后重试。", 504);
    throw new ProviderError(`AI 接口不可用：${error instanceof Error ? error.message : "未知错误"}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function structuredRequest<T>(
  settings: SettingsRecord,
  system: string,
  user: string,
  parse: (value: unknown) => T,
): Promise<T> {
  const messages = [
    { role: "system" as const, content: `${system}\n只返回一个 JSON 对象，不要使用 Markdown 代码块。` },
    { role: "user" as const, content: user },
  ];
  const first = await requestProvider(settings, messages);
  try {
    return parse(parseJsonContent(first));
  } catch (error) {
    const detail = structuredError(error);
    const previousOutput = first.length > 8_000 ? `${first.slice(0, 8_000)}\n（原输出过长，后续内容已截断）` : first;
    const repair = await requestProvider(settings, [
      ...messages,
      { role: "user", content: `上一次输出无法通过校验。校验问题：${detail}。请只返回修正后的 JSON，不要解释。原输出：${previousOutput}` },
    ]);
    try {
      return parse(parseJsonContent(repair));
    } catch {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(`AI 返回的结构化结果不符合要求：${detail}`, 502);
    }
  }
}

function answerContext(turns: TurnRecord[]): string {
  if (turns.length === 0) return "尚未进行追问。";
  return turns.map((turn) => [
    `问题 ${turn.sequence}：${turn.question}`,
    `提问原因：${turn.reason}`,
    `用户回答：${turn.answer?.trim() || "（尚未回答）"}`,
  ].join("\n")).join("\n\n");
}

export async function analyzeIdea(input: {
  rawIdea: string;
  turns: TurnRecord[];
  profile: Profile;
  settings: SettingsRecord;
}): Promise<AnalysisResult> {
  const system = `你是“落点”，一个帮助用户把原始想法整理成高质量提示词的严谨协作者。
你的任务是忠实保留用户意图，区分已确认事实、用户假设和你的推测，不要擅自增加目标。
找出会改变方案的必要缺口；如果存在，status 必须是 needs_input，并且 question 只能有一个最重要的问题，同时给出 questionReason。
如果没有会改变结果的必要缺口，status 必须是 ready，question 和 questionReason 必须为 null。
额外创意只能放入 optionalExtensions，不得混入 facts、constraints 或 acceptanceCriteria。
输出字段必须包含：status、title、objective、audience、facts、assumptions、constraints、gaps、contradictions、risks、acceptanceCriteria、optionalExtensions、question、questionReason、confidence。`;
  const user = JSON.stringify({
    rawIdea: input.rawIdea,
    personalProfile: input.profile,
    previousQuestionsAndAnswers: answerContext(input.turns),
  }, null, 2);
  return structuredRequest(input.settings, system, user, (value) => analysisResultSchema.parse(value));
}

export async function polishPrompt(input: {
  blueprint: string;
  settings: SettingsRecord;
}): Promise<string> {
  const system = `你是提示词编辑器。把用户提供的提示词蓝图整理成一份可直接复制给目标 AI 的中文提示词。
只做澄清、排序和表达优化，不新增事实，不删除约束，不把待确认内容伪装成确定事实。
保留“待确认事项”“未知”和“验收标准”。输出 JSON：{"prompt":"..."}。`;
  const result = await structuredRequest(input.settings, system, input.blueprint, (value) => {
    const prompt = (value as { prompt?: unknown }).prompt;
    if (typeof prompt !== "string" || !prompt.trim()) throw new ProviderError("AI 没有返回最终提示词。", 502);
    return prompt.trim();
  });
  return result;
}

export async function testProvider(settings: SettingsRecord): Promise<void> {
  const content = await requestProvider(settings, [
    { role: "system", content: "只返回 JSON：{\"ok\":true}" },
    { role: "user", content: "连接测试" },
  ]);
  let value: unknown;
  try {
    value = parseJsonContent(content);
  } catch {
    throw new ProviderError("AI 接口已连通，但没有按 JSON 测试约定返回。", 502);
  }
  if (!value || typeof value !== "object" || (value as { ok?: unknown }).ok !== true) {
    throw new ProviderError("AI 接口已连通，但没有按 JSON 测试约定返回。", 502);
  }
}
