import Link from "next/link";
import { fmtInt } from "@/lib/format";
import { listPlaylists } from "@/lib/playlists";
import { RECIPES } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export default async function PlaylistsPage() {
  const recipes = Object.values(RECIPES);
  const playlists = listPlaylists();

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-2">
        <h1 className="font-display text-5xl lowercase tracking-tight">
          playlists
        </h1>
        <p className="mt-1 max-w-xl text-sm lowercase text-muted-foreground">
          turn the archive into playlists — pick a recipe, tune it, and build a
          draft you can edit before pushing to spotify.
        </p>
      </section>

      {/* recipe gallery */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          recipes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <div
              key={recipe.key}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6"
            >
              <h3 className="font-display text-xl lowercase tracking-tight">
                {recipe.label.toLowerCase()}
              </h3>
              <p className="flex-1 text-sm text-muted-foreground">
                {recipe.description}
              </p>
              <div>
                <Link
                  href={`/playlists/new?recipe=${recipe.key}`}
                  className="lcd-glow inline-block rounded-sm border border-primary/60 bg-primary/15 px-4 py-1 font-display text-base lowercase tracking-wide text-primary transition-colors hover:bg-primary/25"
                >
                  generate
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* saved playlists */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          saved
        </h2>
        {playlists.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm lowercase text-muted-foreground">
            no playlists yet — generate one from a recipe above to get started.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {playlists.map((p) => {
              const recipe = p.recipeKey ? RECIPES[p.recipeKey] : null;
              return (
                <li key={p.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/playlists/${p.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-card px-5 py-4 transition-colors hover:bg-border/30"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-base lowercase">
                        {p.name}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {fmtInt(p.trackCount)} tracks · {fmtInt(p.includedCount)}{" "}
                        included
                        {recipe ? ` · ${recipe.label.toLowerCase()}` : ""}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={p.status} />
                      <span className="text-xs lowercase tracking-widest text-muted-foreground">
                        {p.public ? "public" : "private"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const pushed = status === "pushed";
  return (
    <span
      className={
        pushed
          ? "rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs lowercase tracking-wide text-primary"
          : "rounded-sm border border-border px-2.5 py-0.5 text-xs lowercase tracking-wide text-muted-foreground"
      }
    >
      {status}
    </span>
  );
}
