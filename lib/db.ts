import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DB_PATH =
  process.env.SOLOSTEREO_DB_PATH ?? path.join("data", "solostereo.db");

/**
 * Open the SQLite database, creating the data directory if needed.
 * WAL mode keeps reads fast while the importer writes.
 */
export function openDb(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
