"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import { ErrorNotice, Loading, StatusPill, targetLabels } from "./Ui";
import type { PromptTarget } from "@/lib/contracts";

type Idea = { id: string; title: string; rawText: string; target: PromptTarget; status: string; updatedAt: string };

export default function HomeClient() {
  const [state, setState] = useState<{ loading: boolean; initialized?: boolean; authenticated?: boolean; ideas: Idea[]; error?: string }>({ loading: true, ideas: [] });

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((response) => response.json())
      .then((data) => {
        if (!data.initialized) window.location.href = "/setup";
        else if (!data.authenticated) window.location.href = "/login";
        else setState({ loading: false, ...data });
      })
      .catch(() => setState({ loading: false, ideas: [], error: "无法读取落点状态。" }));
  }, []);

  if (state.loading) return <main className="shell"><div className="shell-inner pt-32"><Loading label="正在打开落点…" /></div></main>;
  if (state.error) return <main className="shell"><div className="shell-inner pt-32"><ErrorNotice message={state.error} /></div></main>;

  return (
    <AppShell>
      <section className="mb-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="eyebrow mb-4">Idea → Clarity → Prompt</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">先把想法写下来，<span className="text-apricot">再决定它该走多远。</span></h1>
          <p className="muted mt-6 max-w-2xl text-base">落点会帮你拆开事实、假设和缺口；它只追问真正会改变结果的问题，最后给你一份可以直接交给 AI 的提示词。</p>
        </div>
        <div className="card flex items-center justify-between gap-4 p-5">
          <div><p className="text-sm font-semibold">新的想法</p><p className="muted mt-1">从一句还不完整的话开始。</p></div>
          <Link className="button-primary whitespace-nowrap" href="/ideas/new">写下来 <span className="ml-2">↗</span></Link>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between"><div><p className="eyebrow mb-2">Your desk</p><h2 className="section-title">最近的想法</h2></div><span className="muted">{state.ideas.length} 个开放记录</span></div>
        {state.ideas.length === 0 ? (
          <div className="card border-dashed p-10 text-center"><p className="text-lg font-semibold">这里还没有开放的想法</p><p className="muted mx-auto mt-2 max-w-md">不用等它成熟。把最粗糙的版本交给落点，第一步只是让它有一个落脚处。</p><Link href="/ideas/new" className="button-secondary mt-6">开始第一条</Link></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{state.ideas.map((idea) => <Link key={idea.id} href={`/ideas/${idea.id}`} className="list-item block"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold leading-6">{idea.title}</h3><StatusPill status={idea.status} /></div><p className="muted mt-3 line-clamp-3">{idea.rawText}</p><div className="mt-5 flex items-center justify-between text-xs text-slate"><span>{targetLabels[idea.target]}</span><span>{new Date(idea.updatedAt).toLocaleDateString("zh-CN")}</span></div></Link>)}</div>
        )}
      </section>
    </AppShell>
  );
}

