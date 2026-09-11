import { normalizeAnalysisResult, type AnalysisResult, type Profile } from "./contracts";
import { providerProfilesForSettings, type TurnRecord, type SettingsRecord } from "./repository";
import { buildProviderRequest, configuredProviderKinds, isProviderConfigured, type ProviderKind, type ProviderRequestOptions } from "./provider";
import { ZodError } from "zod";

export { completionsUrl } from "./provider";

export class ProviderError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "ProviderError";
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProviderError("AI 接口返回了空响应或非对象 JSON。", 502);
  }
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

function providerRequestSettings(settings: SettingsRecord, providerKind?: ProviderKind) {
  const profiles = providerProfilesForSettings(settings);
  const available = configuredProviderKinds(profiles);
  const selected = providerKind
    ? profiles[providerKind]
    : available.length === 1
      ? profiles[available[0]]
      : null;
  if (!selected) {
    if (available.length > 1) throw new ProviderError("请先选择要使用的 AI 接口。", 409);
    throw new ProviderError("还没有完成 AI 接口设置。", 400);
  }
  if (!isProviderConfigured(selected)) throw new ProviderError("所选 AI 接口配置不完整。", 400);
  const providerApiKey = selected.providerApiKey;
  if (!providerApiKey) throw new ProviderError("所选 AI 接口配置不完整。", 400);
  return {
    providerBaseUrl: selected.providerBaseUrl,
    providerModel: selected.providerModel,
    providerApiKey,
    providerOptions: selected.providerOptions,
  };
}

async function requestProvider(
  settings: SettingsRecord,
  messages: Array<{ role: "system" | "user"; content: string }>,
  requestOptions: ProviderRequestOptions = {},
  providerKind?: ProviderKind,
): Promise<string> {
  const provider = providerRequestSettings(settings, providerKind);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const request = buildProviderRequest(provider, messages, requestOptions);
    if (!request.body.thinking && request.body.max_tokens !== undefined) request.body.temperature = 0.2;
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    const raw = await response.text();
    let payload: unknown = null;
    let validJson = true;
    try {
      payload = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      validJson = false;
    }
    if (!response.ok) {
      const detail = typeof payload === "object" && payload && "error" in payload
        ? JSON.stringify(payload.error)
        : response.statusText || "响应不是有效 JSON";
      throw new ProviderError(`AI 接口返回 ${response.status}：${detail}`, response.status);
    }
    if (contentType.includes("text/event-stream")) {
      throw new ProviderError("AI 接口返回了流式响应，本应用需要非流式 Chat Completions。", 502);
    }
    if (!validJson || payload === null) throw new ProviderError("AI 接口返回了空响应或非 JSON 内容。", 502);
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
  providerKind?: ProviderKind,
): Promise<T> {
  const messages = [
    { role: "system" as const, content: `${system}\n只返回一个 JSON 对象，不要使用 Markdown 代码块。` },
    { role: "user" as const, content: user },
  ];
  const first = await requestProvider(settings, messages, { structured: true }, providerKind);
  try {
    return parse(parseJsonContent(first));
  } catch (error) {
    const detail = structuredError(error);
    const previousOutput = first.length > 8_000 ? `${first.slice(0, 8_000)}\n（原输出过长，后续内容已截断）` : first;
    const repair = await requestProvider(settings, [
      ...messages,
      { role: "user", content: `上一次输出无法通过校验。校验问题：${detail}。请只返回修正后的 JSON，不要解释。原输出：${previousOutput}` },
    ], { structured: true }, providerKind);
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
    `处理结果：${turn.resolution || (turn.answer?.trim() ? "answered" : "pending")}`,
  ].join("\n")).join("\n\n");
}

function parseAnalysisResponse(value: unknown): AnalysisResult {
  const analysis = normalizeAnalysisResult(value);
  if (analysis.analysisVersion !== 2) {
    throw new ProviderError("AI 返回的分析版本不是当前支持的 v2。", 502);
  }
  if (analysis.closureMode !== "normal") {
    throw new ProviderError("AI 返回的分析收口方式不是 normal。", 502);
  }
  return analysis;
}

export async function analyzeIdea(input: {
  rawIdea: string;
  turns: TurnRecord[];
  profile: Profile;
  settings: SettingsRecord;
  providerKind?: ProviderKind;
}): Promise<AnalysisResult> {
  const system = `你是“落点”，一个帮助用户把原始想法整理成高质量提示词的严谨协作者。
你要把结果整理成一份完整需求简报，忠实保留用户意图，区分已确认事实、用户假设和你的推测，不要擅自增加目标。
新分析必须输出 analysisVersion=2（JSON number，不能加引号）。字段必须包含：status、title、objective、background、audience、facts、assumptions、constraints、deliverables、inScope、outOfScope、priorities、preferences、gaps、contradictions、risks、acceptanceCriteria、delegatedTasks、openDecisions、optionalExtensions、question、questionReason、confidence、closureMode。
核心完成条件是 objective、至少一个 deliverables、至少一个 inScope 和至少一个 acceptanceCriteria；只有核心条件完整且没有用户必须确认的 gap 时才能 status=ready，否则 status=needs_input。
gaps 只放会改变用户意图、范围、优先级、受众、授权或验收的用户决策，不要把技术事实或实现选择放进 gaps。
技术事实、文件/路径、工具、版本、依赖、API、部署命令、发布位置等可以由执行 Agent 自行查证或决定的事项，必须放进 delegatedTasks（每项包含 task 和 reason），不要拿它们向用户提问。
只有一个最重要的用户问题可以放进 question，并说明 questionReason；没有用户问题时 question 和 questionReason 必须为 null。
无法从输入确认但不影响继续的内容放进 assumptions；用户明确的偏好放进 preferences；额外创意只能放入 optionalExtensions，不得混入 facts、constraints 或 acceptanceCriteria。
除 delegatedTasks 外，facts、assumptions、constraints、deliverables、inScope、outOfScope、priorities、preferences、gaps、contradictions、risks、acceptanceCriteria、openDecisions、optionalExtensions 全部必须是字符串数组；每个数组元素必须是字符串，不能使用对象或键值结构。delegatedTasks 必须是 [{"task":"...","reason":"..."}]，question 和 questionReason 必须是字符串或 null，confidence 必须是字符串 "low"、"medium" 或 "high"，不能输出数字评分。
正常分析的 closureMode 必须是 normal，强制收口才使用 forced。`;
  const user = JSON.stringify({
    rawIdea: input.rawIdea,
    personalProfile: input.profile,
    previousQuestionsAndAnswers: answerContext(input.turns),
  }, null, 2);
  return structuredRequest(input.settings, system, user, parseAnalysisResponse, input.providerKind);
}

export async function polishPrompt(input: {
  blueprint: string;
  settings: SettingsRecord;
  providerKind?: ProviderKind;
}): Promise<string> {
  const system = `你是提示词编辑器。把用户提供的提示词蓝图整理成一份可直接复制给目标 AI 的中文提示词。
只做澄清、排序和表达优化，不新增事实，不删除约束，不把待确认内容伪装成确定事实。
保留完整需求简报、Agent 自行研究/决策事项、当前仍需用户决定、未知和验收标准。
如果蓝图标记为强制收口，必须保留强制收口说明，并要求执行 Agent 对开放决策采用可逆、保守的默认值。输出 JSON：{"prompt":"..."}。`;
  const result = await structuredRequest(input.settings, system, input.blueprint, (value) => {
    const prompt = (value as { prompt?: unknown }).prompt;
    if (typeof prompt !== "string" || !prompt.trim()) throw new ProviderError("AI 没有返回最终提示词。", 502);
    return prompt.trim();
  }, input.providerKind);
  return result;
}

export async function testProvider(settings: SettingsRecord, providerKind?: ProviderKind): Promise<void> {
  const content = await requestProvider(settings, [
    { role: "system", content: "只返回 JSON：{\"ok\":true}" },
    { role: "user", content: "连接测试" },
  ], { structured: true }, providerKind);
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
