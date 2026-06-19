import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, fmtInt } from "@/lib/format";
import { getPlaylist, getPlaylistTracks } from "@/lib/playlists";
import { RECIPES } from "@/lib/recipes";
import { PlaylistEditor } from "@/components/playlists/playlist-editor";

export const dynamic = "force-dynamic";

/** Human summary of the stored recipe params, e.g. "max 50 · year 2018". */
function paramsSummary(paramsJson: string | null): string | null {
  if (!paramsJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(paramsJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const parts = Object.entries(parsed as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .map(([k, v]) => `${k} ${v}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function PlaylistDetailPage({
  params,
}: {
  // `params` is a promise in this Next.js version — must be awaited.
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const playlist = getPlaylist(id);
  if (!playlist) notFound();

  const tracks = getPlaylistTracks(id);
  const includedCount = tracks.filter((t) => t.included).length;
  const recipe = playlist.recipeKey ? RECIPES[playlist.recipeKey] : null;
  const summary = paramsSummary(playlist.paramsJson);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 pt-2">
        <Link
          href="/playlists"
          className="text-xs lowercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          ← playlists
        </Link>

        <div className="flex flex-wrap items-center gap-3 text-xs lowercase tracking-widest text-muted-foreground">
          {recipe ? (
            <span className="text-primary">{recipe.label.toLowerCase()}</span>
          ) : (
            <span>hand-built</span>
          )}
          {summary && <span className="tabular">{summary}</span>}
          <StatusBadge status={playlist.status} />
          <span>{playlist.public ? "public" : "private"}</span>
        </div>

        <p className="tabular text-xs text-muted-foreground">
          {fmtInt(tracks.length)} tracks · {fmtInt(includedCount)} included ·
          created {fmtDate(playlist.createdAt)} · updated{" "}
          {fmtDate(playlist.updatedAt)}
        </p>
      </section>

      {/*
        TASK 8C — "push to spotify" control goes here.
        The editor below owns playlist/track editing only; the push action
        (create/update the Spotify playlist from the included tracks) is out of
        scope for 8B and should be added as its own control/section, wired to a
        future `app/api/playlists/[id]/push/route.ts`. The playlist row already
        carries `status`, `spotifyPlaylistId`, `spotifySnapshotId` and
        `pushedAt` for it to read/write.
      */}

      <PlaylistEditor
        playlist={{
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          public: playlist.public,
        }}
        tracks={tracks}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const pushed = status === "pushed";
  return (
    <span
      className={
        pushed
          ? "rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs lowercase tracking-wide text-primary"
          : "rounded-full border border-border px-2.5 py-0.5 text-xs lowercase tracking-wide text-muted-foreground"
      }
    >
      {status}
    </span>
  );
}
