/**
 * End-to-end smoke test for the playlist CRUD layer (task 8A.4).
 *
 *   npx tsx scripts/playlist-test.ts
 *
 * Runs against the LIVE database but leaves it clean: it creates a draft from
 * a recipe, exercises every mutation (rename / public / include / manual-add +
 * dup / reorder / remove), then deletes the playlist and asserts the playlist
 * count returns to its baseline. Exits non-zero on any failed assertion. Safe
 * to re-run — the baseline must be stable across runs.
 */
import {
  previewRecipe,
  createDraft,
  listPlaylists,
  getPlaylist,
  getPlaylistTracks,
  renamePlaylist,
  setPublic,
  setIncluded,
  removeTrack,
  reorderTracks,
  addTrackByUri,
  deletePlaylist,
  searchLocalTracks,
} from "../lib/playlists";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  ok: ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
}

function main(): void {
  // 1. Baseline.
  const baseline = listPlaylists().length;
  console.log(`1. Baseline playlist count: ${baseline}`);

  // 2. Preview a recipe and persist the first generated playlist.
  const generated = previewRecipe("obsessions");
  assert(generated.length > 0, "obsessions produced at least one playlist");
  const gp = generated[0];
  const id = createDraft(gp);
  console.log(
    `2. Created draft id=${id} "${gp.name}" with ${gp.tracks.length} tracks`,
  );
  assert(id > 0, "createDraft returned a positive id");
  assert(
    listPlaylists().length === baseline + 1,
    "playlist count went up by one",
  );

  // 3. Round-trip read.
  const row = getPlaylist(id);
  assert(row !== null, "getPlaylist found the draft");
  assert(row?.status === "draft", "status is 'draft'");
  assert(row?.public === true, "public defaults to true");
  assert(row?.recipeKey === "obsessions", "recipe_key persisted");
  let tracks = getPlaylistTracks(id);
  console.log(`3. Read back ${tracks.length} tracks`);
  assert(
    tracks.length === gp.tracks.length,
    "track count persisted matches generated",
  );
  const positionsOk = tracks.every((t, i) => t.position === i);
  assert(positionsOk, "positions are 0..n-1 in order");

  // 4. Edits.
  console.log("4. Editing...");
  renamePlaylist(id, "Test Playlist 8A.4", "temporary test description");
  const renamed = getPlaylist(id);
  assert(renamed?.name === "Test Playlist 8A.4", "renamePlaylist applied name");
  assert(
    renamed?.description === "temporary test description",
    "renamePlaylist applied description",
  );

  setPublic(id, false);
  assert(getPlaylist(id)?.public === false, "setPublic(false) applied");

  const firstTrackId = tracks[0].id;
  setIncluded(firstTrackId, false);
  const afterExclude = getPlaylistTracks(id).find((t) => t.id === firstTrackId);
  assert(afterExclude?.included === false, "setIncluded(false) applied");

  const search = searchLocalTracks("the");
  console.log(`   searchLocalTracks("the") -> ${search.length} results`);
  for (const s of search.slice(0, 3)) {
    console.log(`     ${s.artist} — ${s.track}  [${s.plays} plays]  ${s.uri}`);
  }
  assert(search.length > 0, "searchLocalTracks found matches");

  // Pick a uri not already in the playlist.
  const existingUris = new Set(tracks.map((t) => t.uri));
  const pick = search.find((s) => !existingUris.has(s.uri));
  assert(pick !== undefined, "found a local track not already in the playlist");
  if (pick) {
    const add1 = addTrackByUri(id, {
      uri: pick.uri,
      artist: pick.artist ?? undefined,
      track: pick.track ?? undefined,
      album: pick.album ?? undefined,
    });
    assert(add1.added === true, "addTrackByUri added a new track");
    const add2 = addTrackByUri(id, { uri: pick.uri });
    assert(add2.added === false, "addTrackByUri rejected the duplicate uri");
  }

  // Reorder: reverse the current order.
  tracks = getPlaylistTracks(id);
  const reversed = [...tracks].reverse().map((t) => t.id);
  reorderTracks(id, reversed);
  const afterReorder = getPlaylistTracks(id);
  const reorderOk =
    afterReorder.every((t, i) => t.position === i) &&
    afterReorder.map((t) => t.id).join(",") === reversed.join(",");
  assert(reorderOk, "reorderTracks reversed order and reassigned positions");

  // Remove the (new) last track.
  const countBeforeRemove = afterReorder.length;
  removeTrack(afterReorder[afterReorder.length - 1].id);
  assert(
    getPlaylistTracks(id).length === countBeforeRemove - 1,
    "removeTrack dropped one track",
  );

  // 5. Final state.
  const finalTracks = getPlaylistTracks(id);
  const finalRow = getPlaylist(id);
  console.log(
    `5. Final state: "${finalRow?.name}" public=${finalRow?.public} tracks=${finalTracks.length}`,
  );

  // 6. Delete and confirm cascade + baseline restored.
  deletePlaylist(id);
  assert(getPlaylist(id) === null, "deletePlaylist removed the row");
  assert(
    getPlaylistTracks(id).length === 0,
    "tracks cascaded away after delete",
  );
  assert(
    listPlaylists().length === baseline,
    "playlist count back to baseline",
  );
  console.log(`6. Deleted id=${id}; baseline restored (${baseline}).`);

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) FAILED.`);
    process.exit(1);
  }
  console.log("\nAll assertions passed.");
}

main();
