"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult, PromptTarget } from "@/lib/contracts";
import type { IdeaRecord, PromptRecord, TurnRecord } from "@/lib/repository";
import { copyText } from "@/lib/copy";
import { ErrorNotice, Loading, StatusPill, TargetSelect } from "./Ui";

type Snapshot = { idea: IdeaRecord; analysis: AnalysisResult | null; turns: TurnRecord[]; prompts: PromptRecord[] };

function ListBlock({ title, values }: { title: string; values: string[] }) {
  return <div><h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>{values.length ? <ul className="space-y-2">{values.map((value, index) => <li key={`${value}-${index}`} className="text-sm leading-6 text-slate">{value}</li>)}</ul> : <p className="text-sm text-slate/60">暂无</p>}</div>;
}

export default function IdeaWorkspace({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [answer, setAnswer] = useState(""); const [target, setTarget] = useState<PromptTarget>("general"); const [includeExtensions, setIncludeExtensions] = useState(false); const [copied, setCopied] = useState(""); const [copyError, setCopyError] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/ideas/${id}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "无法读取想法。"); setSnapshot(data); setTarget(data.idea.target); return data as Snapshot; }, [id]);
  useEffect(() => { load().then(async (data) => { if (data.analysis) return data; const response = await fetch(`/api/ideas/${id}/analyze`, { method: "POST" }); const next = await response.json(); if (!response.ok) throw new Error(next.error || "无法分析这个想法。"); setSnapshot(next); return next; }).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [id, load]);
  if (loading) return <Loading label="正在整理你的想法…" />;
  if (error && !snapshot) return <ErrorNotice message={error} />;
  if (!snapshot) return <ErrorNotice message="找不到这个想法。" />;
  const analysis = snapshot.analysis;
  const openTurn = snapshot.turns.find((turn) => !turn.answer);
  async function sendAnswer(event: React.FormEvent) { event.preventDefault(); if (!openTurn || !answer.trim()) return; setBusy(true); setError(""); const response = await fetch(`/api/ideas/${id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId: openTurn.id, answer }) }); const data = await response.json(); if (!response.ok) setError(data.error || "回答没有保存。"); else { setSnapshot(data); setAnswer(""); } setBusy(false); }
  async function finalize(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); const response = await fetch(`/api/ideas/${id}/finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, includeExtensions }) }); const data = await response.json(); if (!response.ok) setError(data.error || "生成提示词失败。"); else setSnapshot(data.snapshot); setBusy(false); }
  async function archive() { if (!confirm("把这条想法归档吗？归档后仍保留在数据里。")) return; await fetch(`/api/ideas/${id}`, { method: "PATCH" }); window.location.href = "/"; }
  async function copyPrompt(prompt: PromptRecord) { setCopyError(""); try { await copyText(prompt.content); setCopied(prompt.id); window.setTimeout(() => setCopied(""), 1600); } catch (copyFailure) { setCopyError(copyFailure instanceof Error ? copyFailure.message : "复制失败，请长按文本选择复制。"); } }

  return <div className="space-y-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/" className="muted hover:text-ink">← 返回想法</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{snapshot.idea.title}</h1><StatusPill status={snapshot.idea.status} /></div></div><div className="flex gap-2"><a className="button-secondary" href={`/api/ideas/${id}/export`}>导出 Markdown</a><button className="button-quiet" onClick={archive}>归档</button></div></div>
    {error && <ErrorNotice message={error} />}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="space-y-6"><section className="card p-6"><p className="eyebrow mb-3">Raw thought</p><p className="whitespace-pre-wrap text-base leading-8">{snapshot.idea.rawText}</p></section>
        {openTurn && <section className="card border-apricot/30 p-6"><p className="eyebrow mb-3">The next useful question</p><h2 className="text-xl font-semibold leading-8">{openTurn.question}</h2><p className="muted mt-3">为什么问：{openTurn.reason}</p><form onSubmit={sendAnswer} className="mt-5 space-y-3"><textarea className="textarea min-h-32" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="回答这个问题，不需要写得漂亮。" /><button className="button-primary" disabled={busy || !answer.trim()}>{busy ? "继续整理…" : "回答并继续"}</button></form></section>}
        {analysis && <section className="card p-6"><div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow mb-2">Working map</p><h2 className="section-title">当前理解</h2></div><span className="tag">置信度：{analysis.confidence}</span></div><div className="grid gap-6 sm:grid-cols-2"><ListBlock title="目标" values={[analysis.objective || "暂无"]} /><ListBlock title="使用者" values={[analysis.audience || "暂无"]} /><ListBlock title="已确认事实" values={analysis.facts} /><ListBlock title="当前假设" values={analysis.assumptions} /><ListBlock title="约束" values={analysis.constraints} /><ListBlock title="缺口 / 矛盾" values={[...analysis.gaps, ...analysis.contradictions]} /><ListBlock title="风险" values={analysis.risks} /><ListBlock title="验收标准" values={analysis.acceptanceCriteria} /></div></section>}
      </div>
      <aside className="space-y-6"><section className="card p-6"><p className="eyebrow mb-3">Close the loop</p><h2 className="section-title">把它收口成提示词</h2><p className="muted mt-3">必要缺口会先变成一个关键问题；回答完成、分析显示“可以收口”后，才能生成最终版本。</p>{analysis?.optionalExtensions?.length ? <label className="mt-5 flex gap-3 rounded-2xl bg-mist/70 p-4 text-sm leading-6"><input className="mt-1" type="checkbox" checked={includeExtensions} onChange={(event) => setIncludeExtensions(event.target.checked)} /><span><strong>加入可选延伸</strong><br /><span className="text-slate">仅在你明确选择时，才会写进最终提示词。</span></span></label> : null}<form onSubmit={finalize} className="mt-5 space-y-3"><label className="block"><span className="mb-2 block text-sm font-semibold">提示词用途</span><TargetSelect value={target} onChange={setTarget} /></label><button className="button-primary w-full" disabled={busy || !analysis || analysis.status !== "ready" || Boolean(openTurn)}>{busy ? "正在生成…" : "生成最终提示词"}</button></form></section>
        {snapshot.prompts.length > 0 && <section className="card p-6"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow mb-2">Versions</p><h2 className="section-title">提示词版本</h2></div><span className="muted">{snapshot.prompts.length}</span></div>{copyError && <ErrorNotice message={copyError} />}<div className="space-y-4">{snapshot.prompts.map((prompt) => <article key={prompt.id} className="rounded-2xl border border-ink/10 bg-white/70 p-4"><div className="flex items-center justify-between gap-3"><span className="tag">{prompt.target}</span><button type="button" className="button-quiet" onClick={() => copyPrompt(prompt)}>{copied === prompt.id ? "已复制" : "复制"}</button></div><p className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate">{prompt.content}</p></article>)}</div></section>}
      </aside>
    </div>
  </div>;
}
