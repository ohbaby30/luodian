"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNotice } from "./Ui";
import { ProviderProfileFields, type ProviderProfileForm } from "./ProviderProfileFields";
import { DEFAULT_PROVIDER_OPTIONS, providerKinds, type ProviderKind } from "@/lib/provider";

type ProviderProfilesForm = Record<ProviderKind, ProviderProfileForm>;

function blankProviderProfile(): ProviderProfileForm {
  return { providerBaseUrl: "", providerModel: "", providerApiKey: "", hasApiKey: false, providerOptions: { ...DEFAULT_PROVIDER_OPTIONS } };
}

function providerPayload(value: ProviderProfileForm) {
  return { providerBaseUrl: value.providerBaseUrl, providerModel: value.providerModel, providerApiKey: value.providerApiKey, providerOptions: value.providerOptions };
}

export default function SetupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<ProviderProfilesForm>({
    metered: { ...blankProviderProfile(), providerBaseUrl: "https://api.openai.com/v1" },
    plan: blankProviderProfile(),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, profiles: { metered: providerPayload(profiles.metered), plan: providerPayload(profiles.plan) } }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "初始化失败。"); else router.push("/");
    setBusy(false);
  }

  return <form onSubmit={submit} className="card space-y-5 p-6 sm:p-8">
    {error && <ErrorNotice message={error} />}
    <label className="block"><span className="mb-2 block text-sm font-semibold">落点访问密码</span><input className="input" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" /></label>
    <div className="border-t border-ink/10 pt-5"><p className="text-sm font-semibold">AI 接口</p><p className="muted mt-1">普通 API 和 Token/Coding Plan 可以只填写一组，也可以同时填写；Key 会加密保存在服务器数据卷。</p></div>
    {providerKinds.map((kind) => <ProviderProfileFields key={kind} kind={kind} value={profiles[kind]} onChange={(value) => setProfiles({ ...profiles, [kind]: value })} />)}
    <button className="button-primary w-full" disabled={busy}>{busy ? "正在建立落点…" : "完成初始化"}</button>
  </form>;
}
