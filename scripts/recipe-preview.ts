/**
 * Dev spot-check harness for playlist recipes (task 8A.2).
 *
 *   npx tsx scripts/recipe-preview.ts [recipeKey]
 *
 * Runs a recipe with its default params and prints, per generated playlist,
 * the name, track count, and top ~10 tracks (artist — track — score — reason).
 * Defaults to `obsessions`. Not wired into the app; this is the place to
 * sanity-check that the numbers look right before building UI on top.
 */
import { RECIPES } from "../lib/recipes";

const TOP_N = 10;

function main() {
  const key = process.argv[2] ?? "obsessions";
  const recipe = RECIPES[key];
  if (!recipe) {
    console.error(
      `Unknown recipe "${key}". Available: ${Object.keys(RECIPES).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Recipe: ${recipe.label} (${recipe.key})`);
  console.log(`Params: ${JSON.stringify(recipe.defaultParams)}`);
  console.log("");

  const playlists = recipe.generate(recipe.defaultParams);
  if (playlists.length === 0) {
    console.log("No playlists generated at default params.");
    return;
  }

  let totalTracks = 0;
  for (const pl of playlists) {
    totalTracks += pl.tracks.length;
    console.log(`=== ${pl.name} (${pl.tracks.length} tracks) ===`);
    for (const t of pl.tracks.slice(0, TOP_N)) {
      const artist = t.artist ?? "?";
      const track = t.track ?? "?";
      console.log(
        `  ${artist} — ${track}  [score ${t.score.toFixed(2)}]  ${t.reason}`,
      );
    }
    console.log("");
  }

  console.log(
    `Summary: ${playlists.length} playlist(s), ${totalTracks} total tracks.`,
  );
}

main();
