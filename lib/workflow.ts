import { buildPromptBlueprint, forceCloseAnalysis, isCoreComplete, type AnalysisResult, type PromptTarget } from "./contracts";
import { analyzeIdea, polishPrompt } from "./llm";
import {
  addTurn,
  answerTurn,
  delegateTurn,
  getIdea,
  getSettings,
  listPrompts,
  listTurns,
  saveAnalysis,
  savePrompt,
  setIdeaProviderKind,
  type IdeaRecord,
  type PromptRecord,
  type TurnRecord,
} from "./repository";
import { withTransaction } from "./db";
import {
  configuredProviderKinds,
  isProviderConfigured,
  providerKindLabels,
  ProviderSelectionRequiredError,
  type ProviderKind,
} from "./provider";

export interface WorkflowSnapshot {
  idea: IdeaRecord;
  analysis: AnalysisResult | null;
  turns: TurnRecord[];
  prompts: PromptRecord[];
}

export function resolveProviderKind(settings: ReturnType<typeof getSettings>, currentKind: ProviderKind | null | undefined, requestedKind?: ProviderKind): ProviderKind {
  const profiles = settings.providerProfiles;
  if (currentKind) {
    if (requestedKind && requestedKind !== currentKind) throw new Error(`这个想法已经绑定“${providerKindLabels[currentKind]}”，不能在处理中切换接口。`);
    if (!isProviderConfigured(profiles?.[currentKind])) throw new Error(`“${providerKindLabels[currentKind]}”配置不完整，请先到设置页补齐。`);
    return currentKind;
  }

  if (requestedKind) {
    if (!isProviderConfigured(profiles?.[requestedKind])) throw new Error(`“${providerKindLabels[requestedKind]}”配置不完整，请先到设置页补齐。`);
    return requestedKind;
  }

  const available = configuredProviderKinds(profiles);
  if (available.length === 1) return available[0];
  if (available.length > 1) throw new ProviderSelectionRequiredError(available);
  throw new Error("请先到设置页配置至少一个完整的 AI 接口。");
}

function turnResolution(turn: Pick<TurnRecord, "answer"> & Partial<Pick<TurnRecord, "resolution">>): "pending" | "answered" | "delegated" {
  return turn.resolution || (turn.answer?.trim() ? "answered" : "pending");
}

function hasPendingTurn(turns: Array<Pick<TurnRecord, "answer"> & Partial<Pick<TurnRecord, "resolution">>>): boolean {
  return turns.some((turn) => turnResolution(turn) === "pending");
}

function addDelegatedTurn(analysis: AnalysisResult, turn: TurnRecord): AnalysisResult {
  if (analysis.delegatedTasks.some((item) => item.task === turn.question)) return analysis;
  return {
    ...analysis,
    delegatedTasks: [
      ...analysis.delegatedTasks,
      { task: turn.question, reason: "用户已选择将这项问题交给执行 Agent 处理。" },
    ],
  };
}

export function assertFinalizable(analysis: AnalysisResult, turns: Array<Pick<TurnRecord, "answer"> & Partial<Pick<TurnRecord, "resolution">>>): void {
  const coreMissing = analysis.analysisVersion >= 2 && analysis.closureMode === "normal" && !isCoreComplete(analysis);
  const unresolvedDecisions = analysis.gaps.length > 0 || analysis.openDecisions.length > 0;
  if (analysis.status !== "ready" || coreMissing || (analysis.closureMode !== "forced" && (hasPendingTurn(turns) || unresolvedDecisions))) {
    throw new Error("还有必要信息未确认，请先回答当前问题。");
  }
}

function persistAnalysisAndNextQuestion(ideaId: string, analysis: AnalysisResult, providerKind: ProviderKind): void {
  withTransaction(() => {
    setIdeaProviderKind(ideaId, providerKind);
    saveAnalysis(ideaId, analysis);
    const turns = listTurns(ideaId);
    if (analysis.status === "needs_input" && !hasPendingTurn(turns)) {
      addTurn({ ideaId, question: analysis.question!, reason: analysis.questionReason! });
    }
  });
}

export async function analyzeAndPersist(ideaId: string, requestedProviderKind?: ProviderKind): Promise<WorkflowSnapshot> {
  const idea = getIdea(ideaId);
  if (!idea) throw new Error("找不到这个想法。");
  const settings = getSettings();
  const providerKind = resolveProviderKind(settings, idea.providerKind, requestedProviderKind);
  const analysis = await analyzeIdea({ rawIdea: idea.rawText, turns: listTurns(ideaId), profile: settings.profile, settings, providerKind });
  persistAnalysisAndNextQuestion(ideaId, analysis, providerKind);
  return snapshot(ideaId);
}

export async function answerAndAnalyze(ideaId: string, turnId: string, answer: string): Promise<WorkflowSnapshot> {
  if (!answer.trim()) throw new Error("回答不能为空。");
  const turns = listTurns(ideaId);
  const turn = turns.find((item) => item.id === turnId);
  if (!turn) throw new Error("找不到这条问题。");
  if (turnResolution(turn) !== "pending") throw new Error("这条问题已经处理过了。");
  const proposedTurns = turns.map((item) => item.id === turnId ? { ...item, answer: answer.trim(), resolution: "answered" as const } : item);
  const settings = getSettings();
  const idea = getIdea(ideaId);
  if (!idea) throw new Error("找不到这个想法。");
  const providerKind = resolveProviderKind(settings, idea.providerKind);
  const analysis = await analyzeIdea({ rawIdea: idea.rawText, turns: proposedTurns, profile: settings.profile, settings, providerKind });
  withTransaction(() => {
    setIdeaProviderKind(ideaId, providerKind);
    answerTurn(turnId, answer);
    saveAnalysis(ideaId, analysis);
    const nextTurns = listTurns(ideaId);
    if (analysis.status === "needs_input" && !hasPendingTurn(nextTurns)) {
      addTurn({ ideaId, question: analysis.question!, reason: analysis.questionReason! });
    }
  });
  return snapshot(ideaId);
}

export async function delegateAndAnalyze(ideaId: string, turnId: string): Promise<WorkflowSnapshot> {
  const turns = listTurns(ideaId);
  const turn = turns.find((item) => item.id === turnId);
  if (!turn) throw new Error("找不到这条问题。");
  if (turnResolution(turn) !== "pending") throw new Error("这条问题已经处理过了。");
  const proposedTurns = turns.map((item) => item.id === turnId ? { ...item, answer: null, resolution: "delegated" as const } : item);
  const settings = getSettings();
  const idea = getIdea(ideaId);
  if (!idea) throw new Error("找不到这个想法。");
  const providerKind = resolveProviderKind(settings, idea.providerKind);
  const analysis = addDelegatedTurn(
    await analyzeIdea({ rawIdea: idea.rawText, turns: proposedTurns, profile: settings.profile, settings, providerKind }),
    turn,
  );
  withTransaction(() => {
    setIdeaProviderKind(ideaId, providerKind);
    delegateTurn(turnId);
    saveAnalysis(ideaId, analysis);
    const nextTurns = listTurns(ideaId);
    if (analysis.status === "needs_input" && !hasPendingTurn(nextTurns)) {
      addTurn({ ideaId, question: analysis.question!, reason: analysis.questionReason! });
    }
  });
  return snapshot(ideaId);
}

function blueprintFor(input: {
  idea: IdeaRecord;
  analysis: AnalysisResult;
  target: PromptTarget;
  includeExtensions: boolean;
}): string {
  return buildPromptBlueprint({
    target: input.target,
    title: input.analysis.title || input.idea.title,
    rawIdea: input.idea.rawText,
    objective: input.analysis.objective,
    background: input.analysis.background,
    audience: input.analysis.audience,
    facts: input.analysis.facts,
    assumptions: input.analysis.assumptions,
    constraints: input.analysis.constraints,
    deliverables: input.analysis.deliverables,
    inScope: input.analysis.inScope,
    outOfScope: input.analysis.outOfScope,
    priorities: input.analysis.priorities,
    preferences: input.analysis.preferences,
    gaps: input.analysis.gaps,
    contradictions: input.analysis.contradictions,
    risks: input.analysis.risks,
    acceptanceCriteria: input.analysis.acceptanceCriteria,
    delegatedTasks: input.analysis.delegatedTasks,
    openDecisions: input.analysis.openDecisions,
    optionalExtensions: input.analysis.optionalExtensions,
    closureMode: input.analysis.closureMode,
    profile: getSettings().profile,
    includeExtensions: input.includeExtensions,
  });
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
  const providerKind = resolveProviderKind(settings, idea.providerKind);
  assertFinalizable(analysis, listTurns(input.ideaId));
  const blueprint = blueprintFor({ idea, analysis, target: input.target, includeExtensions: input.includeExtensions });
  const content = await polishPrompt({ blueprint, settings, providerKind });
  const prompt = withTransaction(() => {
    setIdeaProviderKind(input.ideaId, providerKind);
    return savePrompt({ ideaId: input.ideaId, target: input.target, content, analysis, includeExtensions: input.includeExtensions });
  });
  return { prompt, snapshot: snapshot(input.ideaId) };
}

export async function forceFinalizeIdea(input: {
  ideaId: string;
  target: PromptTarget;
  includeExtensions: boolean;
}): Promise<{ prompt: PromptRecord; snapshot: WorkflowSnapshot }> {
  const idea = getIdea(input.ideaId);
  if (!idea?.latestAnalysis) throw new Error("请先完成一次想法分析。");
  const settings = getSettings();
  const turns = listTurns(input.ideaId);
  const providerKind = resolveProviderKind(settings, idea.providerKind);
  const forcedAnalysis = forceCloseAnalysis(idea.latestAnalysis, turns);
  const blueprint = blueprintFor({ idea, analysis: forcedAnalysis, target: input.target, includeExtensions: input.includeExtensions });
  const content = await polishPrompt({ blueprint, settings, providerKind });
  const prompt = withTransaction(() => {
    setIdeaProviderKind(input.ideaId, providerKind);
    saveAnalysis(input.ideaId, forcedAnalysis);
    return savePrompt({ ideaId: input.ideaId, target: input.target, content, analysis: forcedAnalysis, includeExtensions: input.includeExtensions });
  });
  return { prompt, snapshot: snapshot(input.ideaId) };
}

export function snapshot(ideaId: string): WorkflowSnapshot {
  const idea = getIdea(ideaId);
  if (!idea) throw new Error("找不到这个想法。");
  return { idea, analysis: idea.latestAnalysis, turns: listTurns(ideaId), prompts: listPrompts(ideaId) };
}
