import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { IS_DEMO } from "./demo";

export const DB_PATH =
  process.env.SOLOSTEREO_DB_PATH ?? path.join("data", "solostereo.db");

/**
 * Open the SQLite database, creating the data directory if needed.
 * WAL mode keeps reads fast while the importer writes.
 *
 * In demo mode the bundled snapshot is opened read-only: it ships in
 * journal_mode=DELETE (no WAL side-files), needs no writable disk, and every
 * write path fails at the DB layer — keeping the public demo immutable.
 */
export function openDb(): Database.Database {
  if (IS_DEMO) {
    return new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
