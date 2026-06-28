"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** A previewed (default-params) generated playlist, slimmed for the picker. */
export interface PreviewItem {
  name: string;
  trackCount: number;
  /** Present for multi-playlist recipes bucketed by year (obsessions). */
  year?: number;
}

/** Per-param UI hints: label, step, and a sane clamp range. */
interface FieldSpec {
  label: string;
  min: number;
  max: number;
  step: number;
}

const FIELD_SPECS: Record<string, FieldSpec> = {
  minBurst: { label: "min burst plays", min: 1, max: 100, step: 1 },
  minBurstDays: { label: "min burst days", min: 1, max: 30, step: 1 },
  concentration: { label: "concentration (0–1)", min: 0, max: 1, step: 0.05 },
  quietMonths: { label: "quiet for (months)", min: 1, max: 120, step: 1 },
  size: { label: "max tracks", min: 1, max: 200, step: 1 },
  perArtistCap: { label: "max per artist", min: 1, max: 20, step: 1 },
  minPlays: { label: "min lifetime plays", min: 1, max: 500, step: 1 },
  lapseMonths: { label: "lapsed for (months)", min: 1, max: 120, step: 1 },
  dominance: {
    label: "dominance (top track's share of the artist's plays, 0–1)",
    min: 0,
    max: 1,
    step: 0.05,
  },
  minArtistPlays: {
    label: "min artist plays (total plays for an artist to qualify)",
    min: 1,
    max: 500,
    step: 1,
  },
  minDistinctTracks: {
    label: "min distinct tracks (different songs played by the artist)",
    min: 1,
    max: 50,
    step: 1,
  },
  perArtist: {
    label: "per artist (tracks kept from each artist)",
    min: 1,
    max: 20,
    step: 1,
  },
  topArtists: {
    label: "top artists (how many artists to draw from)",
    min: 1,
    max: 200,
    step: 1,
  },
  artists: {
    label: "artists (how many artists to draw from)",
    min: 1,
    max: 200,
    step: 1,
  },
  minArtistYears: {
    label: "min artist years (distinct years I've played the artist)",
    min: 1,
    max: 30,
    step: 1,
  },
  perArtistTrackMinPlays: {
    label: "per-artist track min plays (plays a track needs to count)",
    min: 1,
    max: 100,
    step: 1,
  },
  minYears: {
    label: "min years (distinct years the track was played)",
    min: 1,
    max: 30,
    step: 1,
  },
  minGapMonths: {
    label: "min gap (months) (silence before the comeback)",
    min: 1,
    max: 120,
    step: 1,
  },
  gapMonths: {
    label: "gap (months) (silence separating listening spells)",
    min: 1,
    max: 120,
    step: 1,
  },
  minClusterPlays: {
    label: "min cluster plays (plays to count as a listening spell)",
    min: 1,
    max: 100,
    step: 1,
  },
  minClusters: {
    label: "min clusters (separate listening spells required)",
    min: 1,
    max: 20,
    step: 1,
  },
  windowDays: {
    label: "window (days) (length of the listening window)",
    min: 1,
    max: 120,
    step: 1,
  },
  minPlaysInWindow: {
    label: "min plays in window (plays inside the window to qualify)",
    min: 1,
    max: 100,
    step: 1,
  },
};

/** Per-string-param UI hints: label and placeholder. */
const STRING_FIELD_SPECS: Record<
  string,
  { label: string; placeholder?: string }
> = {
  artist: {
    label: "artist (exact name from your listening history)",
    placeholder: "start typing an artist…",
  },
};

const ALL_YEARS = "__all__";

export function GenerateForm({
  recipeKey,
  defaultParams,
  preview,
  artists = [],
}: {
  recipeKey: string;
  defaultParams: Record<string, unknown>;
  preview: PreviewItem[];
  /** Known artist names, for autocompleting string params like `artist`. */
  artists?: string[];
}) {
  const router = useRouter();

  // Numeric params only; `year` is steered via the picker below, not a field.
  const numericKeys = Object.keys(defaultParams).filter(
    (k) => k !== "year" && typeof defaultParams[k] === "number",
  );
  // String params (e.g. an artist name) get a text field with autocomplete.
  const stringKeys = Object.keys(defaultParams).filter(
    (k) => typeof defaultParams[k] === "string",
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of numericKeys) init[k] = String(defaultParams[k]);
    for (const k of stringKeys) init[k] = String(defaultParams[k]);
    return init;
  });

  // Multi-playlist (year-bucketed) recipes get a "which" picker.
  const multi = preview.length > 1 && preview.every((p) => p.year !== undefined);
  const [which, setWhich] = useState<string>(ALL_YEARS);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, raw: string) {
    setValues((v) => ({ ...v, [key]: raw }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const params: Record<string, number | string> = {};
    for (const k of stringKeys) {
      const val = values[k].trim();
      if (!val) {
        setError(`"${STRING_FIELD_SPECS[k]?.label ?? k}" is required.`);
        setBusy(false);
        return;
      }
      params[k] = val;
    }
    for (const k of numericKeys) {
      const n = Number(values[k]);
      if (!Number.isFinite(n)) {
        setError(`"${FIELD_SPECS[k]?.label ?? k}" must be a number.`);
        setBusy(false);
        return;
      }
      params[k] = n;
    }

    // For year-bucketed recipes, a specific pick narrows the recipe to that
    // year via its own `year` param; the API also accepts `which` by name.
    let whichName: string | undefined;
    if (multi && which !== ALL_YEARS) {
      const picked = preview.find((p) => String(p.year) === which);
      whichName = picked?.name;
      if (picked?.year !== undefined) params.year = picked.year;
    }

    try {
      const res = await fetch("/api/playlists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeKey, params, which: whichName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generate failed");
      const ids: number[] = data.ids ?? [];
      if (ids.length === 0) throw new Error("nothing matched these settings.");
      router.push(ids.length === 1 ? `/playlists/${ids[0]}` : "/playlists");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6"
    >
      <h2 className="font-display text-2xl lowercase tracking-tight">
        settings
      </h2>

      {stringKeys.map((k) => {
        const spec = STRING_FIELD_SPECS[k];
        const listId = artists.length > 0 ? `${k}-options` : undefined;
        return (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-xs lowercase tracking-widest text-muted-foreground">
              {spec?.label ?? k}
            </span>
            <input
              type="text"
              list={listId}
              value={values[k]}
              placeholder={spec?.placeholder}
              autoComplete="off"
              onChange={(e) => setField(k, e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
            {listId && (
              <datalist id={listId}>
                {artists.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            )}
          </label>
        );
      })}

      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {numericKeys.map((k) => {
          const spec = FIELD_SPECS[k];
          return (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-xs lowercase tracking-widest text-muted-foreground">
                {spec?.label ?? k}
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={values[k]}
                min={spec?.min}
                max={spec?.max}
                step={spec?.step ?? 1}
                onChange={(e) => setField(k, e.target.value)}
                className="tabular w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          );
        })}
      </div>

      {multi && (
        <label className="flex flex-col gap-1">
          <span className="text-xs lowercase tracking-widest text-muted-foreground">
            which playlist
          </span>
          <select
            value={which}
            onChange={(e) => setWhich(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm lowercase text-foreground outline-none focus:border-primary"
          >
            <option value={ALL_YEARS}>all years</option>
            {preview.map((p) => (
              <option key={p.year} value={String(p.year)}>
                {p.name.toLowerCase()} ({p.trackCount} tracks)
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            tweaking the numbers above re-runs the recipe — the year list may
            shift from the preview below.
          </span>
        </label>
      )}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-foreground">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-primary px-4 py-1.5 text-sm lowercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "generating…" : "create draft"}
        </button>
      </div>
    </form>
  );
}
