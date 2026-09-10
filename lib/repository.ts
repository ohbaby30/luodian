import { randomUUID } from "node:crypto";
import { getDb, json, nowIso, parseJson, type SqlParam } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { profileSchema, type AnalysisResult, type Profile, type PromptTarget } from "./contracts";

export type IdeaStatus = "draft" | "clarifying" | "ready" | "finalized" | "archived";

export interface SettingsRecord {
  adminPasswordHash: string | null;
  providerBaseUrl: string | null;
  providerModel: string | null;
  providerApiKey: string | null;
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
}

export interface TurnRecord {
  id: string;
  ideaId: string;
  question: string;
  reason: string;
  answer: string | null;
  sequence: number;
  createdAt: string;
  answeredAt: string | null;
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
};

function settingsRow(): SettingsRow {
  return getDb().prepare("SELECT * FROM settings WHERE id = 1").get() as SettingsRow;
}

export function getSettings(): SettingsRecord {
  const row = settingsRow();
  return {
    adminPasswordHash: row.admin_password_hash,
    providerBaseUrl: row.provider_base_url,
    providerModel: row.provider_model,
    providerApiKey: decryptSecret(row.provider_api_key),
    profile: profileSchema.parse(parseJson(row.profile_json, {})),
  };
}

export function saveInitialSettings(input: {
  adminPasswordHash: string;
  providerBaseUrl: string;
  providerModel: string;
  providerApiKey: string;
}): void {
  const now = nowIso();
  getDb().prepare(`
    UPDATE settings
    SET admin_password_hash = ?, provider_base_url = ?, provider_model = ?, provider_api_key = ?, updated_at = ?
    WHERE id = 1
  `).run(input.adminPasswordHash, input.providerBaseUrl, input.providerModel, encryptSecret(input.providerApiKey), now);
}

export function saveAdminPasswordHash(adminPasswordHash: string): void {
  getDb().prepare("UPDATE settings SET admin_password_hash = ?, updated_at = ? WHERE id = 1")
    .run(adminPasswordHash, nowIso());
}

export function saveProviderSettings(input: {
  providerBaseUrl: string;
  providerModel: string;
  providerApiKey?: string;
}): void {
  const current = settingsRow();
  const encryptedKey = input.providerApiKey?.trim()
    ? encryptSecret(input.providerApiKey.trim())
    : current.provider_api_key;
  getDb().prepare(`
    UPDATE settings
    SET provider_base_url = ?, provider_model = ?, provider_api_key = ?, updated_at = ?
    WHERE id = 1
  `).run(input.providerBaseUrl.trim(), input.providerModel.trim(), encryptedKey, nowIso());
}

export function saveProfile(profile: Profile): Profile {
  const normalized = profileSchema.parse(profile);
  getDb().prepare("UPDATE settings SET profile_json = ?, updated_at = ? WHERE id = 1")
    .run(json(normalized), nowIso());
  return normalized;
}

function mapIdea(row: IdeaRow): IdeaRecord {
  return {
    id: row.id,
    title: row.title,
    rawText: row.raw_text,
    target: row.target,
    status: row.status,
    latestAnalysis: parseJson<AnalysisResult | null>(row.latest_analysis_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export function listIdeas(): IdeaRecord[] {
  const rows = getDb().prepare("SELECT * FROM ideas WHERE archived_at IS NULL ORDER BY updated_at DESC").all() as unknown as IdeaRow[];
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
    id: string; idea_id: string; question: string; reason: string; answer: string | null; sequence: number; created_at: string; answered_at: string | null;
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
  }));
}

export function addTurn(input: { ideaId: string; question: string; reason: string }): TurnRecord {
  const db = getDb();
  const sequenceRow = db.prepare("SELECT COALESCE(MAX(sequence), 0) AS value FROM turns WHERE idea_id = ?").get(input.ideaId) as { value: number };
  const id = randomUUID();
  const now = nowIso();
  db.prepare(`
    INSERT INTO turns (id, idea_id, question, reason, sequence, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.ideaId, input.question, input.reason, sequenceRow.value + 1, now);
  return listTurns(input.ideaId).at(-1)!;
}

export function answerTurn(turnId: string, answer: string): void {
  getDb().prepare("UPDATE turns SET answer = ?, answered_at = ? WHERE id = ?")
    .run(answer.trim(), nowIso(), turnId);
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
    analysis: JSON.parse(row.analysis_json) as AnalysisResult,
    includeExtensions: row.include_extensions === 1,
    createdAt: row.created_at,
  }));
}

export function archiveIdea(id: string): void {
  const now = nowIso();
  getDb().prepare("UPDATE ideas SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
}

export function ideaExport(id: string): { idea: IdeaRecord; turns: TurnRecord[]; prompts: PromptRecord[] } | null {
  const idea = getIdea(id);
  if (!idea) return null;
  return { idea, turns: listTurns(id), prompts: listPrompts(id) };
}

export function runSql(sql: string, params: SqlParam[] = []): unknown {
  return getDb().prepare(sql).run(...params);
}
