# solostereo

A personal Spotify listening archive — a local web app for exploring a decade
of Extended Streaming History as a beautiful, browsable artifact.

## Setup

Requirements: Node 20+ (developed on Node 24). No Docker, no external
services.

```bash
npm install
npm run migrate     # creates data/solostereo.db and applies db/migrations/*.sql
npm run dev         # http://localhost:3000
```

Copy `.env.example` to `.env.local` if you need to override defaults (the
database path; Spotify OAuth keys are only needed for the future live
integration).

### Importing your listening history

Request the **Extended Streaming History** export from Spotify
(Privacy Settings → Download your data; it arrives as a zip after a few
days). Place the JSON files (`Streaming_History_Audio_*.json` **and**
`Streaming_History_Video_*.json` — video files share the schema and
occasionally contain real events) in `data/raw/spotify/`, then:

```bash
npm run import                  # imports data/raw/spotify/
npm run import -- <dir|file>    # or another directory / a single file
```

The importer is idempotent — rerunning it never duplicates records. Each
record gets a deterministic SHA-256 dedup hash (timestamp + URIs + names +
ms_played) with a database `UNIQUE` constraint and `INSERT OR IGNORE`, so
safety is enforced by the schema, not importer logic. The export itself
contains a handful of exact-duplicate rows; these are also collapsed.

**Reading the import summary.** After every run the importer prints per-file
counts, a summary, and runs `npm run validate` automatically:

- `raw rows read / rows inserted / duplicates skipped` — on a first import,
  inserted ≈ read (minus in-export duplicates). On a repeat import, inserted
  is 0 and every row counts as a duplicate — that is the idempotency proof.
- `music / podcast / audiobook rows` — every row is kept; podcasts and
  audiobooks are simply excluded from music analytics by a view.
- `music rows w/o artist / track` — rare export rows with missing metadata;
  they are preserved but excluded from rankings.
- `earliest / latest event, total listening hours` — quick sanity check that
  the date span and volume match what you expect.

## Live Spotify sync (optional)

The import is the authoritative record, but it lags by however long ago you
last downloaded it. The **sync** page (`/sync`) keeps the archive current by
pulling your recently played tracks straight from the Spotify Web API and
merging them into `listening_events` with the same dedup mechanism — so the
live sync and a future re-export can never double-count the same play.

**Limitations to know first:** the Web API only exposes your **last ~50
tracks** (there is no full-history endpoint), and it does not report how long
each track was listened to. So: sync often enough that you don't play more
than 50 tracks between runs, synced rows use the track's full length for
listening time, and synced rows are tagged `source_filename = 'spotify-api'`
so they stay distinguishable from the export. Podcasts aren't returned by this
endpoint — they still come only from the export.

### One-time setup

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and **Create app** (any name/description; it can be in development mode —
   no review needed for personal use).
2. In the app's **Settings → Redirect URIs**, add this value **exactly**:

   ```
   http://127.0.0.1:3000/api/spotify/callback
   ```

   Spotify requires a loopback IP (`127.0.0.1`), not `localhost`, for `http`
   redirect URIs. If you run the app on a different port, change `3000` here
   and in `SPOTIFY_REDIRECT_URI` to match.
3. Copy the app's **Client ID** and **Client secret** (under Settings).
4. Create `.env.local` in the project root (copy from `.env.example`) and fill
   in:

   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
   ```
5. Restart the dev server (`npm run dev`) so it picks up the new env vars.

### Connecting and syncing

1. Open the app at **`http://127.0.0.1:3000`** (use `127.0.0.1`, not
   `localhost`, so the OAuth redirect matches) and go to **sync** in the nav.
2. Click **connect spotify**, approve the read-only access request, and you'll
   land back on the sync page showing your account.
3. Click **sync now** whenever you want to pull the latest plays. The result
   line shows how many tracks were fetched, how many were new, and how many
   were already in the archive. Tokens refresh automatically; **disconnect**
   forgets them (your synced rows stay).

## Stack and rationale

- **Next.js (App Router) + TypeScript**, Tailwind CSS v4 + shadcn/ui restyled
  to the design system in [DESIGN.md](DESIGN.md).
- **SQLite via better-sqlite3**, plain SQL migrations in `db/migrations/`.
  Single user, ~300k rows, local-first: SQLite answers every query here in
  single-digit milliseconds with zero network hops and zero setup. A hosted
  Postgres was considered and rejected for v1 — remote round-trips would make
  every dashboard load feel slow.
- Raw imported history (`listening_events`) is kept separate from derived
  analytics (SQL views). Raw records are never deleted or silently dropped.

## Documented assumptions and tradeoffs

- **UTC bucketing.** Export timestamps are UTC and all date bucketing (days,
  months, years) is done in UTC. Late-evening local listening can land on the
  next UTC day/year. Decided 2026-06-12; there is deliberately no timezone
  configuration.
- **Artists are keyed by name string.** The export contains artist names but
  no artist URIs, so all artist-level analytics key on the name. An artist who
  changed display name appears as two artists. Accepted for v1.
- **`ip_addr` is deliberately dropped** at import time — privacy, and no
  analytical value. Every other export field is preserved.
- **Podcast and audiobook rows are preserved** in `listening_events` but
  excluded from music analytics by the `music_listening_events` view. Nothing
  is deleted.

## Metric definitions

- **Meaningful play (default play count everywhere):** a music event with
  `ms_played >= 30000`. The export logs every skip, including 2-second
  shuffle skips; raw event counts would pollute rankings with songs that were
  skipped past. 30 seconds matches how Spotify itself counts a stream, so
  totals roughly agree with Wrapped.
- **Raw play (secondary, available as a toggle):** any imported music event.
- **Listening time:** `ms_played / 60000` minutes (or `/ 3600000` hours),
  summing **all** events including sub-30-second ones.
- **Active year:** an artist is active in a year when at least one music
  event exists for that artist in that calendar year (UTC).
- **Rankings:** artists and albums default to listening minutes; tracks
  default to meaningful plays. Both orderings are available.

## Project layout

```
app/              Next.js App Router pages (overview, year, artists, compare)
components/       bespoke components; components/ui/ is shadcn-generated
db/migrations/    plain SQL migrations, applied in filename order
lib/              shared code (db connection, query layer)
scripts/          migrate / import / validate CLI scripts
data/             SQLite db + raw export (gitignored — personal data)
plan.md           project plan and single source of truth for status
DESIGN.md         binding design system
```

## Validation

`npm run validate` (from Phase 1) runs every data-quality check against the
live database and exits non-zero on any failure — importer idempotency,
no negative `ms_played`, yearly totals reconciling to all-time totals,
summary views reconciling to raw events, and podcast/audiobook exclusion
from music views. It is the mechanical definition of done for data tasks.
