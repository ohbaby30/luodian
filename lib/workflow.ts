import { buildPromptBlueprint, type AnalysisResult, type PromptTarget } from "./contracts";
import { analyzeIdea, polishPrompt } from "./llm";
import {
  addTurn,
  answerTurn,
  getIdea,
  getSettings,
  listPrompts,
  listTurns,
  saveAnalysis,
  savePrompt,
  type IdeaRecord,
  type PromptRecord,
  type TurnRecord,
} from "./repository";

export interface WorkflowSnapshot {
  idea: IdeaRecord;
  analysis: AnalysisResult | null;
  turns: TurnRecord[];
  prompts: PromptRecord[];
}

export function assertFinalizable(analysis: AnalysisResult, turns: Array<Pick<TurnRecord, "answer">>): void {
  if (analysis.status !== "ready" || turns.some((turn) => !turn.answer?.trim())) {
    throw new Error("还有必要信息未确认，请先回答当前问题。");
  }
}

export async function analyzeAndPersist(ideaId: string): Promise<WorkflowSnapshot> {
  const idea = getIdea(ideaId);
  if (!idea) throw new Error("找不到这个想法。");
  const settings = getSettings();
  const analysis = await analyzeIdea({ rawIdea: idea.rawText, turns: listTurns(ideaId), profile: settings.profile, settings });
  saveAnalysis(ideaId, analysis);
  const turns = listTurns(ideaId);
  if (analysis.status === "needs_input" && !turns.some((turn) => !turn.answer)) {
    addTurn({ ideaId, question: analysis.question!, reason: analysis.questionReason! });
  }
  return snapshot(ideaId);
}

export async function answerAndAnalyze(ideaId: string, turnId: string, answer: string): Promise<WorkflowSnapshot> {
  if (!answer.trim()) throw new Error("回答不能为空。");
  const turn = listTurns(ideaId).find((item) => item.id === turnId);
  if (!turn) throw new Error("找不到这条问题。");
  if (turn.answer) throw new Error("这条问题已经回答过了。");
  answerTurn(turnId, answer);
  return analyzeAndPersist(ideaId);
}

export async function finalizeIdea(input: {
  ideaId: string;
  target: PromptTarget;
  includeExtensions: boolean;
}): Promise<{ prompt: PromptRecord; snapshot: WorkflowSnapshot }> {
  const idea = getIdea(input.ideaId);
  if (!idea?.latestAnalysis) throw new Error("请先完成一次想法分析。");
  const settings = getSettings();
  const analysis = idea.latestAnalysis;
  assertFinalizable(analysis, listTurns(input.ideaId));
  const blueprint = buildPromptBlueprint({
    target: input.target,
    title: analysis.title || idea.title,
    rawIdea: idea.rawText,
    objective: analysis.objective,
    audience: analysis.audience,
    facts: analysis.facts,
    assumptions: analysis.assumptions,
    constraints: analysis.constraints,
    gaps: analysis.gaps,
    contradictions: analysis.contradictions,
    risks: analysis.risks,
    acceptanceCriteria: analysis.acceptanceCriteria,
    optionalExtensions: analysis.optionalExtensions,
    profile: settings.profile,
    includeExtensions: input.includeExtensions,
  });
  const content = await polishPrompt({ blueprint, settings });
  const prompt = savePrompt({ ideaId: input.ideaId, target: input.target, content, analysis, includeExtensions: input.includeExtensions });
  return { prompt, snapshot: snapshot(input.ideaId) };
}

export function snapshot(ideaId: string): WorkflowSnapshot {
  const idea = getIdea(ideaId);
  if (!idea) throw new Error("找不到这个想法。");
  return { idea, analysis: idea.latestAnalysis, turns: listTurns(ideaId), prompts: listPrompts(ideaId) };
}
