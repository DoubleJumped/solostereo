# solostereo — project plan

A personal Spotify listening archive and analytics app.

---

## How to use this file (read this first, every session)

This file is the single source of truth for project state. It is designed so that
work can stop at any moment (end of a usage window, interruption, context loss)
and be picked up seamlessly by a fresh session.

**Resume protocol — follow exactly:**

1. Read the **Status** section below to see where the project is.
2. Find the first unchecked `[ ]` task in the **Delivery phases** section.
3. Read that task's phase intro and the relevant spec sections before coding.
4. Complete **one task at a time**. After each task:
   - mark its checkbox `[x]` in this file,
   - append one line to the **Progress log**,
   - commit everything to git with the message `task <id>: <short description>`.
5. Never start a task while the previous task is uncommitted.
6. At the end of each **phase**, stop and report: files changed, how to run the
   app, validation results, a description of the working feature, and the
   recommended next task.

A task is not done until the app runs and `npm run validate` passes (once that
script exists, Phase 1 onward).

## Status

**Current phase:** Phases 0–7 COMPLETE and live. **Phase 8 (Playlist
generation & Spotify round-trip) in progress** — agent-orchestrated build,
subphase by subphase.
**Next task:** 8A.G (engine validation gate)
**Blocked on:** nothing

## Progress log

| Date | Task | Note |
|------|------|------|
| 2026-06-12 | plan | Plan written, git repo initialized. Raw Spotify export already present in repo folder (gitignored). |
| 2026-06-12 | 0.1 | Next.js 16 (App Router) + TS + Tailwind v4 scaffolded at repo root; `.env.example` added; dev server verified responding 200 on :3000. |
| 2026-06-12 | 0.2 | Design system: Fraunces (display) + Inter (body) + Geist Mono; warm near-black/off-white/amber oklch tokens in globals.css; shadcn/ui (radix, nova preset); wordmark + nav shell + 4 stub pages; DESIGN.md written. All routes 200. |
| 2026-06-12 | 0.3 | better-sqlite3 + lib/db.ts (WAL) + scripts/migrate.ts runner; migration 001 creates listening_events + 4 indexes. Ran twice: idempotent. Schema verified. |
| 2026-06-12 | 0.4 | README written: setup, stack rationale, assumptions (UTC, artist-name keying, dropped ip_addr), metric definitions, layout, validation. |
| 2026-06-12 | 0.5 | Styled placeholder Overview: hero wordmark, ghost stat-card row, ghost hero-chart empty state with import instructions. Desktop + mobile verified via screenshots; nav made scroll-safe on mobile. |
| 2026-06-12 | 0.G | Phase 0 gate passed: fresh clone to temp dir → npm install, npm run migrate (001 applied), npm run dev → 200 on :3100. |
| 2026-06-12 | 1.1 | Raw export (30 files) moved to data/raw/spotify/. 20-record fixture written: music incl. 30s-threshold edges + 0ms, exact-duplicate pair, podcast x2, audiobook x2, missing-field rows (null album/URI/all-metadata/booleans). |
| 2026-06-12 | 1.2 | scripts/import.ts: glob audio+video files (or explicit dir/file arg), normalize per §5.1, sha256 dedup hash, INSERT OR IGNORE in per-file transactions, per-file logging. Fixture on scratch DB: 20 read / 19 inserted / 1 dup skipped. |
| 2026-06-12 | 1.3 | lib/import-summary.ts: full §9 import summary after every run (music/podcast/audiobook split, missing names, date range, hours). Fixture verified: 19 total = 15 music + 2 podcast + 2 audiobook. |
| 2026-06-12 | 1.4 | lib/validate.ts + npm run validate: checks 1-3, 6 live; 4, 5, 7 auto-skip until Phase 2 views exist, then run for real. Importer runs validation automatically and exits non-zero on failure. Fixture DB: all checks pass. |
| 2026-06-12 | 1.5 | Fixture x2: run1 20 read/19 inserted/1 dup; run2 0 inserted/20 dups. Real export x2: run1 29 files, 208,355 read, 208,270 inserted, 85 in-export dups; run2 0 inserted/208,355 dups, total stays 208,270. 207,622 music + 647 podcast + 1 audiobook; 2014-11-23 → 2026-06-10; 7,219.7 h. All validation passed both runs. |
| 2026-06-12 | 1.6 | README import docs expanded: how to request the export, where files go, import commands, and a guide to reading the summary/idempotency proof. |
| 2026-06-12 | 1.G | Phase 1 gate: real archive imported and idempotent (208,270 rows; see 1.5). Validation green. |
| 2026-06-12 | 2.1 | Migration 002: music_listening_events + artist/album/track_summary (meaningful + raw plays, minutes, first/last, distinct tracks). Checks 4, 5, 7 went live and pass on real data; top-artist sanity check sensible. |
| 2026-06-12 | 2.2 | Migration 003: artist/album/track_year_summary (music only) + monthly/yearly_listening_summary (all events, music breakdown column). Check 3 now validates the view; all green. |
| 2026-06-12 | 2.3 | Added checks 3b (monthly↔yearly) and 4b (artist-year↔all-time): 9 checks, all pass on real data. Sample year queries sensible (2017 top: RHCP/Arkells/Frank Turner; 2025 top track: squabble up). |
| 2026-06-12 | 2.G | Phase 2 gate: all views exist, 9/9 validation checks pass, sample outputs recorded above. |
| 2026-06-12 | 3.1 | lib/queries.ts: typed read-only query layer (overview stats, listening-over-time, top artists/albums/tracks, available years) parameterized by UTC date range + plays/minutes metric. recharts installed; better-sqlite3 marked serverExternal. Smoke-tested: all-time 123,669 meaningful plays / 6,967.8 music hours / 4,642 artists. |
| 2026-06-12 | 3.2 | Summary cards live on real data (plays/hours/artists/albums/tracks/span) as server component; empty state extracted; screenshot verified. |
| 2026-06-12 | 3.3 | Signature hero: full-width amber area chart with custom tooltip/axes/grid per design system, month/year toggle (client component, both grains preloaded). Toggle verified in browser. |
| 2026-06-12 | 3.4 | Heavy-rotation section: designed ranking lists (artists/albums/tracks) with plays↔minutes toggle via ?metric= param re-ranking server-side; §8 per-entity defaults when unset. Unit display made consistent (hours ≥ 1h). Verified in browser. |
| 2026-06-12 | 3.5 | Range control: presets all/ytd/prev/30d/90d + custom from/to date inputs in ?range= params; cards, hero, and rankings all re-query. Verified: 2025 preset's top tracks match task 2.3 SQL sample exactly (UI↔SQL reconciliation). |
| 2026-06-12 | 3.G | Phase 3 gate: lint clean, production build green, 9/9 validation, desktop+mobile screenshots verified. Overview complete on real data. |
| 2026-06-12 | 4.1 | /year: year chips (2014–2026 from data), editorial header — giant amber Fraunces year numeral + hours/plays/top-artist display stats. getTopArtistPerMonth + yearRange added to queries. 2022 header cross-checks with 2.3 yearly table. |
| 2026-06-12 | 4.2 | "the artists": top-25 ranked bar graphic in pure HTML/CSS (amber gradient bars scaled to #1, rank numerals, #1 highlighted), plays↔minutes toggle reuses ?metric=. Screenshot verified. |
| 2026-06-12 | 4.3+4.4 | "the albums"/"the tracks" dense top-25 tables (ranking column amber-highlighted per metric); "the months" strip — 12 zero-filled bars with peak month amber + top artist per month. Peak logic verified numerically (jun 70h, 2022). |
| 2026-06-12 | 4.G | Phase 4 gate: lint/build/validation green, screenshots verified. Year in review complete. |
| 2026-06-12 | 5.1 | /artists: full §6 column table (plays, time, first/last played, tracks, active years, top year, most-played track) over getArtistTable() with window-fn joins; instant client search + sort on every numeric/date column, 100-row paging. Verified: first-played asc = Eminem nov 23 2014 (first export event). |
| 2026-06-12 | 5.2 | /artists/[artist]: editorial header + 5 summary stats, "the arc" year timeline (gaps rendered, peak amber), monthly area chart in house style, top albums/tracks. Verified on City and Colour (1,551 plays / 95 h / 2023 peak). |
| 2026-06-12 | 5.3 | Validate check 8 added: top-3 artists' summary rows recomputed from listening_events with inline predicates (no views) — RHCP, Arkells, Post Malone all reconcile. 10 checks total, all green. |
| 2026-06-12 | 5.G | Phase 5 gate: lint/build green, 10/10 validation, table + detail screenshots verified. Artist explorer complete. |
| 2026-06-12 | 6.1 | /compare: two-year selects (?a=&b=), annual totals cards (year A pale gold / year B amber), side-by-side top 25, entered/left top-25 lists with rank context. getArtistYearDeltas (FULL OUTER JOIN) added. Screenshot verified 2024 vs 2025. |
| 2026-06-12 | 6.2 | Biggest rises / biggest falls (top 10 by Δ minutes, A→B trajectory shown) + prominent-in-both (shared top-25, combined time). Verified sensible: Red Clay Strays +19h discovery, Måneskin −10h fade. |
| 2026-06-13 | 6.3 | Signature visualizations: overlaid monthly curves (2024 pale gold / 2025 amber, custom tooltip+legend) and "the shuffle" rank-change slope graph (SVG, top-10 union, risers amber/fallers gray, 11+ lane with staggered labels). Screenshot verified 2024 vs 2025. |
| 2026-06-13 | 6.G | Phase 6 gate: production build green, 10/10 validation, all 5 route types 200. Section 12 acceptance criteria all met. **First meaningful release complete (Phases 0–6).** |
| 2026-06-13 | 7.x | Headless `npm run sync` (scripts/sync.ts, loads .env.local via @next/env, reuses refresh token — no browser) + scripts/sync.cmd wrapper logging to data/sync.log, for Windows Task Scheduler. Verified runs clean (exit 0). First live connect pulled 50 tracks; ~24h gap (jun 11) remains until next export re-import (dedup will merge). |
| 2026-06-13 | 7.x | Registered Windows Task Scheduler task "solostereo-sync" (every 12h, runs scripts\sync.cmd) on the owner's machine — chosen over cloud cron because DB+tokens are local. Test-fired via Task Scheduler: LastTaskResult 0, log shows clean sync. Remove with `Unregister-ScheduledTask -TaskName solostereo-sync`. Hardened settings: StartWhenAvailable=true (catch up missed runs), runs on battery; WakeToRun left off; LogonType Interactive (runs only while logged in). |
| 2026-06-13 | 7.1-7.3 | Live Spotify sync. Migration 004 (spotify_account single-row token table). Shared lib/dedup.ts so importer + API sync hash identically (validation still 10/10 → existing rows unchanged). OAuth auth-code flow (login/callback routes, state cookie, stores stable account_id + display name). lib/spotify.ts: token refresh + incremental recently-played sync into listening_events via INSERT OR IGNORE, source_filename='spotify-api', ms_played=duration_ms, cursor=last_played_at. /sync page (status, connect, sync now, disconnect) + nav link. 7.3: profile + canonical names/URIs captured (artwork deferred to Phase 8). Build green; not-configured + error paths verified in browser. Going live needs owner's Spotify dev credentials in .env.local. |
| 2026-06-14 | sync | Scheduled run was popping a console window and stealing focus from a fullscreen game. Added scripts\sync-hidden.vbs (wscript launches `npm run sync` with window style 0 = hidden) and repointed the solostereo-sync task to `wscript.exe sync-hidden.vbs` + Settings.Hidden=true. Test-fired: LastTaskResult 0, fresh sync.log entry, no window. sync.cmd kept for manual runs. |
| 2026-06-13 | design | Aesthetic refresh per owner: palette → Spotify-leaning **green on neutral near-black** (was amber/warm), one accent kept; cards softened at token level (--card barely above canvas, borders 8%) to reduce card-heaviness app-wide without restructuring pages. Year page: shrunk oversized year numeral (text-6xl/7xl), added CSS group-hover popover on top-25 artists showing their top songs that year (getYearArtistTopTracks). Compare two-series now green (present) vs light-gray (past). DESIGN.md updated. Artists/compare structurally unchanged. NB: Turbopack dev didn't invalidate globals.css token edits — had to delete .next + restart for the recolor to apply. |
| 2026-06-18 | 8.plan | Phase 8 (playlists) opened: approved plan folded into §10 as 8A–8D checklist; prior candidate sections renumbered 9/10. docs/metadata-sources-research.md added (free-source survey; decision deferred — Spotify audio-features dead for this app, layered free pipeline recommended). Branch phase-8-playlists. |
| 2026-06-18 | 8A.1 | Migration 005: playlists + playlist_tracks (draft/pushed lifecycle, recipe_key/params_json provenance, ordered tracks, FK ON DELETE CASCADE — foreign_keys pragma confirmed ON in lib/db.ts, included flag for exclude-without-delete, UNIQUE(playlist_id,uri)). migrate idempotent; listening_events unchanged (208,482). |
| 2026-06-18 | 8A.2 | lib/recipes.ts: recipe engine (Recipe/CandidateTrack/GeneratedPlaylist + RECIPES registry, read-only query_only conn) + Obsessions generator. Densest 30-day window per spotify_track_uri (two-pointer), qualifies burst-then-quiet (minBurst 6 / minBurstDays 3 / concentration 0.6 / quietMonths 12), buckets by peak-window year. scripts/recipe-preview.ts spot-check. Defaults: 8 years / 42 tracks; per-URI keying isolates abandoned vs re-released same-name tracks. tsc+lint clean. |
| 2026-06-18 | 8A.3 | Lapsed loves recipe in lib/recipes.ts (SQL GROUP BY uri: lifetime meaningful plays + MAX(played_at) + representative name via ROW_NUMBER). Qualify minPlays>=8 & last heard >= lapseMonths(18) ago; score = plays * sqrt(monthsSince); perArtistCap 2, top size 40. 898 candidates at defaults. Obsessions output unchanged; tsc+lint clean. |
| 2026-06-18 | 8A.4 | lib/playlists.ts CRUD on a writable cached connection: previewRecipe, createDraft (tx), listPlaylists/getPlaylist/getPlaylistTracks (bool coercion), rename/setPublic/setIncluded/removeTrack/reorderTracks/addTrackByUri (INSERT OR IGNORE dup)/deletePlaylist (FK cascade), searchLocalTracks (manual-add from music_listening_events). scripts/playlist-test.ts runs full lifecycle, leaves DB clean; tsc+lint clean. |

---

## 1. Product vision

Build a personal web app called **solostereo** for exploring my Spotify
listening history (2014–present, ~300k streaming events from the Extended
Streaming History export).

The initial product is a beautiful, visual listening archive. It should answer
questions such as:

- Who were my most-played artists in each year?
- What albums did I listen to most in 2022 compared with 2025?
- How has my taste shifted over time?
- Which artists have remained consistently important?
- What songs or albums did I play heavily for a short period and then abandon?
- What have I listened to recently?
- Which artists or albums have I barely explored?

Do not begin by building a recommendation engine, complex filtering rules,
playlist automation, machine-learning features, or a social product. The first
release should make my own listening data interesting, easy to browse, and
genuinely beautiful to look at.

## 2. Design philosophy — design is a core pillar

> This section supersedes the original "don't overdesign before the analytics
> are correct" stance. Design quality is a first-class requirement on equal
> footing with data correctness, not a Phase 8 polish step.

The app should look and feel like an elite designer built it: a personal music
artifact — closer to beautifully typeset liner notes or an editorial music
magazine than to an enterprise BI dashboard.

**Design direction (decided in task 0.2, then binding for every page):**

- Dark, near-black canvas with warm off-white text and one confident accent
  color. The data is the color; the chrome stays quiet.
- A distinctive display typeface for big numbers, rankings, and year
  headlines; a clean readable face for tables and body text.
- Generous whitespace, strong typographic hierarchy, compact dense tables
  where density serves the data.
- Charts are designed objects, not library defaults. Every chart gets
  deliberate axis treatment, spacing, hover states, and empty/loading states.
- Each page has one **signature visualization** that would look at home in a
  year-end editorial feature (see per-page notes in section 6).
- A simple lowercase `solostereo` wordmark.

**Design working rules:**

1. The design system (tokens, type scale, color, spacing, base components) is
   built in Phase 0, before any feature work, so every later phase builds
   *inside* the system instead of being repainted later.
2. No page ships in default-library styling. Recharts (or custom SVG) output
   must be restyled to the design system before a task is checked off.
3. Numbers must still be correct first — a beautiful wrong chart fails the
   task. Validation gates (section 9) are unchanged.
4. Responsive layout, clear empty states, and loading states are part of every
   page task, not follow-ups.

## 3. Build philosophy

Use the simplest maintainable architecture that produces a polished personal
app.

Working rules:

1. Complete one functional vertical slice before adding extra features.
2. Prefer obvious SQL queries and readable application code.
3. Keep raw imported history separate from derived analytics.
4. Never discard raw records silently. Any deliberately dropped field (e.g.
   `ip_addr`) must be documented in the README.
5. Make assumptions explicit in the README.
6. Add a validation query or test for every important transformation, wired
   into `npm run validate`.
7. Do not introduce queues, microservices, background workers, or abstractions
   unless a concrete requirement demands them.
8. Avoid speculative features.
9. Commit after every completed task; update this plan file in the same
   commit (see resume protocol above).

## 4. Technical stack

- **Frontend and application layer:** Next.js (App Router) with TypeScript
- **UI:** Tailwind CSS + shadcn/ui as the component base, restyled to the
  design system
- **Charts:** Recharts for utility charts; custom SVG (or visx) where a
  signature visualization demands it
- **Database: SQLite** via `better-sqlite3`, plain SQL migration files run by
  a small migration script
  - Rationale: single user, ~300k rows, local-first. SQLite gives
    single-digit-millisecond queries with zero network hops and zero setup —
    this is what makes the app feel lightning quick. Supabase/Postgres was
    considered and rejected for v1 because remote round-trips would make
    every dashboard load feel slow. If the app is ever deployed multi-device,
    revisit then.
  - The database file lives at `data/solostereo.db` and is gitignored.
- **Data import:** a TypeScript ingestion script run via `npm run import`
- **Authentication:** none initially; single-user local app
- Environment variables via `.env.local` with a committed `.env.example`.
- Docker: not used. Local Node + SQLite needs nothing else.
- **Git:** local repository only for now (no remote). A remote will be added
  later by the owner; never push, never add a remote.

Do not add Spotify OAuth during the first milestone. Historical JSON import
comes first.

## 5. Data sources

### 5.1 Primary source — Spotify Extended Streaming History export

The raw export already exists in this repo at
`Spotify Extended Streaming History/` (gitignored — personal data). Task 1.1
moves it to `data/raw/spotify/`.

Files: `Streaming_History_Audio_*.json` **and** `Streaming_History_Video_*.json`
(video files share the same schema and are mostly empty, but 2025/2026 have
content — import them too).

**Actual export record shape → schema field mapping:**

| Export field | DB column | Notes |
|---|---|---|
| `ts` | `played_at` | UTC ISO timestamp |
| `platform` | `platform` | |
| `ms_played` | `ms_played` | |
| `conn_country` | `country_code` | |
| `ip_addr` | — | **deliberately dropped** (privacy, no analytical value) — document in README |
| `master_metadata_track_name` | `track_name` | |
| `master_metadata_album_artist_name` | `artist_name` | |
| `master_metadata_album_album_name` | `album_name` | |
| `spotify_track_uri` | `spotify_track_uri` | |
| `episode_name` | `episode_name` | podcasts |
| `episode_show_name` | `episode_show_name` | podcasts |
| `spotify_episode_uri` | `spotify_episode_uri` | podcasts |
| `audiobook_title` | `audiobook_title` | audiobooks |
| `audiobook_uri` | `audiobook_uri` | audiobooks |
| `audiobook_chapter_uri` | `audiobook_chapter_uri` | audiobooks |
| `audiobook_chapter_title` | `audiobook_chapter_title` | audiobooks |
| `reason_start` | `reason_start` | |
| `reason_end` | `reason_end` | |
| `shuffle` | `shuffle` | |
| `skipped` | `skipped` | |
| `offline` | `offline` | |
| `offline_timestamp` | `offline_timestamp` | |
| `incognito_mode` | `incognito_mode` | |

The importer must:

- load every matching JSON file from `data/raw/spotify/`
- normalize records using the mapping above
- compute a deterministic **dedup hash** (see section 7) and rely on the
  database `UNIQUE` constraint for idempotency (`INSERT OR IGNORE`)
- retain the original source filename per row
- log how many rows were loaded / inserted / skipped per file
- be safe to rerun without duplicating records — guaranteed by the schema,
  not by importer logic

Podcast and audiobook rows are preserved in the raw table and excluded from
music analytics by the `music_listening_events` view — never deleted.

### 5.2 Known limitations of the export (document in README)

- The export contains **artist names only, no artist URIs**. All artist-level
  analytics key on the name string; an artist who changed display name appears
  as two artists. Accepted for v1.
- Timestamps are UTC. **All date bucketing is done in UTC** — late-evening
  local listening can land on the next UTC day/year. Accepted tradeoff
  (decided 2026-06-12); do not add timezone configuration.

### 5.3 Live Spotify integration

A later phase (Phase 7). Eventually use Spotify OAuth and supported Web API
endpoints to retrieve recent activity and user metadata. Do not rely on live
API endpoints for historical analytics. When added, store Spotify's stable
`account_id` as the account identifier. Never replace the historical import
with the API integration.

## 6. First-release scope — four pages

### Page 1: Overview

Dashboard with summary cards (total plays, total listening time, unique
artists / albums / tracks, earliest and latest listening date), top artists /
albums / tracks for the selected period, and listening time by month and by
year.

Date-range control with presets: all time, current year, previous year, last
30 days, last 90 days, custom range.

**Signature visualization:** a full-width listening-over-time area chart that
doubles as the page hero — a decade of listening visible at a glance.

### Page 2: Year in review

Select a year. Show top 25 artists / albums / tracks, total listening hours,
total plays, monthly listening trend, top artist for each month, a ranked
artist bar chart, ranked album and track tables. Toggle ranking between play
count and listening minutes.

**Signature visualization:** an editorial "Wrapped-style" year header — big
display numerals, ranked artist bars treated as a designed graphic.

### Page 3: Artist explorer

Sortable, searchable artist table: artist name, total plays, total listening
minutes, first-played date, most-recently-played date, distinct tracks played,
active years, most-listened year, most-played track. Sortable by every numeric
or date column.

Artist detail view: listening time by year and by month, top albums, top
tracks, first/last played, total plays, total time.

**Signature visualization:** per-artist listening-by-year timeline showing the
arc of a relationship with an artist.

### Page 4: Compare years

Select two years. Show top artists side by side; artists that entered/left the
top 25; largest increases and decreases in listening; artists prominent in
both years; annual totals; overlaid monthly listening curves.

Keep comparisons descriptive — no recommendation logic yet.

**Signature visualization:** the two years' monthly curves overlaid in a
single designed chart, plus a rank-change slope graph for top artists.

## 7. Core data model

SQLite schema, normalized but uncomplicated.

### Table: `listening_events` — one row per streaming event

```text
event_id            INTEGER PRIMARY KEY
dedup_hash          TEXT NOT NULL UNIQUE
played_at           TEXT NOT NULL        -- UTC ISO 8601
source_filename     TEXT NOT NULL
platform            TEXT
country_code        TEXT
track_name          TEXT
artist_name         TEXT
album_name          TEXT
spotify_track_uri   TEXT
episode_name        TEXT
episode_show_name   TEXT
spotify_episode_uri TEXT
audiobook_title     TEXT
audiobook_uri       TEXT
audiobook_chapter_uri   TEXT
audiobook_chapter_title TEXT
ms_played           INTEGER NOT NULL
reason_start        TEXT
reason_end          TEXT
shuffle             INTEGER              -- boolean
skipped             INTEGER              -- boolean
offline             INTEGER              -- boolean
offline_timestamp   TEXT
incognito_mode      INTEGER              -- boolean
imported_at         TEXT NOT NULL
```

Fields stay nullable where the export omits them.

**Dedup hash:** SHA-256 of
`played_at | spotify_track_uri | spotify_episode_uri | audiobook_chapter_uri | track_name | artist_name | album_name | ms_played`
(null fields as empty strings). The `UNIQUE` constraint on `dedup_hash` plus
`INSERT OR IGNORE` makes the importer idempotent at the database level.

**Indexes (required, part of the initial migration):**

```sql
CREATE UNIQUE INDEX idx_events_dedup ON listening_events(dedup_hash);
CREATE INDEX idx_events_played_at   ON listening_events(played_at);
CREATE INDEX idx_events_artist_time ON listening_events(artist_name, played_at);
CREATE INDEX idx_events_track_uri   ON listening_events(spotify_track_uri);
```

These indexes are the performance strategy. At ~300k rows, plain views over an
indexed table answer every query in this plan in single-digit milliseconds.

### Derived views

Prefer SQL views over materialized tables until performance measurably
demands otherwise (it should not at this scale). Create:

```text
music_listening_events     -- excludes podcast + audiobook rows, without deleting them
artist_summary
album_summary
track_summary
artist_year_summary
album_year_summary
track_year_summary
monthly_listening_summary
yearly_listening_summary
```

## 8. Metric definitions

Document all of these in the README.

**Play count — meaningful plays are the default.**

```text
meaningful_play = music event with ms_played >= 30000   -- DEFAULT everywhere
raw_play        = any imported music event              -- secondary metric
```

Rationale: the export logs every skip, including 2-second shuffle skips; raw
event counts pollute rankings with songs that were skipped past. The 30-second
threshold matches how Spotify itself counts a stream, so totals roughly agree
with Wrapped. Raw counts remain available as a secondary toggle.

**Listening time**

```text
listening_minutes = ms_played / 60000
listening_hours   = ms_played / 3600000
```

Listening time always sums **all** ms_played, including sub-30-second events.

**Active year:** an artist is active in a year when at least one music event
exists for that artist in that calendar year (UTC).

**Rankings:** rankable by meaningful plays or listening minutes. Default to
listening minutes for artists and albums; meaningful plays for tracks.

**Date bucketing:** UTC everywhere (see 5.2).

## 9. Data-quality checks

`npm run validate` runs every check below against the live database and
**exits non-zero on any failure**. It is the mechanical definition of done —
no task from Phase 1 onward is complete while it fails. The importer prints
the import summary and runs validation automatically after each import.

**Import summary reports:**

```text
files processed, raw rows read, rows inserted, duplicates skipped,
music rows, podcast rows, audiobook rows,
rows missing artist name, rows missing track name,
earliest event date, latest event date, total listening hours
```

**Validation checks:**

1. Importer idempotency: row count unchanged after a repeat import.
2. No event has negative `ms_played`.
3. Yearly listening totals reconcile to the full-history total.
4. Artist summary totals reconcile to music-event totals.
5. Album summary totals reconcile to events where album name is populated.
6. Podcast and audiobook records are preserved but absent from music views.
7. Every music row in rankings has a non-null artist name.

## 10. Delivery phases and tasks

> Tasks are sized so each one is independently completable and committable.
> Follow the resume protocol at the top of this file.

### Phase 0: Repository setup and design system

Goal: app launches locally, migration runs, design system exists, styled
placeholder home page displays the `solostereo` wordmark.

- [x] **0.1** Scaffold Next.js (App Router) + TypeScript + Tailwind in this
      folder. Add `.env.example`. App boots with `npm run dev`.
- [x] **0.2** Design system: choose and load typefaces (display + body),
      define color tokens (near-black canvas, warm off-white, one accent),
      type scale, and spacing in Tailwind config; set up shadcn/ui; build the
      `solostereo` wordmark and a base layout shell (nav with the four pages
      stubbed). Document the design direction in `DESIGN.md`.
- [x] **0.3** SQLite setup: `better-sqlite3`, a small migration runner
      (`npm run migrate`), and migration 001 creating `listening_events` with
      the dedup unique constraint and all indexes from section 7.
- [x] **0.4** README: setup instructions, stack rationale, assumptions
      (UTC bucketing, artist-name keying, dropped `ip_addr`).
- [x] **0.5** Styled placeholder home page: wordmark, design tokens visibly in
      use, empty-state treatment that will become the Overview page.
- [x] **0.G** Phase gate: fresh clone → `npm install`, `npm run migrate`,
      `npm run dev` all work. Report and stop.

### Phase 1: Historical data ingestion

Goal: real export imported, idempotent, validated.

- [x] **1.1** Move the raw export into `data/raw/spotify/` (gitignored).
      Create `data/fixtures/sample-history.json` with ~20 synthetic records
      covering music, podcast, audiobook, missing-field, and duplicate cases.
- [x] **1.2** Importer (`npm run import`): glob audio + video JSON files,
      normalize per the section 5.1 mapping, compute dedup hash,
      `INSERT OR IGNORE`, per-file logging.
- [x] **1.3** Import summary report printed after every run (section 9 list).
- [x] **1.4** `npm run validate` implementing all section 9 checks,
      exit non-zero on failure; importer runs it automatically.
- [x] **1.5** Run importer against the fixture **twice**; show duplicates are
      skipped on the second run. Then run against the real export twice and
      record row counts in the Progress log.
- [x] **1.6** README: where to place JSON files, how to import, what the
      summary means.
- [x] **1.G** Phase gate: report results (including real import counts) and stop.

### Phase 2: SQL analytics layer

Goal: all derived views exist and reconcile against imported data.

- [x] **2.1** `music_listening_events` view (excludes podcasts + audiobooks)
      and the three all-time summary views (artist / album / track) with both
      meaningful and raw play counts plus listening minutes.
- [x] **2.2** Year-grain views (`*_year_summary`) and
      `monthly_listening_summary` / `yearly_listening_summary`.
- [x] **2.3** Extend `npm run validate` with reconciliation checks 3–7 against
      the real data; verify top-artists/albums/tracks-by-year queries return
      sensible results.
- [x] **2.G** Phase gate: report sample query output and validation results; stop.

### Phase 3: Overview page

Goal: the all-time dashboard, fully styled, on real data.

- [x] **3.1** Server-side data access layer: typed query functions over the
      views, parameterized by date range.
- [x] **3.2** Summary cards row (plays, hours, unique artists/albums/tracks,
      first/last date) — designed, not default-styled.
- [x] **3.3** Signature hero: full-width listening-over-time area chart
      (decade view), with month/year granularity.
- [x] **3.4** Top artists / albums / tracks ranking lists for the selected
      period, with the plays ↔ minutes toggle.
- [x] **3.5** Date-range control with presets (all time, current year,
      previous year, last 30/90 days, custom) wired to everything on the page.
- [x] **3.G** Phase gate: screenshots, validation, stop.

### Phase 4: Year in review

Goal: the annual editorial page.

- [x] **4.1** Year selector (only years present in the data) + year header
      with display-numeral totals (hours, plays, top artist).
- [x] **4.2** Ranked artist bar chart (top 25) as a designed graphic;
      plays ↔ minutes toggle.
- [x] **4.3** Ranked album and track tables (top 25 each).
- [x] **4.4** Monthly listening trend + top artist per month strip.
- [x] **4.G** Phase gate: screenshots, validation, stop.

### Phase 5: Artist explorer

- [x] **5.1** Artist table: all section 6 columns, sortable on every numeric
      and date column, instant search.
- [x] **5.2** Artist detail page: listening by year (signature timeline) and
      by month, top albums, top tracks, summary stats.
- [x] **5.3** Validation: spot-check three artists — detail page totals
      reconcile to raw event queries; add as a validate check if practical.
- [x] **5.G** Phase gate: screenshots, validation, stop.

### Phase 6: Compare years

- [x] **6.1** Two-year selector + side-by-side top artists with entered/left
      top-25 lists.
- [x] **6.2** Largest increases/decreases in listening; prominent-in-both list.
- [x] **6.3** Signature visualization: overlaid monthly curves + rank-change
      slope graph.
- [x] **6.G** Phase gate: screenshots, validation, stop. **First meaningful
      release complete — check section 12 acceptance criteria.**

### Phase 7: Live Spotify connection (only after Phases 0–6 work)

- [x] **7.1** Spotify OAuth (authorization code flow), store stable `account_id`.
- [x] **7.2** Incremental recently-played retrieval into `listening_events`
      (same dedup mechanism); manual refresh action.
- [x] **7.3** Lightweight metadata retrieval where helpful.

### Phase 8: Playlist generation & Spotify round-trip (committed)

Turn listening behavior into playlists, review/edit them in-app, and push them
back to Spotify. v1 recipes: **Obsessions** (velocity bursts that went quiet)
and **Lapsed loves** (heavy historically, quiet recently). Built behavior-only;
external metadata is deferred (see `docs/metadata-sources-research.md`). Full
spec in the approved plan; concrete recipe definitions there.

**Phase 8A — Data & recipe engine (headless, script-testable)**
- [x] **8A.1** Migration 005: `playlists` + `playlist_tracks` (FK cascade,
      `UNIQUE(playlist_id, spotify_track_uri)`). `npm run migrate` idempotent.
- [x] **8A.2** `lib/recipes.ts` registry + **Obsessions** generator
      (rolling-30d burst, tunable params); scratch script, numbers spot-checked.
- [x] **8A.3** **Lapsed loves** generator; sample output spot-checked.
- [x] **8A.4** `lib/playlists.ts` CRUD + `searchLocalTracks` (writable conn);
      script: generate → persist draft → edit → read back.
- [ ] **8A.G** Gate: `npm run validate` green (new checks); CLI smoke builds
      both recipes + persists a draft; sample outputs recorded.

**Phase 8B — Review/edit UI (fully offline)**
- [ ] **8B.1** `/playlists` gallery + saved list + nav entry (DESIGN.md).
- [ ] **8B.2** Generate flow (params form → draft → redirect to editor).
- [ ] **8B.3** Editor: rename, public toggle, reorder, include/exclude, remove.
- [ ] **8B.4** Manual add via local track search.
- [ ] **8B.G** Gate: `npm run build` + lint green, screenshots; generate→edit→save offline.

**Phase 8C — Spotify round-trip (push)**
- [ ] **8C.1** Extend OAuth scopes (`playlist-modify-public/private`) +
      sync-page reconnect prompt when scopes missing.
- [ ] **8C.2** `lib/spotify.ts` create + batched add-tracks; persist Spotify
      playlist id + snapshot.
- [ ] **8C.3** Push action + confirm UI; `status='pushed'`, open-in-Spotify
      link, re-push guard. Public by default (per-playlist toggle).
- [ ] **8C.G** Gate: **live** push verified on owner's account; reconnect path
      verified; `npm run validate` green.

**Phase 8D — Docs & close-out**
- [ ] **8D.1** Update `README.md` + `plan.md` (Status, progress log, check off).
- [ ] **8D.2** Reference `docs/metadata-sources-research.md`; metadata stays a
      future, separate decision.

### Phase 9: Enrichment and quality of life (candidates, not commitments)

- [ ] Album artwork and artist artwork via the API (this is where artwork
      enters the design — slots already reserved in the layouts)
- [ ] Album explorer / track explorer
- [ ] CSV export of selected tracks
- [ ] Saved custom views
- [ ] Manual tagging of artists/albums
- [ ] Exclude specific events from analytics without deleting them
- [ ] Metadata-enriched recipes (genre/tempo/mood) — pending the decision in
      `docs/metadata-sources-research.md`

### Phase 10: Discovery features (only after the archive is useful on its own)

- [ ] Barely-explored albums from familiar artists
- [ ] Adjacent artists, new releases from known artists
- [ ] Listening queue, manual exclusions
      *(heavy-but-not-recent artists and playlist export delivered in Phase 8)*

## 11. Explicit non-goals for Phases 0–6

No machine-learning recommendations, vector embeddings, LLM features, social
features, multi-user auth, permission systems, scheduled jobs, cloud
deployment pipeline, playlist generation or syncing, audio playback, mobile
app, mood classification, genre ontology, or data-warehouse architecture.

## 12. Initial acceptance criteria

The first meaningful release is complete when:

1. I can place my Spotify history JSON files into `data/raw/spotify/` and run
   one documented import command.
2. Running the importer twice does not duplicate any records (enforced by the
   database, demonstrated in the import summary).
3. I can open the app and see my all-time top artists, albums, and tracks.
4. I can select a year and see my top artists for that year.
5. I can sort artists by plays, listening time, first-played date, and
   most-recently-played date.
6. I can compare two years and see which artists became more or less prominent.
7. `npm run validate` passes: displayed totals reconcile to the imported
   streaming history.
8. The README contains setup instructions, metric definitions, and documented
   assumptions.
9. The code is readable enough that a new developer can follow the import
   flow, SQL views, and page-level queries without reverse-engineering
   abstractions.
10. Every page conforms to the design system in `DESIGN.md` — no
    default-library styling shipped.
