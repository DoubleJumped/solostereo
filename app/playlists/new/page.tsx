import Link from "next/link";
import { fmtInt } from "@/lib/format";
import { previewRecipe } from "@/lib/playlists";
import { getArtistTable } from "@/lib/queries";
import { RECIPES } from "@/lib/recipes";
import { GenerateForm } from "@/components/playlists/generate-form";

export const dynamic = "force-dynamic";

export default async function NewPlaylistPage({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  const { recipe: recipeKey } = await searchParams;
  const recipe = recipeKey ? RECIPES[recipeKey] : undefined;

  if (!recipe) {
    return (
      <div className="flex flex-col gap-6 pt-2">
        <h1 className="font-display text-5xl lowercase tracking-tight">
          generate
        </h1>
        <p className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm lowercase text-muted-foreground">
          {recipeKey
            ? `unknown recipe "${recipeKey}".`
            : "no recipe chosen."}{" "}
          <Link href="/playlists" className="text-primary hover:opacity-90">
            back to playlists
          </Link>
        </p>
      </div>
    );
  }

  // Preview with default params so the user can see what they'll get.
  const preview = previewRecipe(recipe.key);

  // Recipes with a string param (e.g. an artist name) get an autocomplete list
  // of the user's artists, most-listened first. The field is free-text so any
  // exact name still works — the cap just keeps the inlined <datalist> light
  // (the full library can be several thousand artists). Skip the query
  // otherwise.
  const needsArtists = Object.values(recipe.defaultParams).some(
    (v) => typeof v === "string",
  );
  const artists = needsArtists
    ? getArtistTable()
        .slice(0, 1000)
        .map((a) => a.artistName)
    : [];

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-2">
        <Link
          href="/playlists"
          className="text-xs lowercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          ← playlists
        </Link>
        <h1 className="mt-2 font-display text-5xl lowercase tracking-tight">
          {recipe.label.toLowerCase()}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {recipe.description}
        </p>
      </section>

      <GenerateForm
        recipeKey={recipe.key}
        defaultParams={recipe.defaultParams}
        artists={artists}
        preview={preview.map((p) => ({
          name: p.name,
          trackCount: p.tracks.length,
          year:
            typeof p.params.year === "number" ? p.params.year : undefined,
        }))}
      />

      {preview.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl lowercase tracking-tight">
            preview
          </h2>
          <p className="text-sm lowercase text-muted-foreground">
            with the default settings, this recipe would build{" "}
            {preview.length === 1
              ? "one playlist"
              : `${fmtInt(preview.length)} playlists`}
            :
          </p>
          <ul className="overflow-hidden rounded-lg border border-border">
            {preview.map((p, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-4 border-b border-border bg-card px-5 py-3 last:border-b-0"
              >
                <span className="text-sm lowercase">{p.name}</span>
                <span className="tabular text-xs text-muted-foreground">
                  {fmtInt(p.tracks.length)} tracks
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
