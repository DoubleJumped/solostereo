import type Database from "better-sqlite3";

/**
 * Refresh of the materialized summary tables (migration 006).
 *
 * Each summary table X is a precomputed copy of the view X_src. The data only
 * changes when new listening events are written, so every write path calls
 * refreshSummaries() afterwards: scripts/import.ts and syncRecentlyPlayed()
 * (both the web route and scripts/sync.ts go through the latter). Page loads
 * never pay for aggregation — they read the tables.
 *
 * The rebuild is a full DELETE + INSERT ... SELECT per table, all in one
 * transaction: ~2s for a 208k-row history, paid once per import/sync rather
 * than on every request. Readers on other connections are never blocked in
 * WAL mode and can never see a half-refreshed state.
 */
const SUMMARY_TABLES = [
  "artist_summary",
  "album_summary",
  "track_summary",
  "artist_year_summary",
  "album_year_summary",
  "track_year_summary",
  "monthly_listening_summary",
  "yearly_listening_summary",
  "overview_alltime",
] as const;

export function refreshSummaries(db: Database.Database): void {
  const hasTables = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'overview_alltime'",
    )
    .get();
  if (!hasTables) {
    throw new Error(
      "summary tables missing — run `npm run migrate` (migration 006) first",
    );
  }
  db.transaction(() => {
    for (const t of SUMMARY_TABLES) {
      db.exec(`DELETE FROM "${t}"`);
      db.exec(`INSERT INTO "${t}" SELECT * FROM "${t}_src"`);
    }
  })();
}
