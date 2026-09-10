"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "./Ui";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "登录失败。"); else { router.push("/"); router.refresh(); }
    setBusy(false);
  }
  return <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8">{error && <ErrorNotice message={error} />}<label className="block"><span className="mb-2 block text-sm font-semibold">访问密码</span><input className="input" type="password" required autoFocus value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button-primary w-full" disabled={busy}>{busy ? "验证中…" : "进入落点"}</button></form>;
}

