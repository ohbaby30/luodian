"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PromptTarget } from "@/lib/contracts";
import { ErrorNotice, TargetSelect } from "./Ui";

export default function NewIdeaForm() {
  const router = useRouter();
  const [rawText, setRawText] = useState(""); const [target, setTarget] = useState<PromptTarget>("general"); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText, target }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "无法保存想法。"); setBusy(false); return; }
    router.push(`/ideas/${data.idea.id}`);
  }
  return <form onSubmit={submit} className="card space-y-6 p-6 sm:p-8"><label className="block"><span className="mb-2 block text-sm font-semibold">你现在在想什么？</span><textarea className="textarea min-h-64" autoFocus required value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="先写最粗糙的版本。不需要完整，落点会帮你找缺口。" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">最后准备交给哪类 AI？</span><TargetSelect value={target} onChange={setTarget} /></label>{error && <ErrorNotice message={error} />}<div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className="button-quiet" onClick={() => router.push("/")}>先不写了</button><button className="button-primary" disabled={busy}>{busy ? "正在打开工作台…" : "开始补全"}</button></div></form>;
}

