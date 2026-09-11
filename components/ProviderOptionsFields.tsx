"use client";

import React from "react";
import type { ProviderAuthMode, ProviderJsonMode, ProviderOptions, ProviderThinkingMode, ProviderTokenMode } from "@/lib/provider";

type Props = {
  value: ProviderOptions;
  onChange: (value: ProviderOptions) => void;
};

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><select className="input" value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

const authOptions: Array<{ value: ProviderAuthMode; label: string }> = [
  { value: "auto", label: "自动识别（推荐）" },
  { value: "bearer", label: "Authorization Bearer" },
  { value: "api-key", label: "api-key" },
  { value: "x-api-key", label: "x-api-key" },
];

const tokenOptions: Array<{ value: ProviderTokenMode; label: string }> = [
  { value: "auto", label: "自动识别（推荐）" },
  { value: "max_tokens", label: "max_tokens" },
  { value: "max_completion_tokens", label: "max_completion_tokens" },
];

const jsonOptions: Array<{ value: ProviderJsonMode; label: string }> = [
  { value: "auto", label: "自动识别（推荐）" },
  { value: "enabled", label: "启用 JSON mode" },
  { value: "disabled", label: "关闭 JSON mode" },
];

const thinkingOptions: Array<{ value: ProviderThinkingMode; label: string }> = [
  { value: "auto", label: "自动识别（推荐）" },
  { value: "disabled", label: "关闭 thinking" },
  { value: "enabled", label: "启用 thinking" },
];

export function ProviderOptionsFields({ value, onChange }: Props) {
  return <details className="rounded-2xl border border-ink/10 bg-mist/60 p-4">
    <summary className="cursor-pointer text-sm font-semibold">高级兼容设置</summary>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <SelectField label="鉴权方式" value={value.authMode} options={authOptions} onChange={(authMode) => onChange({ ...value, authMode })} />
      <SelectField label="最大输出参数" value={value.tokenMode} options={tokenOptions} onChange={(tokenMode) => onChange({ ...value, tokenMode })} />
      <SelectField label="JSON mode" value={value.jsonMode} options={jsonOptions} onChange={(jsonMode) => onChange({ ...value, jsonMode })} />
      <SelectField label="thinking" value={value.thinkingMode} options={thinkingOptions} onChange={(thinkingMode) => onChange({ ...value, thinkingMode })} />
    </div>
    <p className="muted mt-4 text-sm leading-6">默认自动识别常见接口；其他 Token/Coding Plan 可按服务商文档覆盖鉴权头和请求参数。普通 OpenAI 兼容接口保持 Bearer + max_tokens。</p>
  </details>;
}
