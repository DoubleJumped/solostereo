/**
 * Spotify Extended Streaming History importer.
 *
 * Usage:
 *   npm run import                 -- imports data/raw/spotify/
 *   npm run import -- <dir|file>   -- imports another directory or one file
 *
 * Loads Streaming_History_Audio_*.json and Streaming_History_Video_*.json,
 * normalizes records per the field mapping in plan.md §5.1 (ip_addr is
 * deliberately dropped), and inserts with INSERT OR IGNORE. Idempotency is
 * guaranteed by the UNIQUE(dedup_hash) constraint, not importer logic.
 */
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../lib/db";
import { dedupHash as computeDedupHash } from "../lib/dedup";
import { refreshSummaries } from "../lib/summaries";
import { computeDbSummary, printImportSummary } from "../lib/import-summary";
import { printValidation, runValidation } from "../lib/validate";

const DEFAULT_SOURCE = path.join("data", "raw", "spotify");

/** Raw record shape in the export files. */
interface ExportRecord {
  ts: string;
  platform: string | null;
  ms_played: number | null;
  conn_country: string | null;
  ip_addr?: string | null; // dropped on import
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  episode_name: string | null;
  episode_show_name: string | null;
  spotify_episode_uri: string | null;
  audiobook_title: string | null;
  audiobook_uri: string | null;
  audiobook_chapter_uri: string | null;
  audiobook_chapter_title: string | null;
  reason_start: string | null;
  reason_end: string | null;
  shuffle: boolean | null;
  skipped: boolean | null;
  offline: boolean | null;
  offline_timestamp: number | string | null;
  incognito_mode: boolean | null;
}

function toBool(v: boolean | null | undefined): 0 | 1 | null {
  if (v === true) return 1;
  if (v === false) return 0;
  return null;
}

/** Deterministic dedup hash per plan.md §7, via the shared helper. */
export function dedupHash(r: ExportRecord): string {
  return computeDedupHash({
    playedAt: r.ts,
    trackUri: r.spotify_track_uri,
    episodeUri: r.spotify_episode_uri,
    chapterUri: r.audiobook_chapter_uri,
    trackName: r.master_metadata_track_name,
    artistName: r.master_metadata_album_artist_name,
    albumName: r.master_metadata_album_album_name,
    msPlayed: r.ms_played ?? 0,
  });
}

function listSourceFiles(source: string): string[] {
  const stat = fs.statSync(source);
  if (stat.isFile()) return [source];
  return fs
    .readdirSync(source)
    .filter(
      (f) =>
        /^Streaming_History_(Audio|Video)_.*\.json$/.test(f) ||
        f === "sample-history.json",
    )
    .sort()
    .map((f) => path.join(source, f));
}

export function runImport(source: string): {
  filesProcessed: number;
  rowsRead: number;
  rowsInserted: number;
  duplicatesSkipped: number;
} {
  const files = listSourceFiles(source);
  if (files.length === 0) {
    console.error(`no export files found in ${source}`);
    process.exit(1);
  }

  const db = openDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO listening_events (
       dedup_hash, played_at, source_filename, platform, country_code,
       track_name, artist_name, album_name, spotify_track_uri,
       episode_name, episode_show_name, spotify_episode_uri,
       audiobook_title, audiobook_uri, audiobook_chapter_uri,
       audiobook_chapter_title, ms_played, reason_start, reason_end,
       shuffle, skipped, offline, offline_timestamp, incognito_mode,
       imported_at
     ) VALUES (
       @dedup_hash, @played_at, @source_filename, @platform, @country_code,
       @track_name, @artist_name, @album_name, @spotify_track_uri,
       @episode_name, @episode_show_name, @spotify_episode_uri,
       @audiobook_title, @audiobook_uri, @audiobook_chapter_uri,
       @audiobook_chapter_title, @ms_played, @reason_start, @reason_end,
       @shuffle, @skipped, @offline, @offline_timestamp, @incognito_mode,
       @imported_at
     )`,
  );

  const importedAt = new Date().toISOString();
  let totalRead = 0;
  let totalInserted = 0;

  for (const file of files) {
    const records = JSON.parse(fs.readFileSync(file, "utf8")) as ExportRecord[];
    const filename = path.basename(file);

    const insertFile = db.transaction((recs: ExportRecord[]) => {
      let inserted = 0;
      for (const r of recs) {
        const result = insert.run({
          dedup_hash: dedupHash(r),
          played_at: r.ts,
          source_filename: filename,
          platform: r.platform,
          country_code: r.conn_country,
          track_name: r.master_metadata_track_name,
          artist_name: r.master_metadata_album_artist_name,
          album_name: r.master_metadata_album_album_name,
          spotify_track_uri: r.spotify_track_uri,
          episode_name: r.episode_name,
          episode_show_name: r.episode_show_name,
          spotify_episode_uri: r.spotify_episode_uri,
          audiobook_title: r.audiobook_title,
          audiobook_uri: r.audiobook_uri,
          audiobook_chapter_uri: r.audiobook_chapter_uri,
          audiobook_chapter_title: r.audiobook_chapter_title,
          ms_played: r.ms_played ?? 0,
          reason_start: r.reason_start,
          reason_end: r.reason_end,
          shuffle: toBool(r.shuffle),
          skipped: toBool(r.skipped),
          offline: toBool(r.offline),
          offline_timestamp:
            r.offline_timestamp == null ? null : String(r.offline_timestamp),
          incognito_mode: toBool(r.incognito_mode),
          imported_at: importedAt,
        });
        inserted += result.changes;
      }
      return inserted;
    });

    const inserted = insertFile(records);
    totalRead += records.length;
    totalInserted += inserted;
    console.log(
      `${filename}: read ${records.length}, inserted ${inserted}, skipped ${
        records.length - inserted
      } duplicate(s)`,
    );
  }

  if (totalInserted > 0) {
    const t0 = performance.now();
    refreshSummaries(db);
    console.log(
      `summary tables refreshed in ${(performance.now() - t0).toFixed(0)} ms`,
    );
  }

  db.close();
  return {
    filesProcessed: files.length,
    rowsRead: totalRead,
    rowsInserted: totalInserted,
    duplicatesSkipped: totalRead - totalInserted,
  };
}

function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const totals = runImport(source);

  const db = openDb();
  printImportSummary(totals, computeDbSummary(db));
  const ok = printValidation(runValidation(db));
  db.close();
  if (!ok) process.exit(1);
}

main();
