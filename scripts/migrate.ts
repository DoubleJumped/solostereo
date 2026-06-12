/**
 * Minimal SQL migration runner: applies db/migrations/*.sql in filename
 * order, recording each in schema_migrations. Each migration runs inside a
 * transaction. Rerunning is a no-op for already-applied files.
 *
 * Usage: npm run migrate
 */
import fs from "node:fs";
import path from "node:path";
import { openDb, DB_PATH } from "../lib/db";

const MIGRATIONS_DIR = path.join("db", "migrations");

function main() {
  const db = openDb();
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename   TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const applied = new Set(
    db
      .prepare("SELECT filename FROM schema_migrations")
      .all()
      .map((r) => (r as { filename: string }).filename),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
      ).run(file, new Date().toISOString());
    })();
    console.log(`applied ${file}`);
    ran++;
  }

  console.log(
    ran === 0
      ? `up to date (${applied.size} migration(s) already applied) — ${DB_PATH}`
      : `done: ${ran} migration(s) applied — ${DB_PATH}`,
  );
  db.close();
}

main();
