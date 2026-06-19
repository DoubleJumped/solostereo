/**
 * Phase 8A gate smoke (task 8A.G): generate both v1 recipes, persist a draft
 * of each, run the full data-quality validation (which now includes check 9,
 * playlist referential integrity, against real persisted rows), then delete
 * the drafts and confirm the playlist count returns to its baseline.
 *
 * Leaves the database exactly as it found it. Exits non-zero on any failure.
 *
 *   npx tsx scripts/recipe-smoke.ts
 */
import { openDb } from "../lib/db";
import {
  createDraft,
  deletePlaylist,
  listPlaylists,
  previewRecipe,
} from "../lib/playlists";
import { printValidation, runValidation } from "../lib/validate";

let failed = false;
function check(ok: boolean, label: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
}

const baseline = listPlaylists().length;
console.log(`baseline playlists: ${baseline}\n`);

// 1. Generate both recipes at default params.
const obsessions = previewRecipe("obsessions");
const lapsed = previewRecipe("lapsedLoves");
console.log(
  `obsessions: ${obsessions.length} playlist(s), ` +
    `${obsessions.reduce((n, p) => n + p.tracks.length, 0)} tracks total`,
);
console.log(
  `lapsedLoves: ${lapsed.length} playlist(s), ${lapsed[0]?.tracks.length ?? 0} tracks\n`,
);
check(obsessions.length > 0, "obsessions produced at least one playlist");
check(lapsed.length === 1 && lapsed[0].tracks.length > 0, "lapsedLoves produced a populated playlist");

// 2. Persist a draft of each (the most recent obsessions year + lapsed loves).
const ids: number[] = [];
ids.push(createDraft(obsessions[0]));
ids.push(createDraft(lapsed[0]));
console.log(`created drafts: ${ids.join(", ")}\n`);
check(listPlaylists().length === baseline + 2, "two drafts persisted");

// 3. Full validation, on a fresh connection that sees the committed drafts.
const db = openDb();
const results = runValidation(db);
const green = printValidation(results);
db.close();
const check9 = results.find((r) => r.name.startsWith("9 "));
check(green, "all validation checks pass");
check(
  check9?.status === "pass" && /[1-9]\d* playlist track/.test(check9.detail),
  "check 9 ran against real playlist rows and passed",
);

// 4. Clean up: delete the drafts, confirm baseline restored.
for (const id of ids) deletePlaylist(id);
check(listPlaylists().length === baseline, "drafts removed, baseline restored");

console.log(failed ? "\nSMOKE FAILED" : "\nsmoke ok");
process.exit(failed ? 1 : 0);
