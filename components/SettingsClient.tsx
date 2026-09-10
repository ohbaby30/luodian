"use client";

import { useEffect, useState } from "react";
import { ErrorNotice, Loading } from "./Ui";

type Profile = { principles: string[]; preferences: string[]; constraints: string[]; doNotDo: string[]; defaultContext: string };
type Feedback = { kind: "success" | "error"; message: string };

function FeedbackNotice({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  const isError = feedback.kind === "error";
  return <div role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className={isError ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" : "rounded-2xl border border-moss/20 bg-mist px-4 py-3 text-sm leading-6 text-moss"}>{feedback.message}</div>;
}
const blankProfile: Profile = { principles: [], preferences: [], constraints: [], doNotDo: [], defaultContext: "" };
const join = (values: string[]) => values.join("\n");
const split = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

export default function SettingsClient() {
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [provider, setProvider] = useState({ providerBaseUrl: "", providerModel: "", providerApiKey: "", hasApiKey: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profileFeedback, setProfileFeedback] = useState<Feedback | null>(null);
  const [providerFeedback, setProviderFeedback] = useState<Feedback | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback | null>(null);

  useEffect(() => { Promise.all([fetch("/api/profile").then((r) => r.json()), fetch("/api/provider").then((r) => r.json())]).then(([p, a]) => { if (p.error || a.error) throw new Error(p.error || a.error); setProfile(p.profile); setProvider({ ...a, providerApiKey: "" }); }).catch((e) => setLoadError(e instanceof Error ? e.message : "无法读取设置。")).finally(() => setLoading(false)); }, []);
  async function saveProfile(event: React.FormEvent) { event.preventDefault(); setProfileFeedback(null); try { const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }); const data = await response.json(); if (!response.ok) setProfileFeedback({ kind: "error", message: data.error || "个人规则保存失败。" }); else setProfileFeedback({ kind: "success", message: "个人规则已保存。" }); } catch { setProfileFeedback({ kind: "error", message: "个人规则保存失败，请稍后重试。" }); } }
  async function saveProvider(event: React.FormEvent) { event.preventDefault(); setProviderFeedback(null); try { const response = await fetch("/api/provider", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(provider) }); const data = await response.json(); if (!response.ok) setProviderFeedback({ kind: "error", message: data.error || "AI 设置保存失败。" }); else { setProvider({ ...provider, providerApiKey: "", hasApiKey: provider.hasApiKey || Boolean(provider.providerApiKey.trim()) }); setProviderFeedback({ kind: "success", message: "AI 设置已保存。" }); } } catch { setProviderFeedback({ kind: "error", message: "AI 设置保存失败，请稍后重试。" }); } }
  async function testProvider() { setProviderFeedback(null); try { const response = await fetch("/api/provider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(provider) }); const data = await response.json(); if (!response.ok) setProviderFeedback({ kind: "error", message: data.error || "AI 接口连接测试失败。" }); else setProviderFeedback({ kind: "success", message: "AI 接口连接测试成功。" }); } catch { setProviderFeedback({ kind: "error", message: "AI 接口连接测试失败，请稍后重试。" }); } }
  async function changePassword(event: React.FormEvent) { event.preventDefault(); setPasswordFeedback(null); try { const response = await fetch("/api/auth/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(passwordForm) }); const data = await response.json(); if (!response.ok) setPasswordFeedback({ kind: "error", message: data.error || "访问密码修改失败。" }); else { setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPasswordFeedback({ kind: "success", message: "访问密码已修改。当前登录仍然有效。" }); } } catch { setPasswordFeedback({ kind: "error", message: "访问密码修改失败，请稍后重试。" }); } }
  if (loading) return <Loading />;
  if (loadError) return <ErrorNotice message={loadError} />;
  return (
    <div className="w-full max-w-3xl space-y-8">
      <div>
        <p className="eyebrow mb-3">Personal rules</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">让落点更像你</h1>
        <p className="muted mt-3">这些规则会参与每一次分析，但不会替你确认事实。</p>
      </div>

      <form onSubmit={saveProfile} className="card space-y-5 p-4 sm:p-6">
        <h2 className="section-title">个人规则档案</h2>
        <p className="muted">每行写一条。比如：我重视证据，不喜欢夸张承诺。</p>
        <label className="block"><span className="mb-2 block text-sm font-semibold">原则</span><textarea className="textarea min-h-24" value={join(profile.principles)} onChange={(e) => setProfile({ ...profile, principles: split(e.target.value) })} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">表达偏好</span><textarea className="textarea min-h-24" value={join(profile.preferences)} onChange={(e) => setProfile({ ...profile, preferences: split(e.target.value) })} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">固定限制</span><textarea className="textarea min-h-24" value={join(profile.constraints)} onChange={(e) => setProfile({ ...profile, constraints: split(e.target.value) })} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">不要做什么</span><textarea className="textarea min-h-24" value={join(profile.doNotDo)} onChange={(e) => setProfile({ ...profile, doNotDo: split(e.target.value) })} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">默认背景</span><textarea className="textarea min-h-24" value={profile.defaultContext} onChange={(e) => setProfile({ ...profile, defaultContext: e.target.value })} /></label>
        <FeedbackNotice feedback={profileFeedback} />
        <button className="button-primary w-full sm:w-auto">保存个人规则</button>
      </form>

      <form onSubmit={changePassword} className="card space-y-5 p-4 sm:p-6">
        <div><h2 className="section-title">访问密码</h2><p className="muted mt-2">修改后当前登录不会退出；下次登录请使用新密码。</p></div>
        <label className="block"><span className="mb-2 block text-sm font-semibold">当前密码</span><input className="input" type="password" required autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">新密码</span><input className="input" type="password" minLength={8} required autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} placeholder="至少 8 位" /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">确认新密码</span><input className="input" type="password" minLength={8} required autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} /></label>
        <FeedbackNotice feedback={passwordFeedback} />
        <button className="button-primary w-full sm:w-auto">修改访问密码</button>
      </form>

      <form onSubmit={saveProvider} className="card space-y-5 p-4 sm:p-6">
        <div><h2 className="section-title">AI 接口</h2><p className="muted mt-2">API Key 只在保存时提交，网页不会回显已保存的 Key。</p></div>
        <label className="block"><span className="mb-2 block text-sm font-semibold">接口地址</span><input className="input" type="url" required value={provider.providerBaseUrl} onChange={(e) => setProvider({ ...provider, providerBaseUrl: e.target.value })} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">模型</span><input className="input" required value={provider.providerModel} onChange={(e) => setProvider({ ...provider, providerModel: e.target.value })} /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">新的 API Key {provider.hasApiKey && <span className="font-normal text-moss">（已保存，留空则保留）</span>}</span><input className="input" type="password" value={provider.providerApiKey} onChange={(e) => setProvider({ ...provider, providerApiKey: e.target.value })} /></label>
        <div className="flex flex-col gap-3 sm:flex-row"><button type="button" className="button-secondary w-full sm:w-auto" onClick={testProvider}>测试连接</button><button className="button-primary w-full sm:w-auto">保存 AI 设置</button></div>
        <FeedbackNotice feedback={providerFeedback} />
      </form>
    </div>
  );
}
