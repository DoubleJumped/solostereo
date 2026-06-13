/**
 * Headless Spotify sync (for schedulers — Windows Task Scheduler, etc.).
 *
 * Usage: npm run sync
 *
 * Uses the refresh token stored at connect time, so no browser is needed.
 * Run this on a schedule frequently enough that you never play more than ~50
 * tracks between runs (the Web API only exposes your last ~50). Exits non-zero
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
        `${r.skipped} already had${r.fetched >= 50 ? " — WARNING: hit the 50-track cap, sync more often to avoid gaps" : ""}`,
    );
  } catch (e) {
    console.error(`[${stamp}] sync failed: ${(e as Error).message}`);
    process.exit(1);
  }
}

main();
