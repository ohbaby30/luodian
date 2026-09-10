import { z } from "zod";

export const promptTargetSchema = z.enum([
  "general",
  "coding",
  "research",
  "creative",
  "decision",
]);

export type PromptTarget = z.infer<typeof promptTargetSchema>;

export const analysisResultSchema = z
  .object({
    status: z.enum(["needs_input", "ready"]),
    title: z.string().min(1),
    objective: z.string(),
    audience: z.string(),
    facts: z.array(z.string()),
    assumptions: z.array(z.string()),
    constraints: z.array(z.string()),
    gaps: z.array(z.string()),
    contradictions: z.array(z.string()),
    risks: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()),
    optionalExtensions: z.array(z.string()).default([]),
    question: z.string().nullable().default(null),
    questionReason: z.string().nullable().default(null),
    confidence: z.enum(["low", "medium", "high"]),
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
  });

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

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
  audience: z.string(),
  facts: z.array(z.string()),
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),
  gaps: z.array(z.string()),
  contradictions: z.array(z.string()),
  risks: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  optionalExtensions: z.array(z.string()),
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
    "## 受众或使用者",
    value.audience.trim() || "（需要先澄清）",
    "",
    section("已确认事实", value.facts),
    section("当前假设（不可当作事实）", value.assumptions),
    section("约束", value.constraints),
    section("仍待确认的缺口", value.gaps),
    section("矛盾或冲突", value.contradictions),
    section("风险", value.risks),
    section("验收标准", value.acceptanceCriteria),
  ];

  if (profile.defaultContext.trim()) {
    sections.push("## 用户补充背景", profile.defaultContext.trim(), "");
  }
  sections.push(section("用户偏好", [...profile.principles, ...profile.preferences]));
  sections.push(section("用户限制", [...profile.constraints, ...profile.doNotDo]));

  if (value.includeExtensions && value.optionalExtensions.length > 0) {
    sections.push(section("用户明确选择的可选延伸", value.optionalExtensions));
  } else {
    sections.push("## 可选延伸\n以下内容仅供参考，除非用户明确选择，否则不要纳入本次执行：\n- 已保留在落点分析中，未自动加入本任务。\n");
  }

  sections.push(
    "## 执行要求",
    targetInstructions[value.target],
    "如果关键事实不足，请先只提出一个最重要的问题；如果已经足够，请直接完成任务。",
    "",
    "## 输出要求",
    "先列出你采用的目标、事实和关键假设；然后给出结果；最后列出未验证事项和下一步。",
  );

  return sections.join("\n").trim();
}
