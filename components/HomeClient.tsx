"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import { ErrorNotice, Loading, StatusPill, targetLabels } from "./Ui";
import { groupIdeas, type HomeIdea } from "@/lib/home";
import type { PromptTarget } from "@/lib/contracts";

type Idea = HomeIdea & { title: string; rawText: string; target: PromptTarget; status: string; createdAt: string; updatedAt: string };

export default function HomeClient() {
  const [state, setState] = useState<{ loading: boolean; ideas: Idea[]; error?: string }>({ loading: true, ideas: [] });

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((response) => response.json())
      .then((data) => {
        if (!data.initialized) window.location.href = "/setup";
        else if (!data.authenticated) window.location.href = "/login";
        else setState({ loading: false, ideas: data.ideas ?? [] });
      })
      .catch(() => setState({ loading: false, ideas: [], error: "无法读取落点状态。" }));
  }, []);

  if (state.loading) return <main className="shell"><div className="shell-inner pt-32"><Loading label="正在打开落点…" /></div></main>;
  if (state.error) return <main className="shell"><div className="shell-inner pt-32"><ErrorNotice message={state.error} /></div></main>;

  const groupedIdeas = groupIdeas(state.ideas);
  const ideaGroups = [
    { key: "open", title: "待收口想法", eyebrow: "现在要推进的", ideas: groupedIdeas.open, open: true, empty: "还没有待推进的想法。" },
    { key: "closed", title: "已收口想法", eyebrow: "已经放下的", ideas: groupedIdeas.closed, open: false, empty: "生成最终提示词的想法会收在这里。" },
  ];

  return (
    <AppShell>
      <section className="home-layout mb-12">
        <div className="home-copy">
          <p className="eyebrow mb-4">想法 → 澄清 → 提示词</p>
          <h1 className="display-title max-w-3xl text-4xl sm:text-5xl"><span className="block">先把想法写下来，</span><span className="block text-apricot">再决定它该走多远。</span></h1>
          <p className="muted mt-6 max-w-2xl text-base">落点会帮你拆开事实、假设和缺口；它只追问真正会改变结果的问题，最后给你一份可以直接交给 AI 的提示词。</p>
          <div className="card home-new-idea mt-8 flex items-center justify-between gap-4 p-5">
            <div><p className="text-sm font-semibold">新的想法</p><p className="muted mt-1">从一句还不完整的话开始。</p></div>
            <Link className="button-primary whitespace-nowrap" href="/ideas/new">写下来 <span className="ml-2">↗</span></Link>
          </div>
        </div>

        <section className="home-desk card p-5" aria-labelledby="idea-desk-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><p className="eyebrow mb-2">想法桌面</p><h2 id="idea-desk-title" className="section-title">把想法放在可推进的位置</h2></div>
            <span className="muted whitespace-nowrap">{groupedIdeas.open.length + groupedIdeas.closed.length} 条</span>
          </div>
          <div className="space-y-3">
            {ideaGroups.map((group) => (
              <details key={group.key} className="idea-group" open={group.open}>
                <summary className="idea-group__summary">
                  <span><span className="eyebrow block mb-1">{group.eyebrow}</span><span className="text-base font-semibold text-ink">{group.title}</span></span>
                  <span className="flex items-center gap-3"><span className="tag">{group.ideas.length}</span><span className="idea-group__chevron" aria-hidden="true">⌄</span></span>
                </summary>
                <div className="space-y-3 pt-3">
                  {group.ideas.length === 0 ? (
                    <div className="idea-empty"><p className="text-sm font-semibold">{group.empty}</p><p className="muted mt-1">{group.key === "open" ? "不用等它成熟，先写下来就好。" : ""}</p></div>
                  ) : (
                    group.ideas.map((idea) => (
                      <Link key={idea.id} href={`/ideas/${idea.id}`} className="list-item block">
                        <div className="flex items-start justify-between gap-3"><h3 className="font-semibold leading-6">{idea.title}</h3><StatusPill status={idea.status} /></div>
                        <div className="mt-5 flex items-center justify-between text-xs text-slate"><span>{targetLabels[idea.target]}</span><span>{new Date(idea.createdAt).toLocaleDateString("zh-CN")}</span></div>
                      </Link>
                    ))
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
