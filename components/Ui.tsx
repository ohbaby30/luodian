"use client";

import React from "react";
import type { PromptTarget } from "@/lib/contracts";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const repositoryUrl = "https://github.com/ohbaby30/luodian";

export function SourceLink() {
  return (
    <a className="source-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer" aria-label="打开 GitHub 源码" title="GitHub 源码">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.59 2 12.253c0 4.534 2.865 8.376 6.839 9.735.5.094.682-.223.682-.497 0-.245-.009-.894-.014-1.755-2.782.618-3.369-1.373-3.369-1.373-.455-1.184-1.11-1.5-1.11-1.5-.908-.636.069-.623.069-.623 1.004.072 1.532 1.057 1.532 1.057.892 1.566 2.341 1.114 2.91.852.091-.663.349-1.114.635-1.37-2.22-.26-4.555-1.14-4.555-5.077 0-1.122.39-2.039 1.03-2.758-.103-.26-.446-1.305.098-2.72 0 0 .84-.276 2.75 1.052A9.24 9.24 0 0 1 12 6.978a9.24 9.24 0 0 1 2.504.35c1.91-1.328 2.748-1.052 2.748-1.052.546 1.415.203 2.46.1 2.72.64.719 1.028 1.636 1.028 2.758 0 3.947-2.339 4.814-4.566 5.068.359.317.678.944.678 1.904 0 1.374-.012 2.48-.012 2.817 0 .277.18.597.688.496C19.138 20.625 22 16.783 22 12.253 22 6.59 17.523 2 12 2Z" />
      </svg>
      <span className="sr-only">源码</span>
    </a>
  );
}

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

type BusyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  busy: boolean;
  busyLabel: ReactNode;
  children: ReactNode;
};

export function BusyButton({ busy, busyLabel, children, className = "", disabled, ...props }: BusyButtonProps) {
  return <button {...props} className={className} disabled={busy || disabled} aria-busy={busy}>
    {busy && <span className="thinking-spinner" aria-hidden="true" />}
    <span>{busy ? busyLabel : children}</span>
  </button>;
}

export function ErrorNotice({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{message}</div>;
}
