import { z } from "zod";

export const promptTargetSchema = z.enum([
  "general",
  "coding",
  "research",
  "creative",
  "decision",
]);

export type PromptTarget = z.infer<typeof promptTargetSchema>;

export const delegatedTaskSchema = z.object({
  task: z.string().min(1),
  reason: z.string().min(1),
});

export type DelegatedTask = z.infer<typeof delegatedTaskSchema>;

export const closureModeSchema = z.enum(["normal", "forced"]);
export type ClosureMode = z.infer<typeof closureModeSchema>;

export const analysisResultSchema = z
  .object({
    analysisVersion: z.number().int().positive().default(1),
    status: z.enum(["needs_input", "ready"]),
    title: z.string().min(1),
    objective: z.string(),
    background: z.string().default(""),
    audience: z.string(),
    facts: z.array(z.string()),
    assumptions: z.array(z.string()),
    constraints: z.array(z.string()),
    deliverables: z.array(z.string()).default([]),
    inScope: z.array(z.string()).default([]),
    outOfScope: z.array(z.string()).default([]),
    priorities: z.array(z.string()).default([]),
    preferences: z.array(z.string()).default([]),
    gaps: z.array(z.string()),
    contradictions: z.array(z.string()),
    risks: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()),
    delegatedTasks: z.array(delegatedTaskSchema).default([]),
    openDecisions: z.array(z.string()).default([]),
    optionalExtensions: z.array(z.string()).default([]),
    question: z.string().nullable().default(null),
    questionReason: z.string().nullable().default(null),
    confidence: z.enum(["low", "medium", "high"]),
    closureMode: closureModeSchema.default("normal"),
  })
  .superRefine((value, context) => {
    if (value.status === "needs_input") {
      if (!value.question?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["question"],
          message: "需要追问时必须提供一个问题。",
        });
      }
      if (!value.questionReason?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questionReason"],
          message: "需要追问时必须说明提问原因。",
        });
      }
    }

    if (value.status === "ready" && (value.question || value.questionReason)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question"],
        message: "准备收口时不能继续挂着未回答的问题。",
      });
    }

    if (value.status === "ready" && value.analysisVersion >= 2 && value.closureMode === "normal" && !isCoreComplete(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deliverables"],
        message: "正常收口至少需要目标、交付物、范围内内容和验收标准。",
      });
    }
  });

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

function hasItems(values: string[]): boolean {
  return values.some((value) => hasText(value));
}

export function isCoreComplete(analysis: Pick<AnalysisResult, "objective" | "deliverables" | "inScope" | "acceptanceCriteria">): boolean {
  return hasText(analysis.objective) && hasItems(analysis.deliverables) && hasItems(analysis.inScope) && hasItems(analysis.acceptanceCriteria);
}

const analysisStringArrayFields = [
  "facts",
  "assumptions",
  "constraints",
  "deliverables",
  "inScope",
  "outOfScope",
  "priorities",
  "preferences",
  "gaps",
  "contradictions",
  "risks",
  "acceptanceCriteria",
  "openDecisions",
  "optionalExtensions",
] as const;

function renderLooseText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(renderLooseText).filter(Boolean).join("、");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const text = renderLooseText(nested);
        return text ? `${key}：${text}` : key;
      })
      .join("；");
  }
  return "";
}

function normalizeStringArray(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(renderLooseText).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const text = renderLooseText(nested);
        return text ? `${key}：${text}` : key;
      })
      .filter(Boolean);
  }
  const text = renderLooseText(value);
  return text ? [text] : value;
}

function normalizeAnalysisVersion(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return value;
  const version = Number(trimmed);
  return Number.isSafeInteger(version) ? version : value;
}

function normalizeConfidence(value: unknown): unknown {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return value;
    value = Number(normalized);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const score = value > 1 && value <= 100 ? value / 100 : value;
  if (score < 0 || score > 1) return value;
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function normalizeAnalysisPayload(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = { ...(input as Record<string, unknown>) };
  if ("analysisVersion" in value) value.analysisVersion = normalizeAnalysisVersion(value.analysisVersion);
  if ("confidence" in value) value.confidence = normalizeConfidence(value.confidence);
  for (const field of analysisStringArrayFields) {
    if (field in value) value[field] = normalizeStringArray(value[field]);
  }
  return value;
}

const technicalMarkers = /技术|代码|文件|路径|目录|命令|工具|版本|依赖|接口|\bAPI\b|数据库|\bSQL\b|\bDocker\b|容器|端口|框架|\bSDK\b|\bnpm\b|\bNode(?:\.js)?\b|\bNext(?:\.js)?\b|\bReact\b|\bPython\b|\bLinux\b|服务器|仓库|\bcommit\b|\bbranch\b|发布位置|\brelease\b/i;
const userIntentMarkers = /希望|想要|授权|允许|同意|优先|范围|边界|受众|给谁|预算|截止|必须|公开|私有|隐私|账号|密码|公网|外网|互联网/;
const ambiguousDecisionMarkers = /是否|要不要|需不需要|确认|选择/;

function isTechnicalItem(value: string): boolean {
  if (!technicalMarkers.test(value)) return false;
  if (userIntentMarkers.test(value)) return false;
  const hasSpecificTechnicalDetail = /代码|文件|路径|目录|命令|工具|版本|依赖|接口|\bAPI\b|数据库|\bSQL\b|\bDocker\b|容器|端口|框架|\bSDK\b|\bnpm\b|\bNode(?:\.js)?\b|\bNext(?:\.js)?\b|\bReact\b|\bPython\b|\bLinux\b|仓库|\bcommit\b|\bbranch\b|发布位置|\brelease\b/i.test(value);
  return hasSpecificTechnicalDetail || !ambiguousDecisionMarkers.test(value);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueTasks(values: DelegatedTask[]): DelegatedTask[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.task.trim()}\n${item.reason.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function routeTechnicalItems(value: AnalysisResult): AnalysisResult {
  const delegatedTasks = [...value.delegatedTasks];
  const userGaps: string[] = [];
  for (const gap of value.gaps) {
    if (isTechnicalItem(gap)) delegatedTasks.push({ task: gap, reason: "这是执行 Agent 可以自行查证或决定的技术细节。" });
    else userGaps.push(gap);
  }

  let question = value.question;
  let questionReason = value.questionReason;
  if (question && isTechnicalItem(question)) {
    delegatedTasks.push({ task: question, reason: questionReason || "这是执行 Agent 可以自行查证或决定的技术细节。" });
    question = null;
    questionReason = null;
  }

  let status = value.status;
  const unresolvedUserDecisions = uniqueStrings([...userGaps, ...value.openDecisions]);
  if (status === "ready" && value.closureMode === "normal" && unresolvedUserDecisions.length > 0) {
    status = "needs_input";
  }
  if (status === "needs_input" && !question) {
    if (unresolvedUserDecisions.length > 0) {
      question = unresolvedUserDecisions[0];
      questionReason = "这项用户意图或范围信息会改变最终结果，需要由用户确认。";
    } else if (isCoreComplete(value)) {
      status = "ready";
    } else {
      question = "请补充仍会影响结果的核心需求：目标、交付物、范围内内容或验收标准。";
      questionReason = "这些核心信息不足时，执行 Agent 无法可靠判断交付结果。";
    }
  }

  return {
    ...value,
    status,
    gaps: uniqueStrings(userGaps),
    delegatedTasks: uniqueTasks(delegatedTasks),
    question,
    questionReason,
  };
}

export function normalizeAnalysisResult(input: unknown): AnalysisResult {
  return routeTechnicalItems(analysisResultSchema.parse(normalizeAnalysisPayload(input)));
}

export function forceCloseAnalysis(analysis: AnalysisResult, turns: Array<Pick<{ question: string; resolution?: string; answer?: string | null }, "question" | "resolution"> & { answer?: string | null }>): AnalysisResult {
  const pendingQuestions = turns.filter((turn) => turn.resolution === "pending" || (!turn.resolution && !turn.answer?.trim())).map((turn) => turn.question);
  return {
    ...analysis,
    status: "ready",
    closureMode: "forced",
    gaps: [],
    question: null,
    questionReason: null,
    openDecisions: uniqueStrings([...analysis.openDecisions, ...analysis.gaps, ...pendingQuestions, ...(analysis.question ? [analysis.question] : [])]),
  };
}

export const profileSchema = z.object({
  principles: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  doNotDo: z.array(z.string()).default([]),
  defaultContext: z.string().default(""),
});

export type Profile = z.infer<typeof profileSchema>;

export const promptBlueprintInputSchema = z.object({
  target: promptTargetSchema,
  title: z.string(),
  rawIdea: z.string(),
  objective: z.string(),
  background: z.string().default(""),
  audience: z.string(),
  facts: z.array(z.string()),
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),
  deliverables: z.array(z.string()).default([]),
  inScope: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  priorities: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  gaps: z.array(z.string()),
  contradictions: z.array(z.string()),
  risks: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  delegatedTasks: z.array(delegatedTaskSchema).default([]),
  openDecisions: z.array(z.string()).default([]),
  optionalExtensions: z.array(z.string()),
  closureMode: closureModeSchema.default("normal"),
  profile: profileSchema.optional(),
  includeExtensions: z.boolean().default(false),
});

export type PromptBlueprintInput = z.input<typeof promptBlueprintInputSchema>;

const targetInstructions: Record<PromptTarget, string> = {
  general: "请先复述你对问题的理解，再给出结构化、可执行的回答；不要把未经确认的内容当成事实。",
  coding: "请先检查现有代码和运行边界，再提出最小改动；明确文件、验证命令、未验证范围和回滚方式。",
  research: "请区分事实、推测和未知；使用可核验的一手来源，说明时间范围、证据强度和仍需确认的部分。",
  creative: "请保留原始意图和语气边界；先确认受众、形式和长度，再输出完整创作结果及必要的自检标准。",
  decision: "请列出目标、选项、取舍、风险和判断依据；不要替用户隐藏关键假设，最后给出可逆的下一步。",
};

function section(title: string, values: string[]): string {
  if (values.length === 0) return `## ${title}\n- 无\n`;
  return `## ${title}\n${values.map((value) => `- ${value}`).join("\n")}\n`;
}

export function buildPromptBlueprint(input: PromptBlueprintInput): string {
  const value = promptBlueprintInputSchema.parse(input);
  const profile = profileSchema.parse(value.profile ?? {});
  const userDecisions = uniqueStrings([...value.openDecisions, ...value.gaps]);
  const delegated = value.delegatedTasks.map((item) => `${item.task}（${item.reason}）`);
  const sections = [
    `# 任务：${value.title}`,
    "",
    "你是一个严谨、主动发现缺口但不擅自编造事实的协作者。",
    "",
    "## 原始想法",
    value.rawIdea.trim() || "（未提供）",
    "",
    "## 目标",
    value.objective.trim() || "（需要先澄清目标）",
    "",
    "## 完整需求简报",
    `### 目标\n${value.objective.trim() || "（未明确）"}`,
    `### 背景\n${value.background.trim() || "（未提供）"}`,
    `### 受众或使用者\n${value.audience.trim() || "（未明确）"}`,
    section("交付物", value.deliverables),
    section("范围内", value.inScope),
    section("范围外", value.outOfScope),
    section("优先级", value.priorities),
    section("用户偏好", uniqueStrings([...value.preferences, ...profile.principles, ...profile.preferences])),
    section("已确认事实", value.facts),
    section("当前假设（不可当作事实）", value.assumptions),
    section("约束", value.constraints),
    section("验收标准", value.acceptanceCriteria),
    "",
    section("仍待确认的缺口", value.gaps),
    section("矛盾或冲突", value.contradictions),
    section("风险", value.risks),
  ];

  sections.push(section("Agent 自行研究/决策事项", delegated));
  sections.push(section("当前仍需用户决定", userDecisions));

  if (profile.defaultContext.trim()) {
    sections.push("## 用户补充背景", profile.defaultContext.trim(), "");
  }
  sections.push(section("用户限制", [...profile.constraints, ...profile.doNotDo]));

  if (value.includeExtensions && value.optionalExtensions.length > 0) {
    sections.push(section("用户明确选择的可选延伸", value.optionalExtensions));
  } else {
    sections.push("## 可选延伸\n以下内容仅供参考，除非用户明确选择，否则不要纳入本次执行：\n- 已保留在落点分析中，未自动加入本任务。\n");
  }

  if (value.closureMode === "forced") {
    sections.push(
      "## 强制收口说明",
      "这是一次强制收口：部分需求未经用户确认。执行 Agent 不要把开放决策当成已确认事实，应采用可逆、保守的默认值，并在结果中标记这些选择。",
      "",
    );
  }

  sections.push(
    "## 执行要求",
    targetInstructions[value.target],
    value.closureMode === "forced"
      ? "除非开放决策使任务无法安全继续，否则请基于保守默认值完成任务，不要因为未确认事项直接停住。"
      : "如果关键事实不足，请先只提出一个最重要的问题；如果已经足够，请直接完成任务。",
    "",
    "## 输出要求",
    "先列出你采用的目标、事实、关键假设和执行 Agent 自行处理的事项；然后给出结果；最后列出未验证事项、开放决策和下一步。",
  );

  return sections.join("\n").trim();
}
