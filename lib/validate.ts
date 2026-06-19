import type Database from "better-sqlite3";
import {
  AUDIOBOOK_WHERE,
  MUSIC_WHERE,
  PODCAST_WHERE,
} from "./import-summary";

/**
 * Data-quality checks (plan.md §9). Checks that depend on views created in
 * Phase 2 report "skip" until those views exist, then run for real.
 */
type CheckResult = {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
};

function viewExists(db: Database.Database, name: string): boolean {
  return (
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = ?")
      .get(name) !== undefined
  );
}

function tableExists(db: Database.Database, name: string): boolean {
  return (
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name) !== undefined
  );
}

export function runValidation(db: Database.Database): CheckResult[] {
  const results: CheckResult[] = [];
  const one = <T>(sql: string) => db.prepare(sql).get() as T;

  // 1. Idempotency: the dedup UNIQUE constraint is the mechanism; verify it
  // exists and holds. (Behavioral proof — rerunning the importer inserting 0
  // rows — is demonstrated in the import log.)
  {
    const idx = db
      .prepare(
        `SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_events_dedup'`,
      )
      .get();
    const dup = one<{ total: number; distinct: number }>(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT dedup_hash) AS [distinct]
       FROM listening_events`,
    );
    const ok = idx !== undefined && dup.total === dup.distinct;
    results.push({
      name: "1 importer idempotency (dedup constraint holds)",
      status: ok ? "pass" : "fail",
      detail: `${dup.total} rows, ${dup.distinct} distinct hashes, unique index ${idx ? "present" : "MISSING"}`,
    });
  }

  // 2. No negative ms_played.
  {
    const r = one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM listening_events WHERE ms_played < 0`,
    );
    results.push({
      name: "2 no negative ms_played",
      status: r.n === 0 ? "pass" : "fail",
      detail: `${r.n} negative row(s)`,
    });
  }

  // 3. Yearly totals reconcile to the full-history total.
  {
    const useView = viewExists(db, "yearly_listening_summary");
    const yearly = useView
      ? one<{ ms: number | null }>(
          `SELECT SUM(total_ms_played) AS ms FROM yearly_listening_summary`,
        )
      : one<{ ms: number | null }>(
          `SELECT SUM(ms) AS ms FROM (
             SELECT strftime('%Y', played_at) AS y, SUM(ms_played) AS ms
             FROM listening_events GROUP BY y
           )`,
        );
    const total = one<{ ms: number | null }>(
      `SELECT SUM(ms_played) AS ms FROM listening_events`,
    );
    const ok = (yearly.ms ?? 0) === (total.ms ?? 0);
    results.push({
      name: `3 yearly totals reconcile (${useView ? "view" : "raw"})`,
      status: ok ? "pass" : "fail",
      detail: `yearly sum ${yearly.ms ?? 0} vs total ${total.ms ?? 0}`,
    });
  }

  // 3b. Monthly totals reconcile to yearly totals (both views).
  if (
    viewExists(db, "monthly_listening_summary") &&
    viewExists(db, "yearly_listening_summary")
  ) {
    const m = one<{ ms: number | null }>(
      `SELECT SUM(total_ms_played) AS ms FROM monthly_listening_summary`,
    );
    const y = one<{ ms: number | null }>(
      `SELECT SUM(total_ms_played) AS ms FROM yearly_listening_summary`,
    );
    results.push({
      name: "3b monthly totals reconcile to yearly totals",
      status: (m.ms ?? 0) === (y.ms ?? 0) ? "pass" : "fail",
      detail: `monthly sum ${m.ms ?? 0} vs yearly sum ${y.ms ?? 0}`,
    });
  }

  // 4. Artist summary reconciles to music-event totals.
  if (viewExists(db, "artist_summary")) {
    const view = one<{ ms: number | null; plays: number | null }>(
      `SELECT SUM(total_ms_played) AS ms, SUM(raw_plays) AS plays FROM artist_summary`,
    );
    const raw = one<{ ms: number | null; plays: number | null }>(
      `SELECT SUM(ms_played) AS ms, COUNT(*) AS plays
       FROM listening_events WHERE ${MUSIC_WHERE} AND artist_name IS NOT NULL`,
    );
    const ok =
      (view.ms ?? 0) === (raw.ms ?? 0) && (view.plays ?? 0) === (raw.plays ?? 0);
    results.push({
      name: "4 artist summary reconciles to music events",
      status: ok ? "pass" : "fail",
      detail: `view ms ${view.ms ?? 0} / plays ${view.plays ?? 0} vs raw ms ${raw.ms ?? 0} / plays ${raw.plays ?? 0}`,
    });
  } else {
    results.push({
      name: "4 artist summary reconciles to music events",
      status: "skip",
      detail: "artist_summary view not present yet (Phase 2)",
    });
  }

  // 4b. Artist-by-year totals reconcile to all-time artist totals.
  if (viewExists(db, "artist_year_summary") && viewExists(db, "artist_summary")) {
    const y = one<{ ms: number | null; plays: number | null }>(
      `SELECT SUM(total_ms_played) AS ms, SUM(raw_plays) AS plays
       FROM artist_year_summary`,
    );
    const a = one<{ ms: number | null; plays: number | null }>(
      `SELECT SUM(total_ms_played) AS ms, SUM(raw_plays) AS plays
       FROM artist_summary`,
    );
    const ok =
      (y.ms ?? 0) === (a.ms ?? 0) && (y.plays ?? 0) === (a.plays ?? 0);
    results.push({
      name: "4b artist-by-year reconciles to all-time artist totals",
      status: ok ? "pass" : "fail",
      detail: `year ms ${y.ms ?? 0} / plays ${y.plays ?? 0} vs all-time ms ${a.ms ?? 0} / plays ${a.plays ?? 0}`,
    });
  }

  // 5. Album summary reconciles to events with album name populated.
  if (viewExists(db, "album_summary")) {
    const view = one<{ ms: number | null }>(
      `SELECT SUM(total_ms_played) AS ms FROM album_summary`,
    );
    const raw = one<{ ms: number | null }>(
      `SELECT SUM(ms_played) AS ms FROM listening_events
       WHERE ${MUSIC_WHERE} AND album_name IS NOT NULL AND artist_name IS NOT NULL`,
    );
    const ok = (view.ms ?? 0) === (raw.ms ?? 0);
    results.push({
      name: "5 album summary reconciles to events with album",
      status: ok ? "pass" : "fail",
      detail: `view ms ${view.ms ?? 0} vs raw ms ${raw.ms ?? 0}`,
    });
  } else {
    results.push({
      name: "5 album summary reconciles to events with album",
      status: "skip",
      detail: "album_summary view not present yet (Phase 2)",
    });
  }

  // 6. Podcasts/audiobooks preserved, and absent from music views.
  {
    const parts = one<{
      total: number;
      music: number;
      podcast: number;
      audiobook: number;
      overlap: number;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(${MUSIC_WHERE}) AS music,
              SUM(${PODCAST_WHERE}) AS podcast,
              SUM(${AUDIOBOOK_WHERE}) AS audiobook,
              SUM(${PODCAST_WHERE} AND ${AUDIOBOOK_WHERE}) AS overlap
       FROM listening_events`,
    );
    let ok =
      parts.overlap === 0 &&
      (parts.music ?? 0) + (parts.podcast ?? 0) + (parts.audiobook ?? 0) ===
        parts.total;
    let detail = `total ${parts.total} = music ${parts.music} + podcast ${parts.podcast} + audiobook ${parts.audiobook}, overlap ${parts.overlap}`;
    if (ok && viewExists(db, "music_listening_events")) {
      const inView = one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM music_listening_events
         WHERE ${PODCAST_WHERE} OR ${AUDIOBOOK_WHERE}`,
      );
      const viewCount = one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM music_listening_events`,
      );
      ok = inView.n === 0 && viewCount.n === (parts.music ?? 0);
      detail += `; music view ${viewCount.n} rows, ${inView.n} podcast/audiobook leak(s)`;
    }
    results.push({
      name: "6 podcasts/audiobooks preserved, excluded from music",
      status: ok ? "pass" : "fail",
      detail,
    });
  }

  // 7. Every music row in rankings has a non-null artist name.
  if (viewExists(db, "artist_summary")) {
    const r = one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM artist_summary WHERE artist_name IS NULL`,
    );
    results.push({
      name: "7 rankings have non-null artist names",
      status: r.n === 0 ? "pass" : "fail",
      detail: `${r.n} null-artist ranking row(s)`,
    });
  } else {
    results.push({
      name: "7 rankings have non-null artist names",
      status: "skip",
      detail: "artist_summary view not present yet (Phase 2)",
    });
  }

  // 8. Spot-check (task 5.3): the top-3 artists' summary rows reconcile to
  // totals recomputed directly from listening_events with inline predicates
  // (no views involved).
  if (viewExists(db, "artist_summary")) {
    const top3 = db
      .prepare(
        `SELECT artist_name, meaningful_plays, raw_plays, total_ms_played
         FROM artist_summary ORDER BY total_ms_played DESC LIMIT 3`,
      )
      .all() as {
      artist_name: string;
      meaningful_plays: number;
      raw_plays: number;
      total_ms_played: number;
    }[];
    const mismatches: string[] = [];
    for (const a of top3) {
      const raw = db
        .prepare(
          `SELECT SUM(ms_played >= 30000) AS mp, COUNT(*) AS rp, SUM(ms_played) AS ms
           FROM listening_events
           WHERE artist_name = ?
             AND spotify_episode_uri IS NULL AND episode_name IS NULL
             AND audiobook_uri IS NULL AND audiobook_chapter_uri IS NULL
             AND audiobook_title IS NULL`,
        )
        .get(a.artist_name) as { mp: number; rp: number; ms: number };
      if (
        raw.mp !== a.meaningful_plays ||
        raw.rp !== a.raw_plays ||
        raw.ms !== a.total_ms_played
      ) {
        mismatches.push(a.artist_name);
      }
    }
    results.push({
      name: "8 top-3 artist detail totals reconcile to raw events",
      status: mismatches.length === 0 ? "pass" : "fail",
      detail:
        mismatches.length === 0
          ? `checked: ${top3.map((a) => a.artist_name).join(", ")}`
          : `mismatch: ${mismatches.join(", ")}`,
    });
  }

  // 9. Playlist integrity (Phase 8): every playlist track references a real
  // Spotify track URI present in listening_events, so generated/edited
  // playlists can never contain tracks we don't actually have. Skips until
  // the playlist tables exist (migration 005).
  if (tableExists(db, "playlist_tracks")) {
    const r = one<{ tracks: number; orphans: number }>(
      `SELECT COUNT(*) AS tracks,
              SUM(CASE WHEN NOT EXISTS (
                    SELECT 1 FROM listening_events e
                    WHERE e.spotify_track_uri = pt.spotify_track_uri
                  ) THEN 1 ELSE 0 END) AS orphans
       FROM playlist_tracks pt`,
    );
    results.push({
      name: "9 playlist tracks reference real listening events",
      status: (r.orphans ?? 0) === 0 ? "pass" : "fail",
      detail: `${r.tracks} playlist track(s), ${r.orphans ?? 0} orphan uri(s)`,
    });
  } else {
    results.push({
      name: "9 playlist tracks reference real listening events",
      status: "skip",
      detail: "playlist_tracks table not present yet (Phase 8)",
    });
  }

  return results;
}

export function printValidation(results: CheckResult[]): boolean {
  console.log("\nvalidation");
  console.log("----------");
  for (const r of results) {
    const mark = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "skip";
    console.log(`[${mark}] ${r.name} — ${r.detail}`);
  }
  const failed = results.filter((r) => r.status === "fail");
  console.log(
    failed.length === 0
      ? "all checks passed"
      : `${failed.length} check(s) FAILED`,
  );
  return failed.length === 0;
}
