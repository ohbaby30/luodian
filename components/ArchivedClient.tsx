"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorNotice, Loading, StatusPill, targetLabels } from "./Ui";
import type { PromptTarget } from "@/lib/contracts";

export type ArchivedIdea = {
  id: string;
  title: string;
  target: PromptTarget;
  status: string;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
};

type Feedback = { kind: "success" | "error"; message: string };

function FeedbackNotice({ feedback }: { feedback: Feedback | null | undefined }) {
  if (!feedback) return null;
  const isError = feedback.kind === "error";
  return <div role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className={isError ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" : "rounded-2xl border border-moss/20 bg-mist px-4 py-3 text-sm leading-6 text-moss"}>{feedback.message}</div>;
}

function ideaDate(idea: ArchivedIdea): string {
  return new Date(idea.archivedAt ?? idea.updatedAt ?? idea.createdAt).toLocaleDateString("zh-CN");
}

export function ArchivedIdeasList({
  ideas,
  onDelete,
  onDeleteAll,
  deletingId,
  deletingAll,
  feedback,
}: {
  ideas: ArchivedIdea[];
  onDelete: (idea: ArchivedIdea) => void;
  onDeleteAll: () => void;
  deletingId: string | null;
  deletingAll: boolean;
  feedback?: Feedback | null;
}) {
  const busy = Boolean(deletingId) || deletingAll;
  return (
    <div className="w-full max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">想法档案</p>
          <h1 className="display-title text-3xl sm:text-4xl">已归档想法</h1>
          <p className="muted mt-3">这里保存已经归档的想法。删除后连同它的问答、分析和提示词版本一起移除。</p>
        </div>
        <button type="button" className="button-danger shrink-0" disabled={ideas.length === 0 || busy} onClick={onDeleteAll}>全部删除</button>
      </div>

      <div className="mb-5"><FeedbackNotice feedback={feedback} /></div>

      {ideas.length === 0 ? (
        <div className="card border-dashed p-10 text-center"><p className="text-lg font-semibold">还没有已归档的想法</p><p className="muted mx-auto mt-2 max-w-md">在想法详情页归档后，它会出现在这里。</p></div>
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => (
            <div key={idea.id} className="list-item flex items-center gap-4">
              <Link href={`/ideas/${idea.id}`} className="min-w-0 flex-1 no-underline">
                <div className="flex items-start justify-between gap-3"><h2 className="truncate font-semibold leading-6">{idea.title}</h2><StatusPill status={idea.status} /></div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate"><span>{targetLabels[idea.target]}</span><span className="shrink-0">归档于 {ideaDate(idea)}</span></div>
              </Link>
              <button type="button" className="button-danger shrink-0" disabled={busy} onClick={() => onDelete(idea)} aria-label={`删除已归档想法：${idea.title}`}>{deletingId === idea.id ? "删除中…" : "删除"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArchivedClient() {
  const [ideas, setIdeas] = useState<ArchivedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/archived-ideas")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "无法读取已归档想法。");
        return data;
      })
      .then((data) => {
        if (!cancelled) setIdeas(data.ideas ?? []);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "无法读取已归档想法。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function deleteIdea(idea: ArchivedIdea) {
    if (deletingId || deletingAll) return;
    if (!window.confirm(`确定永久删除“${idea.title}”吗？它的问答、分析和提示词版本也会一起删除。`)) return;
    setDeletingId(idea.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/archived-ideas/${encodeURIComponent(idea.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除已归档想法失败。");
      setIdeas((current) => current.filter((item) => item.id !== idea.id));
      setFeedback({ kind: "success", message: `已删除“${idea.title}”。` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "删除已归档想法失败，请稍后重试。" });
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteAll() {
    if (ideas.length === 0 || deletingId || deletingAll) return;
    if (!window.confirm(`确定永久删除全部 ${ideas.length} 条已归档想法吗？此操作不可恢复。`)) return;
    setDeletingAll(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/archived-ideas", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除全部已归档想法失败。");
      setIdeas([]);
      setFeedback({ kind: "success", message: `已删除 ${data.deletedCount ?? ideas.length} 条已归档想法。` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "删除全部已归档想法失败，请稍后重试。" });
    } finally {
      setDeletingAll(false);
    }
  }

  if (loading) return <Loading label="正在读取已归档想法…" />;
  if (loadError) return <ErrorNotice message={loadError} />;
  return <ArchivedIdeasList ideas={ideas} onDelete={deleteIdea} onDeleteAll={deleteAll} deletingId={deletingId} deletingAll={deletingAll} feedback={feedback} />;
}
