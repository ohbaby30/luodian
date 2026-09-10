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
    "## 追问记录",
  ];
  if (turns.length === 0) lines.push("暂无追问。", "");
  for (const turn of turns) {
    lines.push(`### 问题 ${turn.sequence}`, turn.question, "", `提问原因：${turn.reason}`, "", `回答：${turn.answer || "（未回答）"}`, "");
  }
  for (const prompt of prompts) {
    lines.push(`## 提示词版本 ${prompt.createdAt}`, `目标：${prompt.target}`, `包含可选延伸：${prompt.includeExtensions ? "是" : "否"}`, "", prompt.content, "");
  }
  return lines.join("\n");
}

