import { z } from "zod";

export const providerKindSchema = z.enum(["metered", "plan"]);
export type ProviderKind = z.infer<typeof providerKindSchema>;
export const providerKinds = ["metered", "plan"] as const satisfies readonly ProviderKind[];
export const providerKindLabels: Record<ProviderKind, string> = {
  metered: "普通 API 计量",
  plan: "Token Plan / Coding Plan",
};

export type ProviderAuthMode = "auto" | "bearer" | "api-key" | "x-api-key";
export type ProviderTokenMode = "auto" | "max_tokens" | "max_completion_tokens";
export type ProviderJsonMode = "auto" | "enabled" | "disabled";
export type ProviderThinkingMode = "auto" | "enabled" | "disabled";

export interface ProviderOptions {
  authMode: ProviderAuthMode;
  tokenMode: ProviderTokenMode;
  jsonMode: ProviderJsonMode;
  thinkingMode: ProviderThinkingMode;
}

export interface ProviderProfile {
  providerBaseUrl: string;
  providerModel: string;
  providerApiKey: string | null;
  providerOptions: ProviderOptions;
}

export type ProviderProfiles = Record<ProviderKind, ProviderProfile>;

export interface ProviderProfileInput {
  providerBaseUrl: string;
  providerModel: string;
  providerApiKey?: string;
  providerOptions?: Partial<ProviderOptions> | null;
}

export function emptyProviderProfile(): ProviderProfile {
  return {
    providerBaseUrl: "",
    providerModel: "",
    providerApiKey: null,
    providerOptions: { ...DEFAULT_PROVIDER_OPTIONS },
  };
}

export function normalizeProviderProfile(value: unknown): ProviderProfile {
  const profile = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const apiKey = typeof profile.providerApiKey === "string" ? profile.providerApiKey.trim() : "";
  return {
    providerBaseUrl: typeof profile.providerBaseUrl === "string" ? profile.providerBaseUrl.trim() : "",
    providerModel: typeof profile.providerModel === "string" ? profile.providerModel.trim() : "",
    providerApiKey: apiKey || null,
    providerOptions: normalizeProviderOptions(profile.providerOptions),
  };
}

export function normalizeProviderProfiles(value: unknown): ProviderProfiles {
  const profiles = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    metered: normalizeProviderProfile(profiles.metered),
    plan: normalizeProviderProfile(profiles.plan),
  };
}

export function isProviderConfigured(profile: ProviderProfile | null | undefined): profile is ProviderProfile {
  return Boolean(profile?.providerBaseUrl && profile.providerModel && profile.providerApiKey);
}

export function configuredProviderKinds(profiles: Partial<ProviderProfiles> | null | undefined): ProviderKind[] {
  return providerKinds.filter((kind) => isProviderConfigured(profiles?.[kind]));
}

export class ProviderSelectionRequiredError extends Error {
  readonly code = "provider_selection_required";
  readonly status = 409;

  constructor(readonly availableProviderKinds: ProviderKind[]) {
    super("请选择要使用的 AI 接口。");
    this.name = "ProviderSelectionRequiredError";
  }
}

export interface ProviderRequestSettings {
  providerBaseUrl: string;
  providerModel: string;
  providerApiKey: string;
  providerOptions?: Partial<ProviderOptions> | null;
}

export interface ProviderRequestOptions {
  structured?: boolean;
}

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export const DEFAULT_PROVIDER_OPTIONS: ProviderOptions = {
  authMode: "auto",
  tokenMode: "auto",
  jsonMode: "auto",
  thinkingMode: "auto",
};

export const MAX_OUTPUT_TOKENS = 4096;

const authModes = ["auto", "bearer", "api-key", "x-api-key"] as const;
const tokenModes = ["auto", "max_tokens", "max_completion_tokens"] as const;
const jsonModes = ["auto", "enabled", "disabled"] as const;
const thinkingModes = ["auto", "enabled", "disabled"] as const;

function pickMode<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function normalizeProviderOptions(value: unknown): ProviderOptions {
  const options = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    authMode: pickMode(options.authMode, authModes, DEFAULT_PROVIDER_OPTIONS.authMode),
    tokenMode: pickMode(options.tokenMode, tokenModes, DEFAULT_PROVIDER_OPTIONS.tokenMode),
    jsonMode: pickMode(options.jsonMode, jsonModes, DEFAULT_PROVIDER_OPTIONS.jsonMode),
    thinkingMode: pickMode(options.thinkingMode, thinkingModes, DEFAULT_PROVIDER_OPTIONS.thinkingMode),
  };
}

export function completionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl.trim());
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`;
  return url.toString();
}

export function isTokenPlanBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.startsWith("token-plan-") && hostname.endsWith(".xiaomimimo.com");
  } catch {
    return false;
  }
}

function isMimoModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith("mimo-v2.5");
}

function isLongCat(settings: ProviderRequestSettings): boolean {
  return settings.providerBaseUrl.toLowerCase().includes("longcat") || settings.providerModel.toLowerCase().includes("longcat");
}

export function buildProviderRequest(
  settings: ProviderRequestSettings,
  messages: Array<{ role: "system" | "user"; content: string }>,
  requestOptions: ProviderRequestOptions = {},
): ProviderRequest {
  const options = normalizeProviderOptions(settings.providerOptions);
  const mimoModel = isMimoModel(settings.providerModel);
  const tokenPlan = isTokenPlanBaseUrl(settings.providerBaseUrl);
  const authMode = options.authMode === "auto" ? (tokenPlan ? "api-key" : "bearer") : options.authMode;
  const tokenMode = options.tokenMode === "auto"
    ? (mimoModel || tokenPlan ? "max_completion_tokens" : "max_tokens")
    : options.tokenMode;
  const jsonMode = options.jsonMode === "auto" ? (mimoModel ? "enabled" : "disabled") : options.jsonMode;
  const thinkingMode = options.thinkingMode === "auto"
    ? (mimoModel || isLongCat(settings) ? "disabled" : null)
    : options.thinkingMode;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authMode === "bearer") headers.Authorization = `Bearer ${settings.providerApiKey}`;
  if (authMode === "api-key") headers["api-key"] = settings.providerApiKey;
  if (authMode === "x-api-key") headers["x-api-key"] = settings.providerApiKey;

  const body: Record<string, unknown> = {
    model: settings.providerModel,
    messages,
    stream: false,
  };
  body[tokenMode] = MAX_OUTPUT_TOKENS;
  if (requestOptions.structured && jsonMode === "enabled") body.response_format = { type: "json_object" };
  if (thinkingMode) body.thinking = { type: thinkingMode };

  return { url: completionsUrl(settings.providerBaseUrl), headers, body };
}
