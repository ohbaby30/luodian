"use client";

import type { PromptTarget } from "@/lib/contracts";

export const targetLabels: Record<PromptTarget, string> = {
  general: "通用对话",
  coding: "Codex / 代码执行",
  research: "深度研究",
  creative: "内容创作",
  decision: "决策分析",
};

export function TargetSelect({ value, onChange }: { value: PromptTarget; onChange: (value: PromptTarget) => void }) {
  return (
    <select className="input" value={value} onChange={(event) => onChange(event.target.value as PromptTarget)}>
      {Object.entries(targetLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  );
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { draft: "待分析", clarifying: "正在补缺口", ready: "可以收口", finalized: "已有提示词", archived: "已归档" };
  return <span className="tag">{labels[status] || status}</span>;
}

export function Loading({ label = "正在整理…" }: { label?: string }) {
  return <div className="muted flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-apricot" />{label}</div>;
}

export function ErrorNotice({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{message}</div>;
}

