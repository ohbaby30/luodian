import { randomUUID } from "node:crypto";
import { getDb, json, nowIso, parseJson, type SqlParam } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { normalizeAnalysisResult, profileSchema, type AnalysisResult, type Profile, type PromptTarget } from "./contracts";
import {
  configuredProviderKinds,
  emptyProviderProfile,
  isProviderConfigured,
  isTokenPlanBaseUrl,
  normalizeProviderOptions,
  normalizeProviderProfile,
  normalizeProviderProfiles,
  providerKinds,
  type ProviderKind,
  type ProviderOptions,
  type ProviderProfile,
  type ProviderProfileInput,
  type ProviderProfiles,
} from "./provider";

export type IdeaStatus = "draft" | "clarifying" | "ready" | "finalized" | "archived";

export interface SettingsRecord {
  adminPasswordHash: string | null;
  providerBaseUrl: string | null;
  providerModel: string | null;
  providerApiKey: string | null;
  providerOptions?: ProviderOptions;
  providerProfiles?: ProviderProfiles;
  profile: Profile;
}

export interface IdeaRecord {
  id: string;
  title: string;
  rawText: string;
  target: PromptTarget;
  status: IdeaStatus;
  latestAnalysis: AnalysisResult | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  providerKind?: ProviderKind | null;
}

export type TurnResolution = "pending" | "answered" | "delegated";

export interface TurnRecord {
  id: string;
  ideaId: string;
  question: string;
  reason: string;
  answer: string | null;
  sequence: number;
  createdAt: string;
  answeredAt: string | null;
  resolution: TurnResolution;
}

export interface PromptRecord {
  id: string;
  ideaId: string;
  target: PromptTarget;
  content: string;
  analysis: AnalysisResult;
  includeExtensions: boolean;
  createdAt: string;
}

type SettingsRow = {
  admin_password_hash: string | null;
  provider_base_url: string | null;
  provider_model: string | null;
  provider_api_key: string | null;
  provider_options_json: string | null;
  provider_profiles_json: string | null;
  profile_json: string;
};

type IdeaRow = {
  id: string;
  title: string;
  raw_text: string;
  target: PromptTarget;
  status: IdeaStatus;
  latest_analysis_json: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  provider_kind: ProviderKind | null;
};

function settingsRow(): SettingsRow {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get() as SettingsRow;
}

function hasProviderData(profile: ProviderProfile): boolean {
  return Boolean(profile.providerBaseUrl || profile.providerModel || profile.providerApiKey);
}

function legacyProviderProfile(row: SettingsRow): ProviderProfile {
  return normalizeProviderProfile({
    providerBaseUrl: row.provider_base_url,
    providerModel: row.provider_model,
    providerApiKey: decryptSecret(row.provider_api_key),
    providerOptions: normalizeProviderOptions(parseJson(row.provider_options_json, {})),
  });
}

function legacyProviderKind(profile: ProviderProfile): ProviderKind {
  const options = profile.providerOptions;
  return isTokenPlanBaseUrl(profile.providerBaseUrl)
    || (options.authMode === "api-key" && options.tokenMode === "max_completion_tokens")
    ? "plan"
    : "metered";
}

function decryptProviderProfiles(value: unknown): ProviderProfiles {
  const profiles = normalizeProviderProfiles(value);
  return {
    metered: { ...profiles.metered, providerApiKey: decryptSecret(profiles.metered.providerApiKey) },
    plan: { ...profiles.plan, providerApiKey: decryptSecret(profiles.plan.providerApiKey) },
  };
}

function profilesFromRow(row: SettingsRow): ProviderProfiles {
  const raw = parseJson<unknown>(row.provider_profiles_json, null);
  if (raw && typeof raw === "object" && !Array.isArray(raw) && ("metered" in raw || "plan" in raw)) {
    return decryptProviderProfiles(raw);
  }

  const legacy = legacyProviderProfile(row);
  const profiles: ProviderProfiles = { metered: emptyProviderProfile(), plan: emptyProviderProfile() };
  if (hasProviderData(legacy)) profiles[legacyProviderKind(legacy)] = legacy;
  return profiles;
}

function fallbackProfile(profiles: ProviderProfiles): ProviderProfile {
  return hasProviderData(profiles.metered) || isProviderConfigured(profiles.metered)
    ? profiles.metered
    : profiles.plan;
}

function encryptedProviderProfiles(profiles: ProviderProfiles): ProviderProfiles {
  return {
    metered: { ...profiles.metered, providerApiKey: profiles.metered.providerApiKey ? encryptSecret(profiles.metered.providerApiKey) : null },
    plan: { ...profiles.plan, providerApiKey: profiles.plan.providerApiKey ? encryptSecret(profiles.plan.providerApiKey) : null },
  };
}

function updateProviderColumns(profiles: ProviderProfiles, now: string): void {
  const fallback = fallbackProfile(profiles);
  getDb().prepare(`
    UPDATE settings
    SET provider_base_url = ?, provider_model = ?, provider_api_key = ?, provider_options_json = ?, provider_profiles_json = ?, updated_at = ?
    WHERE id = 1
  `).run(
    fallback.providerBaseUrl || null,
    fallback.providerModel || null,
    fallback.providerApiKey ? encryptSecret(fallback.providerApiKey) : null,
    json(fallback.providerOptions),
    json(encryptedProviderProfiles(profiles)),
    now,
  );
}

export function getSettings(): SettingsRecord {
  const row = settingsRow();
  const providerProfiles = profilesFromRow(row);
  const fallback = fallbackProfile(providerProfiles);
  return {
    adminPasswordHash: row.admin_password_hash,
    providerBaseUrl: fallback.providerBaseUrl || null,
    providerModel: fallback.providerModel || null,
    providerApiKey: fallback.providerApiKey,
    providerOptions: fallback.providerOptions,
    providerProfiles,
    profile: profileSchema.parse(parseJson(row.profile_json, {})),
  };
}

export function providerProfilesForSettings(settings: SettingsRecord): ProviderProfiles {
  if (settings.providerProfiles) return normalizeProviderProfiles(settings.providerProfiles);
  const legacy = normalizeProviderProfile(settings);
  return {
    metered: legacy,
    plan: emptyProviderProfile(),
  };
}

export function configuredProviderKindsForSettings(settings: SettingsRecord): ProviderKind[] {
  return configuredProviderKinds(providerProfilesForSettings(settings));
}

export function saveInitialSettings(input: {
  adminPasswordHash: string;
  providerBaseUrl?: string;
  providerModel?: string;
  providerApiKey?: string;
  providerOptions?: Partial<ProviderOptions>;
  providerProfiles?: Partial<Record<ProviderKind, ProviderProfileInput>>;
}): void {
  const profiles: ProviderProfiles = { metered: emptyProviderProfile(), plan: emptyProviderProfile() };
  if (input.providerProfiles) {
    for (const kind of providerKinds) {
      const profile = input.providerProfiles[kind];
      if (profile) profiles[kind] = normalizeProviderProfile(profile);
    }
  } else if (input.providerBaseUrl !== undefined || input.providerModel !== undefined || input.providerApiKey !== undefined) {
    const legacy = normalizeProviderProfile({
      providerBaseUrl: input.providerBaseUrl,
      providerModel: input.providerModel,
      providerApiKey: input.providerApiKey,
      providerOptions: input.providerOptions,
    });
    profiles[legacyProviderKind(legacy)] = legacy;
  }
  const now = nowIso();
  getDb().prepare(`
    UPDATE settings
    SET admin_password_hash = ?, updated_at = ?
    WHERE id = 1
  `).run(input.adminPasswordHash, now);
  updateProviderColumns(profiles, now);
}

export function saveAdminPasswordHash(adminPasswordHash: string): void {
  getDb().prepare("UPDATE settings SET admin_password_hash = ?, updated_at = ? WHERE id = 1")
    .run(adminPasswordHash, nowIso());
}

export function saveProviderSettings(input: {
  providerBaseUrl: string;
  providerModel: string;
  providerApiKey?: string;
  providerOptions?: Partial<ProviderOptions>;
  providerKind?: ProviderKind;
}): void {
  const current = getSettings();
  const compatibilityKind = input.providerKind ?? configuredProviderKindsForSettings(current)[0] ?? "metered";
  saveProviderProfiles({
    [compatibilityKind]: input,
  });
}

export function saveProviderProfiles(input: Partial<Record<ProviderKind, ProviderProfileInput>>): void {
  const current = getSettings();
  const profiles = current.providerProfiles ?? { metered: emptyProviderProfile(), plan: emptyProviderProfile() };
  const next: ProviderProfiles = { metered: { ...profiles.metered }, plan: { ...profiles.plan } };
  for (const kind of providerKinds) {
    const profile = input[kind];
    if (!profile) continue;
    const currentProfile = profiles[kind];
    next[kind] = {
      providerBaseUrl: profile.providerBaseUrl.trim(),
      providerModel: profile.providerModel.trim(),
      providerApiKey: profile.providerApiKey?.trim() || currentProfile.providerApiKey,
      providerOptions: normalizeProviderOptions({ ...currentProfile.providerOptions, ...profile.providerOptions }),
    };
  }
  updateProviderColumns(next, nowIso());
}

export function saveProfile(profile: Profile): Profile {
  const normalized = profileSchema.parse(profile);
  getDb().prepare("UPDATE settings SET profile_json = ?, updated_at = ? WHERE id = 1")
    .run(json(normalized), nowIso());
  return normalized;
}

function mapIdea(row: IdeaRow): IdeaRecord {
  const rawAnalysis = parseJson<unknown>(row.latest_analysis_json, null);
  return {
    id: row.id,
    title: row.title,
    rawText: row.raw_text,
    target: row.target,
    status: row.status,
    latestAnalysis: rawAnalysis ? normalizeAnalysisResult(rawAnalysis) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    providerKind: row.provider_kind === "metered" || row.provider_kind === "plan" ? row.provider_kind : null,
  };
}

export function listIdeas(): IdeaRecord[] {
  const rows = getDb().prepare("SELECT * FROM ideas WHERE archived_at IS NULL ORDER BY updated_at DESC").all() as unknown as IdeaRow[];
  return rows.map(mapIdea);
}

export function listArchivedIdeas(): IdeaRecord[] {
  const rows = getDb().prepare("SELECT * FROM ideas WHERE archived_at IS NOT NULL ORDER BY updated_at DESC").all() as unknown as IdeaRow[];
  return rows.map(mapIdea);
}

export function getIdea(id: string): IdeaRecord | null {
  const row = getDb().prepare("SELECT * FROM ideas WHERE id = ?").get(id) as unknown as IdeaRow | undefined;
  return row ? mapIdea(row) : null;
}

export function createIdea(input: { rawText: string; target: PromptTarget }): IdeaRecord {
  const id = randomUUID();
  const now = nowIso();
  const title = input.rawText.trim().split(/\n/)[0]?.slice(0, 64) || "未命名想法";
  getDb().prepare(`
    INSERT INTO ideas (id, title, raw_text, target, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'draft', ?, ?)
  `).run(id, title, input.rawText.trim(), input.target, now, now);
  return getIdea(id)!;
}

export function setIdeaProviderKind(id: string, providerKind: ProviderKind): void {
  getDb().prepare("UPDATE ideas SET provider_kind = ?, updated_at = ? WHERE id = ?")
    .run(providerKind, nowIso(), id);
}

export function updateIdeaStatus(id: string, status: IdeaStatus): void {
  getDb().prepare("UPDATE ideas SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
}

export function saveAnalysis(id: string, analysis: AnalysisResult): void {
  const now = nowIso();
  getDb().prepare("UPDATE ideas SET title = ?, status = ?, latest_analysis_json = ?, updated_at = ? WHERE id = ?")
    .run(analysis.title || "未命名想法", analysis.status === "ready" ? "ready" : "clarifying", json(analysis), now, id);
  getDb().prepare("INSERT INTO analysis_snapshots (id, idea_id, data_json, created_at) VALUES (?, ?, ?, ?)")
    .run(randomUUID(), id, json(analysis), now);
}

export function listTurns(ideaId: string): TurnRecord[] {
  const rows = getDb().prepare("SELECT * FROM turns WHERE idea_id = ? ORDER BY sequence ASC").all(ideaId) as unknown as Array<{
    id: string; idea_id: string; question: string; reason: string; answer: string | null; sequence: number; created_at: string; answered_at: string | null; resolution?: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    ideaId: row.idea_id,
    question: row.question,
    reason: row.reason,
    answer: row.answer,
    sequence: row.sequence,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
    resolution: row.resolution === "delegated" || row.resolution === "answered"
      ? row.resolution
      : row.answer?.trim()
        ? "answered"
        : "pending",
  }));
}

export function addTurn(input: { ideaId: string; question: string; reason: string }): TurnRecord {
  const db = getDb();
  const sequenceRow = db.prepare("SELECT COALESCE(MAX(sequence), 0) AS value FROM turns WHERE idea_id = ?").get(input.ideaId) as { value: number };
  const id = randomUUID();
  const now = nowIso();
  db.prepare(`
    INSERT INTO turns (id, idea_id, question, reason, sequence, created_at, resolution)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, input.ideaId, input.question, input.reason, sequenceRow.value + 1, now);
  return listTurns(input.ideaId).at(-1)!;
}

export function answerTurn(turnId: string, answer: string): void {
  getDb().prepare("UPDATE turns SET answer = ?, answered_at = ?, resolution = 'answered' WHERE id = ?")
    .run(answer.trim(), nowIso(), turnId);
}

export function delegateTurn(turnId: string): void {
  getDb().prepare("UPDATE turns SET answer = NULL, answered_at = ?, resolution = 'delegated' WHERE id = ?")
    .run(nowIso(), turnId);
}

export function savePrompt(input: {
  ideaId: string;
  target: PromptTarget;
  content: string;
  analysis: AnalysisResult;
  includeExtensions: boolean;
}): PromptRecord {
  const id = randomUUID();
  const createdAt = nowIso();
  getDb().prepare(`
    INSERT INTO prompt_versions (id, idea_id, target, content, analysis_json, include_extensions, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.ideaId, input.target, input.content, json(input.analysis), input.includeExtensions ? 1 : 0, createdAt);
  updateIdeaStatus(input.ideaId, "finalized");
  return { id, ideaId: input.ideaId, target: input.target, content: input.content, analysis: input.analysis, includeExtensions: input.includeExtensions, createdAt };
}

export function listPrompts(ideaId: string): PromptRecord[] {
  const rows = getDb().prepare("SELECT * FROM prompt_versions WHERE idea_id = ? ORDER BY created_at DESC").all(ideaId) as unknown as Array<{
    id: string; idea_id: string; target: PromptTarget; content: string; analysis_json: string; include_extensions: number; created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    ideaId: row.idea_id,
    target: row.target,
    content: row.content,
    analysis: normalizeAnalysisResult(JSON.parse(row.analysis_json)),
    includeExtensions: row.include_extensions === 1,
    createdAt: row.created_at,
  }));
}

export function archiveIdea(id: string): void {
  const now = nowIso();
  getDb().prepare("UPDATE ideas SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
}

export function deleteArchivedIdea(id: string): boolean {
  const result = getDb().prepare("DELETE FROM ideas WHERE id = ? AND archived_at IS NOT NULL").run(id);
  return result.changes > 0;
}

export function deleteAllArchivedIdeas(): number {
  const result = getDb().prepare("DELETE FROM ideas WHERE archived_at IS NOT NULL").run();
  return Number(result.changes);
}

export function ideaExport(id: string): { idea: IdeaRecord; turns: TurnRecord[]; prompts: PromptRecord[] } | null {
  const idea = getIdea(id);
  if (!idea) return null;
  return { idea, turns: listTurns(id), prompts: listPrompts(id) };
}

export function runSql(sql: string, params: SqlParam[] = []): unknown {
  return getDb().prepare(sql).run(...params);
}
