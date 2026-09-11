import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env.DATA_DIR || "/app/data";
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "luodian.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), admin_password_hash TEXT,
    provider_base_url TEXT, provider_model TEXT, provider_api_key TEXT,
    provider_options_json TEXT NOT NULL DEFAULT '{}',
    provider_profiles_json TEXT NOT NULL DEFAULT '{}',
    profile_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, raw_text TEXT NOT NULL, target TEXT NOT NULL,
    status TEXT NOT NULL, latest_analysis_json TEXT, created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, archived_at TEXT, provider_kind TEXT
  );
  CREATE TABLE IF NOT EXISTS turns (
    id TEXT PRIMARY KEY, idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    question TEXT NOT NULL, reason TEXT NOT NULL, answer TEXT, sequence INTEGER NOT NULL,
    created_at TEXT NOT NULL, answered_at TEXT, resolution TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS analysis_snapshots (
    id TEXT PRIMARY KEY, idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY, idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    target TEXT NOT NULL, content TEXT NOT NULL, analysis_json TEXT NOT NULL,
    include_extensions INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ideas_updated_at ON ideas(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_turns_idea_sequence ON turns(idea_id, sequence);
  CREATE INDEX IF NOT EXISTS idx_snapshots_idea_created ON analysis_snapshots(idea_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_prompts_idea_created ON prompt_versions(idea_id, created_at DESC);
  INSERT OR IGNORE INTO settings (id, profile_json, created_at, updated_at)
    VALUES (1, '{}', datetime('now'), datetime('now'));
`);
const settingsColumns = db.prepare("PRAGMA table_info(settings)").all();
if (!settingsColumns.some((column) => column.name === "provider_options_json")) {
  db.exec("ALTER TABLE settings ADD COLUMN provider_options_json TEXT NOT NULL DEFAULT '{}'");
}
if (!settingsColumns.some((column) => column.name === "provider_profiles_json")) {
  db.exec("ALTER TABLE settings ADD COLUMN provider_profiles_json TEXT NOT NULL DEFAULT '{}'");
}
const ideaColumns = db.prepare("PRAGMA table_info(ideas)").all();
if (!ideaColumns.some((column) => column.name === "provider_kind")) {
  db.exec("ALTER TABLE ideas ADD COLUMN provider_kind TEXT");
}
const turnColumns = db.prepare("PRAGMA table_info(turns)").all();
if (!turnColumns.some((column) => column.name === "resolution")) {
  db.exec("ALTER TABLE turns ADD COLUMN resolution TEXT NOT NULL DEFAULT 'pending'");
}
db.exec(`
  UPDATE turns
  SET resolution = CASE
    WHEN answer IS NOT NULL AND length(trim(answer)) > 0 THEN 'answered'
    ELSE 'pending'
  END
  WHERE resolution IS NULL OR resolution = '' OR resolution = 'pending';
`);
db.close();
