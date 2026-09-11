"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isCoreComplete, type AnalysisResult, type PromptTarget } from "@/lib/contracts";
import type { IdeaRecord, PromptRecord, TurnRecord } from "@/lib/repository";
import { copyText } from "@/lib/copy";
import { providerKindLabels, type ProviderKind } from "@/lib/provider";
import { BusyButton, ErrorNotice, Loading, StatusPill, TargetSelect } from "./Ui";

type Snapshot = { idea: IdeaRecord; analysis: AnalysisResult | null; turns: TurnRecord[]; prompts: PromptRecord[] };

function ListBlock({ title, values }: { title: string; values: string[] }) {
  return <div><h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>{values.length ? <ul className="space-y-2">{values.map((value, index) => <li key={`${value}-${index}`} className="text-sm leading-6 text-slate">{value}</li>)}</ul> : <p className="text-sm text-slate/60">暂无</p>}</div>;
}

function turnIsPending(turn: TurnRecord): boolean {
  return (turn.resolution || (turn.answer?.trim() ? "answered" : "pending")) === "pending";
}

export default function IdeaWorkspace({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [target, setTarget] = useState<PromptTarget>("general");
  const [includeExtensions, setIncludeExtensions] = useState(false);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const [providerChoices, setProviderChoices] = useState<ProviderKind[]>([]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/ideas/${id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取想法。");
    setSnapshot(data);
    setTarget(data.idea.target);
    return data as Snapshot;
  }, [id]);

  const analyze = useCallback(async (providerKind?: ProviderKind) => {
    const response = await fetch(`/api/ideas/${id}/analyze`, providerKind
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerKind }) }
      : { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      if (data.code === "provider_selection_required") {
        setProviderChoices(data.providerKinds ?? []);
        return null;
      }
      throw new Error(data.error || "无法分析这个想法。");
    }
    setProviderChoices([]);
    setSnapshot(data);
    return data as Snapshot;
  }, [id]);

  useEffect(() => {
    load().then(async (data) => {
      if (data.analysis) return data;
      return analyze();
    }).catch((e) => setError(e instanceof Error ? e.message : "无法分析这个想法。")).finally(() => setLoading(false));
  }, [analyze, load]);

  if (loading) return <Loading label="正在整理你的想法…" />;
  if (error && !snapshot) return <ErrorNotice message={error} />;
  if (!snapshot) return <ErrorNotice message="找不到这个想法。" />;

  const analysis = snapshot.analysis;
  const openTurn = snapshot.turns.find(turnIsPending);
  const visibleOpenTurn = analysis?.closureMode === "forced" ? null : openTurn;
  const canForceFinalize = Boolean(analysis && snapshot.prompts.length === 0 && (analysis.status !== "ready" || openTurn || !isCoreComplete(analysis)));

  async function chooseProvider(providerKind: ProviderKind) {
    setBusy(true);
    setError("");
    try {
      await analyze(providerKind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法分析这个想法。");
    } finally {
      setBusy(false);
    }
  }

  async function sendAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!openTurn || !answer.trim()) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/ideas/${id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId: openTurn.id, answer }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "回答没有保存。");
    else { setSnapshot(data); setAnswer(""); }
    setBusy(false);
  }

  async function delegate() {
    if (!openTurn) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/ideas/${id}/delegate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId: openTurn.id }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "委派没有保存。");
    else setSnapshot(data);
    setBusy(false);
  }

  async function finalize(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch(`/api/ideas/${id}/finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, includeExtensions }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "生成提示词失败。");
    else setSnapshot(data.snapshot);
    setBusy(false);
  }

  async function forceFinalize() {
    if (!analysis) return;
    if (!window.confirm("仍有未确认的信息。强制收口会把它们记录为开放决策，并让执行 Agent 使用保守默认值。要继续吗？")) return;
    if (!window.confirm("最后确认：这些开放决策可能改变结果。仍然强制收口并生成提示词吗？")) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/ideas/${id}/force-finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, includeExtensions }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "强制收口失败。");
    else setSnapshot(data.snapshot);
    setBusy(false);
  }

  async function archive() {
    if (!confirm("把这条想法归档吗？归档后仍保留在数据里。")) return;
    const response = await fetch(`/api/ideas/${id}`, { method: "PATCH" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "归档失败，请稍后重试。");
      return;
    }
    window.location.href = "/";
  }

  async function copyPrompt(prompt: PromptRecord) {
    setCopyError("");
    try {
      await copyText(prompt.content);
      setCopied(prompt.id);
      window.setTimeout(() => setCopied(""), 1600);
    } catch (copyFailure) {
      setCopyError(copyFailure instanceof Error ? copyFailure.message : "复制失败，请长按文本选择复制。");
    }
  }

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/" className="muted hover:text-ink">← 返回想法</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{snapshot.idea.title}</h1><StatusPill status={snapshot.idea.status} /></div></div><div className="flex flex-wrap gap-2"><a className="button-secondary" href={`/api/ideas/${id}/export`}>导出 Markdown</a><a className="button-secondary" href={`/api/ideas/${id}/export?format=json`}>导出 JSON</a><button className="button-quiet" onClick={archive}>归档</button></div></div>
    {error && <ErrorNotice message={error} />}
    {!analysis && providerChoices.length > 0 && <section className="card border-apricot/30 p-6"><p className="eyebrow mb-3">开始分析</p><h2 className="section-title">选择本次使用的 AI 接口</h2><p className="muted mt-3">你保存了两组接口。选定后，这个想法后续的追问和提示词生成都会继续使用同一组。</p><div className="mt-5 flex flex-col gap-3 sm:flex-row">{providerChoices.map((providerKind) => <BusyButton key={providerKind} type="button" className="button-primary" busy={busy} busyLabel="正在分析…" onClick={() => chooseProvider(providerKind)}>{providerKindLabels[providerKind]}</BusyButton>)}</div></section>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="space-y-6">
        <section className="card p-6"><p className="eyebrow mb-3">原始想法</p><p className="whitespace-pre-wrap text-base leading-8">{snapshot.idea.rawText}</p></section>
        {visibleOpenTurn && <section className="card border-apricot/30 p-6"><p className="eyebrow mb-3">下一个关键问题</p><h2 className="text-xl font-semibold leading-8">{visibleOpenTurn.question}</h2><p className="muted mt-3">为什么问：{visibleOpenTurn.reason}</p><form onSubmit={sendAnswer} className="mt-5 space-y-3"><textarea className="textarea min-h-32" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="回答这个问题，不需要写得漂亮。" /><div className="flex flex-wrap gap-3"><BusyButton className="button-primary" busy={busy} busyLabel="继续整理…" disabled={!answer.trim()}>回答并继续</BusyButton><BusyButton type="button" className="button-secondary" busy={busy} busyLabel="正在委派…" onClick={delegate}>交给执行 Agent</BusyButton></div></form></section>}
        {analysis && <section className="card p-6"><div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow mb-2">需求简报</p><h2 className="section-title">当前理解</h2></div><div className="flex flex-wrap justify-end gap-2"><span className="tag">置信度：{analysis.confidence}</span>{snapshot.idea.providerKind && <span className="tag">分析接口：{providerKindLabels[snapshot.idea.providerKind]}</span>}</div></div><div className="grid gap-6 sm:grid-cols-2"><ListBlock title="目标" values={[analysis.objective || "暂无"]} /><ListBlock title="背景" values={[analysis.background || "暂无"]} /><ListBlock title="使用者" values={[analysis.audience || "暂无"]} /><ListBlock title="交付物" values={analysis.deliverables} /><ListBlock title="范围内" values={analysis.inScope} /><ListBlock title="范围外" values={analysis.outOfScope} /><ListBlock title="优先级" values={analysis.priorities} /><ListBlock title="用户偏好" values={analysis.preferences} /><ListBlock title="可选延伸" values={analysis.optionalExtensions} /><ListBlock title="已确认事实" values={analysis.facts} /><ListBlock title="当前假设" values={analysis.assumptions} /><ListBlock title="约束" values={analysis.constraints} /><ListBlock title="缺口 / 矛盾" values={[...analysis.gaps, ...analysis.contradictions]} /><ListBlock title="风险" values={analysis.risks} /><ListBlock title="验收标准" values={analysis.acceptanceCriteria} /></div>{analysis.delegatedTasks.length > 0 && <div className="mt-8 border-t border-ink/10 pt-6"><ListBlock title="Agent 自行研究 / 决策" values={analysis.delegatedTasks.map((item) => `${item.task}（${item.reason}）`)} /></div>}{analysis.openDecisions.length > 0 && <div className="mt-8 border-t border-ink/10 pt-6"><ListBlock title="当前仍需用户决定" values={analysis.openDecisions} /></div>}</section>}
      </div>
      <aside className="space-y-6"><section className="card p-6"><p className="eyebrow mb-3">收口</p><h2 className="section-title">把它收口成提示词</h2><p className="muted mt-3">必要缺口会先变成一个关键问题；回答或委派完成、分析显示“可以收口”后，才能生成最终版本。</p>{analysis?.optionalExtensions?.length ? <label className="mt-5 flex gap-3 rounded-2xl bg-mist/70 p-4 text-sm leading-6"><input className="mt-1" type="checkbox" checked={includeExtensions} onChange={(event) => setIncludeExtensions(event.target.checked)} /><span><strong>加入可选延伸</strong><br /><span className="text-slate">仅在你明确选择时，才会写进最终提示词。</span></span></label> : null}<form onSubmit={finalize} className="mt-5 space-y-3"><label className="block"><span className="mb-2 block text-sm font-semibold">提示词用途</span><TargetSelect value={target} onChange={setTarget} /></label><BusyButton className="button-primary w-full" busy={busy} busyLabel="正在生成…" disabled={!analysis || analysis.status !== "ready" || Boolean(openTurn) || (analysis.analysisVersion >= 2 && !isCoreComplete(analysis)) || (analysis.closureMode === "normal" && (analysis.gaps.length > 0 || analysis.openDecisions.length > 0))}>生成最终提示词</BusyButton></form>{canForceFinalize && <div className="mt-5 rounded-2xl border border-apricot/30 bg-apricot/10 p-4"><p className="text-sm leading-6 text-slate">还有未确认信息时，可以把它们保留为开放决策，再让执行 Agent 采用保守默认值。</p><button type="button" className="button-secondary mt-3 w-full" disabled={busy} onClick={forceFinalize}>强制收口并生成</button></div>}</section>
        {snapshot.prompts.length > 0 && <section className="card p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">提示词版本</h2></div><span className="muted">{snapshot.prompts.length}</span></div>{copyError && <ErrorNotice message={copyError} />}<div className="space-y-4">{snapshot.prompts.map((prompt) => <article key={prompt.id} className="rounded-2xl border border-ink/10 bg-paper/65 p-4"><div className="flex items-center justify-between gap-3"><span className="tag">{prompt.target}</span><button type="button" className="button-quiet" onClick={() => copyPrompt(prompt)}>{copied === prompt.id ? "已复制" : "复制"}</button></div><p className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate">{prompt.content}</p></article>)}</div></section>}
      </aside>
    </div>
  </div>;
}
