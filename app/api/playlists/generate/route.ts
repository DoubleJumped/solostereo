import { NextResponse } from "next/server";
import { createDraft, previewRecipe } from "@/lib/playlists";
import { RECIPES } from "@/lib/recipes";

/**
 * Generate playlist draft(s) from a recipe (tasks 8B.2).
 *
 * Body: `{ recipeKey, params?, which? }`.
 *  - `recipeKey` must name a known recipe (else 400).
 *  - `params` are merged over the recipe defaults by `previewRecipe`; any
 *    numeric values are validated as finite numbers.
 *  - `which` (optional) names a single generated playlist to persist; "all"
 *    creates every generated playlist; omitted defaults to the first.
 *
 * Returns `{ ids: number[] }` — the ids of the created drafts.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      recipeKey?: unknown;
      params?: unknown;
      which?: unknown;
    };

    const recipeKey = body.recipeKey;
    if (typeof recipeKey !== "string" || !RECIPES[recipeKey]) {
      return NextResponse.json(
        { error: `Unknown recipe "${String(recipeKey)}".` },
        { status: 400 },
      );
    }

    // Validate params: must be a plain object of finite numbers (the recipe
    // params are all numeric). Reject anything unparseable.
    const rawParams =
      body.params && typeof body.params === "object" && !Array.isArray(body.params)
        ? (body.params as Record<string, unknown>)
        : {};
    const params: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawParams)) {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { error: `Parameter "${k}" must be a finite number.` },
          { status: 400 },
        );
      }
      params[k] = n;
    }

    const generated = previewRecipe(recipeKey, params);
    if (generated.length === 0) {
      return NextResponse.json({ ids: [] });
    }

    // Choose which generated playlist(s) to persist.
    const which = typeof body.which === "string" ? body.which : undefined;
    let chosen = generated;
    if (which && which !== "all") {
      const match = generated.find((g) => g.name === which);
      chosen = match ? [match] : [generated[0]];
    } else if (!which) {
      chosen = [generated[0]];
    }

    const ids = chosen.map((g) => createDraft(g));
    return NextResponse.json({ ids });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
