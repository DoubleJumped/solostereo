/**
 * Build a slimmed, sanitized copy of the listening database for the public
 * web demo (see README → "Demo deploy").
 *
 * Two jobs:
 *   1. SANITIZE — empty `spotify_account` so the deployed snapshot never ships
 *      real OAuth tokens.
 *   2. SLIM — drop `dedup_hash` (and its two indexes) plus the unused
 *      `spotify_track_uri` index. `dedup_hash` exists only for the importer's
 *      INSERT-OR-IGNORE idempotency; the app never reads it. Removing it +
 *      VACUUM pulls the file under GitHub's 100 MB single-file limit so it can
 *      be committed as a normal git file (no LFS) and shipped with the build.
 *
 * Every column the app reads is preserved, so no query changes. The result is
 * left in journal_mode=DELETE (no WAL side-files) so the demo can open it
 * read-only on the server with no writable-disk needs.
 *
 * Usage: npm run build:demo-db   (reads the real db, writes data/demo.db)
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SRC = process.env.SOLOSTEREO_DB_PATH ?? path.join("data", "solostereo.db");
const OUT = path.join("data", "demo.db");

// Columns kept on the slim listening_events — the full §001 set minus dedup_hash.
const COLS = [
  "event_id",
  "played_at",
  "source_filename",
  "platform",
  "country_code",
  "track_name",
  "artist_name",
  "album_name",
  "spotify_track_uri",
  "episode_name",
  "episode_show_name",
  "spotify_episode_uri",
  "audiobook_title",
  "audiobook_uri",
  "audiobook_chapter_uri",
  "audiobook_chapter_title",
  "ms_played",
  "reason_start",
  "reason_end",
  "shuffle",
  "skipped",
  "offline",
  "offline_timestamp",
  "incognito_mode",
  "imported_at",
];

const SLIM_DDL = `CREATE TABLE listening_events_new (
  event_id                INTEGER PRIMARY KEY,
  played_at               TEXT NOT NULL,
  source_filename         TEXT NOT NULL,
  platform                TEXT,
  country_code            TEXT,
  track_name              TEXT,
  artist_name             TEXT,
  album_name              TEXT,
  spotify_track_uri       TEXT,
  episode_name            TEXT,
  episode_show_name       TEXT,
  spotify_episode_uri     TEXT,
  audiobook_title         TEXT,
  audiobook_uri           TEXT,
  audiobook_chapter_uri   TEXT,
  audiobook_chapter_title TEXT,
  ms_played               INTEGER NOT NULL,
  reason_start            TEXT,
  reason_end              TEXT,
  shuffle                 INTEGER,
  skipped                 INTEGER,
  offline                 INTEGER,
  offline_timestamp       TEXT,
  incognito_mode          INTEGER,
  imported_at             TEXT NOT NULL
)`;

function mb(file: string): string {
  return (fs.statSync(file).size / 1048576).toFixed(1) + " MB";
}

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`source db not found at ${SRC}`);
  }
  for (const f of [OUT, `${OUT}-wal`, `${OUT}-shm`]) {
    fs.rmSync(f, { force: true });
  }

  // Consistent snapshot copy (folds in any WAL data) via the online backup API.
  const src = new Database(SRC, { readonly: true });
  await src.backup(OUT);
  src.close();

  const db = new Database(OUT);
  db.pragma("foreign_keys = OFF");

  // 1. Sanitize: drop any stored Spotify account (access/refresh tokens).
  const cleared = db.prepare("DELETE FROM spotify_account").run().changes;

  // 2. Slim: capture views (they depend on listening_events), rebuild the table
  //    without dedup_hash, then restore the views + needed indexes.
  const views = db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'view'")
    .all() as { name: string; sql: string }[];

  const before = db
    .prepare("SELECT COUNT(*) n FROM listening_events")
    .get() as { n: number };

  db.transaction(() => {
    for (const v of views) db.exec(`DROP VIEW IF EXISTS "${v.name}"`);

    db.exec(SLIM_DDL);
    db.exec(
      `INSERT INTO listening_events_new (${COLS.join(", ")})
         SELECT ${COLS.join(", ")} FROM listening_events`,
    );
    db.exec("DROP TABLE listening_events"); // also drops its indexes
    db.exec("ALTER TABLE listening_events_new RENAME TO listening_events");

    // Recreate only the indexes the app's read paths use (§001 minus the
    // dedup + track_uri indexes).
    db.exec(
      "CREATE INDEX idx_events_played_at ON listening_events(played_at)",
    );
    db.exec(
      "CREATE INDEX idx_events_artist_time ON listening_events(artist_name, played_at)",
    );

    for (const v of views) db.exec(v.sql);
  })();

  const after = db
    .prepare("SELECT COUNT(*) n FROM listening_events")
    .get() as { n: number };
  if (after.n !== before.n) {
    throw new Error(`row count changed: ${before.n} -> ${after.n}`);
  }

  // Fold WAL away and reclaim freed pages so the file is as small as possible.
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.pragma("journal_mode = DELETE");
  db.exec("VACUUM");
  db.close();

  fs.rmSync(`${OUT}-wal`, { force: true });
  fs.rmSync(`${OUT}-shm`, { force: true });

  console.log(`source : ${SRC}  (${mb(SRC)})`);
  console.log(`demo   : ${OUT}  (${mb(OUT)})`);
  console.log(`rows   : ${after.n}`);
  console.log(`account rows cleared: ${cleared}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
