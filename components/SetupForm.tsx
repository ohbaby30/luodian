"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "./Ui";

export default function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ password: "", providerBaseUrl: "https://api.openai.com/v1", providerModel: "", providerApiKey: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "初始化失败。"); else router.push("/");
    setBusy(false);
  }

  return <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8">
    {error && <ErrorNotice message={error} />}
    <label className="block"><span className="mb-2 block text-sm font-semibold">落点访问密码</span><input className="input" type="password" minLength={8} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="至少 8 位" /></label>
    <div className="border-t border-ink/10 pt-5"><p className="text-sm font-semibold">AI 接口</p><p className="muted mt-1">落点使用兼容 OpenAI Chat Completions 的接口；Key 会加密保存在服务器数据卷。</p></div>
    <label className="block"><span className="mb-2 block text-sm font-semibold">接口地址</span><input className="input" type="url" required value={form.providerBaseUrl} onChange={(event) => setForm({ ...form, providerBaseUrl: event.target.value })} /></label>
    <label className="block"><span className="mb-2 block text-sm font-semibold">模型名称</span><input className="input" required value={form.providerModel} onChange={(event) => setForm({ ...form, providerModel: event.target.value })} placeholder="例如：gpt-4o-mini" /></label>
    <label className="block"><span className="mb-2 block text-sm font-semibold">API Key</span><input className="input" type="password" required value={form.providerApiKey} onChange={(event) => setForm({ ...form, providerApiKey: event.target.value })} /></label>
    <button className="button-primary w-full" disabled={busy}>{busy ? "正在建立落点…" : "完成初始化"}</button>
  </form>;
}

