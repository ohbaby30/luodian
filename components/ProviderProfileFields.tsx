"use client";

import React from "react";
import type { ProviderKind, ProviderOptions } from "@/lib/provider";
import { providerKindLabels } from "@/lib/provider";
import { ProviderOptionsFields } from "./ProviderOptionsFields";

export type ProviderProfileForm = {
  providerBaseUrl: string;
  providerModel: string;
  providerApiKey: string;
  hasApiKey: boolean;
  providerOptions: ProviderOptions;
};

type Props = {
  kind: ProviderKind;
  value: ProviderProfileForm;
  onChange: (value: ProviderProfileForm) => void;
};

export function ProviderProfileFields({ kind, value, onChange }: Props) {
  const addressLabel = kind === "metered" ? "普通 API 计量接口地址" : "Token/Coding Plan 接口地址";
  const modelLabel = kind === "metered" ? "普通 API 计量模型" : "Token/Coding Plan 模型";

  return <fieldset className="rounded-2xl border border-ink/10 bg-mist/45 p-4 sm:p-5">
    <legend className="px-1 text-base font-semibold text-ink">{providerKindLabels[kind]}</legend>
    <p className="muted mt-1 text-sm leading-6">{kind === "metered" ? "按量计费的普通 OpenAI-compatible API。" : "Token Plan 或 Coding Plan；具体请求格式可在高级兼容设置中调整。"}</p>
    <div className="mt-4 space-y-4">
      <label className="block"><span className="mb-2 block text-sm font-semibold">{addressLabel}</span><input className="input" type="url" value={value.providerBaseUrl} onChange={(event) => onChange({ ...value, providerBaseUrl: event.target.value })} placeholder="https://api.example.com/v1" /></label>
      <label className="block"><span className="mb-2 block text-sm font-semibold">{modelLabel}</span><input className="input" value={value.providerModel} onChange={(event) => onChange({ ...value, providerModel: event.target.value })} placeholder="填写模型名称" /></label>
      <label className="block"><span className="mb-2 block text-sm font-semibold">新的 API Key {value.hasApiKey && <span className="font-normal text-moss">（已保存，留空则保留）</span>}</span><input className="input" type="password" value={value.providerApiKey} onChange={(event) => onChange({ ...value, providerApiKey: event.target.value })} autoComplete="off" /></label>
      <ProviderOptionsFields value={value.providerOptions} onChange={(providerOptions) => onChange({ ...value, providerOptions })} />
    </div>
  </fieldset>;
}
