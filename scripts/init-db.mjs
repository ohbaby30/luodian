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
    profile_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, raw_text TEXT NOT NULL, target TEXT NOT NULL,
    status TEXT NOT NULL, latest_analysis_json TEXT, created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, archived_at TEXT
  );
  CREATE TABLE IF NOT EXISTS turns (
    id TEXT PRIMARY KEY, idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    question TEXT NOT NULL, reason TEXT NOT NULL, answer TEXT, sequence INTEGER NOT NULL,
    created_at TEXT NOT NULL, answered_at TEXT
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
db.close();

