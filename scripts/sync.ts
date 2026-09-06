/**
 * Headless Spotify sync (for schedulers — Windows Task Scheduler, etc.).
 *
 * Usage: npm run sync
 *
 * Uses the refresh token stored at connect time, so no browser is needed.
 * Runs every two hours and follows all available pages. Spotify does not
 * guarantee a complete historical archive. Exits non-zero
 * on failure so a scheduler can detect problems.
 */
import { loadEnvConfig } from "@next/env";
// Standalone scripts don't get Next's automatic .env.local loading.
loadEnvConfig(process.cwd());

import { syncRecentlyPlayed } from "../lib/spotify";

async function main() {
  const stamp = new Date().toISOString();
  try {
    const r = await syncRecentlyPlayed();
    console.log(
      `[${stamp}] sync ok: fetched ${r.fetched}, added ${r.inserted} new, ` +
        `${r.skipped} already had across ${r.pages} page(s)${r.possibleGap ? " — WARNING: final page was full; Spotify may not expose all older plays" : ""}`,
    );
  } catch (e) {
    console.error(`[${stamp}] sync failed: ${(e as Error).message}`);
    process.exit(1);
  }
}

main();
