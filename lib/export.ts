import type { PromptRecord, TurnRecord, IdeaRecord } from "./repository";

export function ideaToMarkdown(input: { idea: IdeaRecord; turns: TurnRecord[]; prompts: PromptRecord[] }): string {
  const { idea, turns, prompts } = input;
  const lines = [
    `# ${idea.title}`,
    "",
    `- 状态：${idea.status}`,
    `- 提示词目标：${idea.target}`,
    `- 创建时间：${idea.createdAt}`,
    `- 更新时间：${idea.updatedAt}`,
    "",
    "## 原始想法",
    idea.rawText,
    "",
    "## 完整需求简报",
  ];

  const analysis = idea.latestAnalysis;
  if (analysis) {
    lines.push(
      `- 分析版本：${analysis.analysisVersion}`,
      `- 分析状态：${analysis.status}`,
      `- 收口方式：${analysis.closureMode}`,
      `- 置信度：${analysis.confidence}`,
      "",
      `### 目标\n${analysis.objective || "（未明确）"}`,
      `### 背景\n${analysis.background || "（未提供）"}`,
      `### 受众或使用者\n${analysis.audience || "（未明确）"}`,
    );
    markdownList(lines, "交付物", analysis.deliverables);
    markdownList(lines, "范围内", analysis.inScope);
    markdownList(lines, "范围外", analysis.outOfScope);
    markdownList(lines, "优先级", analysis.priorities);
    markdownList(lines, "用户偏好", analysis.preferences);
    markdownList(lines, "已确认事实", analysis.facts);
    markdownList(lines, "当前假设", analysis.assumptions);
    markdownList(lines, "约束", analysis.constraints);
    markdownList(lines, "验收标准", analysis.acceptanceCriteria);
    markdownList(lines, "仍待确认的缺口", analysis.gaps);
    markdownList(lines, "Agent 自行研究/决策事项", analysis.delegatedTasks.map((item) => `${item.task}（${item.reason}）`));
    markdownList(lines, "当前仍需用户决定", analysis.openDecisions);
    markdownList(lines, "矛盾或冲突", analysis.contradictions);
    markdownList(lines, "风险", analysis.risks);
    markdownList(lines, "可选延伸", analysis.optionalExtensions);
    if (analysis.question) {
      lines.push("### 当前问题", analysis.question, `提问原因：${analysis.questionReason || "未提供"}`, "");
    }
    lines.push("");
  } else {
    lines.push("暂无分析记录。", "");
  }

  lines.push(
    "## 追问记录",
  );
  if (turns.length === 0) lines.push("暂无追问。", "");
  for (const turn of turns) {
    const answer = turn.resolution === "delegated" ? "（已委派给执行 Agent）" : turn.answer || "（未回答）";
    lines.push(`### 问题 ${turn.sequence}`, turn.question, "", `提问原因：${turn.reason}`, `处理结果：${turn.resolution}`, "", `回答：${answer}`, "");
  }
  for (const prompt of prompts) {
    lines.push(`## 提示词版本 ${prompt.createdAt}`, `目标：${prompt.target}`, `包含可选延伸：${prompt.includeExtensions ? "是" : "否"}`, "", prompt.content, "");
  }
  return lines.join("\n");
}

function markdownList(lines: string[], title: string, values: string[]): void {
  lines.push(`### ${title}`, values.length ? values.map((value) => `- ${value}`).join("\n") : "- 无", "");
}

export function ideaToJson(input: { idea: IdeaRecord; turns: TurnRecord[]; prompts: PromptRecord[] }): string {
  return JSON.stringify({ exportVersion: 2, ...input }, null, 2);
}
