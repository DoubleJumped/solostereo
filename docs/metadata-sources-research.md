# Song-metadata sources for solostereo — research & recommendation

> Status: research complete (June 2026). **Decision deferred.** This file
> exists so the owner can decide *later* whether/how to add external song
> metadata (genre, tempo/BPM, energy/mood/valence, release date). No Phase 8
> playlist work depends on it.

## 1. Summary & the hard constraint

solostereo has ~17,400 distinct Spotify track URIs but **no song attributes**
beyond artist/track/album names and play timestamps. To build future
metadata-driven recipes (e.g. "high-energy summer", "mellow late-night",
genre playlists) we'd need an external source for genre/tempo/mood.

**The constraint that rules everything out first:** on **2024-11-27 Spotify
deprecated** Audio Features, Audio Analysis, Recommendations, and Related
Artists for any app without prior extended access. solostereo's app was
created after the cutoff, so those endpoints return **403** — Spotify is *not*
a usable source for tempo/energy/mood. (Confirmed still in force in 2026.)

**However, two Spotify endpoints still work and are useful as a *bridge*:**
- **Get Track** → `external_ids.isrc`, `album.release_date`, `popularity`.
  The ISRC is the legal, stable key to join to open music databases.
- **Get Artist** → artist-level `genres` (coarse, but free and immediate).

The owner's requirement: **free, low-dependency, no fragile scraping.** No
single free source cleanly replaces Spotify's audio features post-2024, so the
recommendation is a **layered, all-free pipeline** with explicit tradeoffs.

## 2. Comparison

| Source | Attributes | Match key | Free? | Rate limit | Auth | Coverage / notes | Effort |
|---|---|---|---|---|---|---|---|
| **Spotify Get Track/Artist** (still live) | ISRC, release date, popularity, artist genres | Spotify track ID (we have it) | Yes | standard | existing OAuth | 100% of our tracks; genres only at artist level | Low |
| **MusicBrainz** | MBID, ISRC↔recording, release year, some tags | ISRC → MBID; or Spotify-URL relation | Yes | **1 req/s** | none (UA required) | Excellent IDs; tags sparse | Low/med |
| **ListenBrainz** | MBID mapping, popularity, bulk dumps | MBID / MSID | Yes | generous | optional token | Great for bulk MBID resolution | Med |
| **ReccoBeats** | tempo, energy, valence, danceability (audio-features replacement) | **Spotify track ID** | Yes | reasonable | none/key | Designed as the post-Spotify features stand-in; coverage unverified | Low |
| **GetSongBPM** (getsong.co) | BPM, key | artist+title | Yes | fair | free API key + **mandatory backlink** | BPM only; attribution required | Low |
| **Last.fm** | community tags (genre/mood proxy) | artist+track or MBID | Yes | fair | API key | Tags are the realistic free "genre/mood" signal | Low/med |
| **Deezer public API** | genre (album-level), ISRC, preview | ISRC or artist+title | Yes | fair | **none** | No-auth ISRC lookup; genre coarse | Low |
| **AcousticBrainz** | tempo, key, mood/genre models | MBID | Yes (frozen) | n/a | none | **Effectively dead** — submissions ended Jun 2022, API offline ~2023; only a frozen CC0 dump remains | Med (one-time dump join) |
| **TheAudioDB** | genre, mood, art, bio | artist/track | Free tier | low | key | Free tier gated behind Patreon for stable keys | Low |
| **Discogs** | genre, style, year | fuzzy artist+release | Yes | fair | token | Rich genre/style but fuzzy matching, no ISRC | Med |

## 3. Per-source notes (pros / cons)

- **Spotify (Get Track/Artist):** ✅ already authenticated, 100% match by ID,
  gives the ISRC that unlocks everything else. ❌ genres are artist-level only;
  no tempo/mood. Use it as the **bridge**, not the destination.
- **MusicBrainz:** ✅ authoritative IDs, ISRC lookup, CC0 data, no key. ❌ 1
  req/s means ~17k tracks ≈ a few hours one-time; tag data thin. Pair with a
  local cache table.
- **ListenBrainz:** ✅ free bulk dumps + a mapping API to resolve Spotify/ISRC
  → MBID faster than hammering MusicBrainz; popularity data. ❌ extra concepts
  (MSID/MBID) to learn.
- **ReccoBeats:** ✅ the most direct free replacement for Spotify audio
  features, *takes Spotify IDs* (no ISRC dance). ❌ third-party, longevity and
  coverage/accuracy unverified — treat as best-effort, not ground truth.
- **GetSongBPM:** ✅ free BPM/key. ❌ BPM only; **requires a visible backlink**
  on any page showing the data — a product constraint to respect.
- **Last.fm:** ✅ the practical free "genre/mood" via crowd tags
  (`track.getTopTags`). ❌ tags are noisy; needs cleaning/whitelisting.
- **Deezer:** ✅ no-auth ISRC lookup, easy. ❌ genre coarse (album/artist).
- **AcousticBrainz:** effectively defunct; only of interest as a **one-time
  CC0 dump** joined on MBID for legacy tracks. Don't build a live dependency.
- **TheAudioDB / Discogs:** usable but weaker fit (Patreon-gated keys / fuzzy
  matching) — fallbacks only.

## 4. Matching strategy (the realistic pipeline)

Our starting point per track: `spotify_track_uri`, `artist_name`,
`track_name`, `album_name`.

1. **Spotify Get Track** (batch up to 50 IDs) → store `isrc`, `release_date`,
   `popularity`. **Spotify Get Artist** → artist `genres`. This alone gives
   release-decade and a coarse genre for ~100% of tracks, cheaply.
2. **ISRC → MBID** via MusicBrainz (`/isrc/{isrc}`), falling back to the
   ListenBrainz mapper for misses. Cache MBIDs locally.
3. **Genre / mood tags** from Last.fm (`track.getTopTags`) and/or MusicBrainz
   tags, normalized against a small genre whitelist.
4. **Tempo / energy / valence** from **ReccoBeats** keyed by Spotify ID
   (no ISRC needed); **GetSongBPM** as a BPM-only fallback.
5. *(Optional, legacy)* one-time **AcousticBrainz dump** join on MBID for
   tempo/mood on older tracks.

All of this lands in a **local cache table** (e.g. `track_metadata` keyed by
`spotify_track_uri`), enriched once and refreshed lazily — never on the hot
path of a page load. Rate limits (MusicBrainz 1 req/s) make this a background
one-time backfill, not a per-request call.

## 5. Recommendation

**Adopt a layered, all-free pipeline, built in this priority order:**

1. **Spotify Get Track + Get Artist** (ISRC, release date, popularity, artist
   genres) — highest value per effort, reuses existing OAuth, 100% coverage.
   *Ship this first; it alone unlocks release-decade and coarse-genre recipes.*
2. **Last.fm tags** for finer genre/mood.
3. **ReccoBeats** (by Spotify ID) for tempo/energy/valence, with **GetSongBPM**
   as a BPM fallback.
4. **MusicBrainz/ListenBrainz** ISRC→MBID only if/when a source needs MBIDs.

**Effort estimate:** Layer 1 ≈ 0.5–1 day (batch fetch + cache table + backfill
script). Layers 2–3 ≈ 1–2 days incl. tag normalization and a tunable
enrichment job. All free; the only product obligation is GetSongBPM's backlink
if its BPM is displayed.

**The honest tradeoff:** there is **no fully-validated, free, drop-in
replacement** for Spotify's audio features. ReccoBeats is the closest but
unverified for coverage/accuracy. If audio-feature quality proves poor, fall
back to release-date + crowd-tags + popularity, which are reliable and free
and already support a lot of recipe ideas.

## 6. What to defer or skip

- **Skip** AcousticBrainz as a live dependency (dead); consider only its frozen
  dump if legacy tempo/mood ever becomes important.
- **Skip** paid/Patreon-gated tiers (TheAudioDB stable keys) and fuzzy-only
  matchers (Discogs) unless a specific recipe demands their data.
- **Defer** any audio-feature-dependent recipe until ReccoBeats coverage is
  spot-checked against a sample of our tracks.

---

*Sources:* Spotify Web API changes blog (2024-11-27,
developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); Spotify Web API
reference for Get Track / Get Artist / Create Playlist
(developer.spotify.com/documentation/web-api); MusicBrainz API docs
(musicbrainz.org/doc/MusicBrainz_API); ListenBrainz API
(listenbrainz.readthedocs.io); ReccoBeats (reccobeats.com); GetSongBPM API
(getsong.co/api); Last.fm API (last.fm/api); Deezer API
(developers.deezer.com); AcousticBrainz shutdown notice
(acousticbrainz.org). Verified current as of June 2026.
