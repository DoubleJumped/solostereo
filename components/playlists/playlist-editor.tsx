"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtInt } from "@/lib/format";
import type { LocalTrack, PlaylistTrackRow } from "@/lib/playlists";

/** The slim playlist shape the editor needs (the page passes this down). */
interface EditablePlaylist {
  id: number;
  name: string;
  description: string | null;
  public: boolean;
  status: string;
  spotifyPlaylistId: string | null;
}

/**
 * Interactive playlist editor (tasks 8B.3 + 8B.4). Each action calls a JSON
 * API route and then `router.refresh()` to re-pull the server-rendered state —
 * the same fetch → refresh pattern as components/sync/sync-controls.tsx. This
 * keeps the UI simple and authoritative (no optimistic divergence) at the cost
 * of a round-trip per action, which is fine for a single-user local app.
 */
export function PlaylistEditor({
  playlist,
  tracks,
  includedCount,
}: {
  playlist: EditablePlaylist;
  tracks: PlaylistTrackRow[];
  includedCount: number;
}) {
  const router = useRouter();
  const base = `/api/playlists/${playlist.id}`;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local editable copies for the name/description fields.
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const dirty =
    name.trim() !== playlist.name ||
    description !== (playlist.description ?? "");

  /** Run a mutating request, surface errors, refresh on success. */
  async function run(
    url: string,
    init: RequestInit,
  ): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) throw new Error((data.error as string) ?? "request failed");
      router.refresh();
      return data;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails() {
    if (name.trim() === "") {
      setError("name can’t be empty.");
      return;
    }
    await run(base, {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim(), description }),
    });
  }

  async function togglePublic() {
    await run(base, {
      method: "PATCH",
      body: JSON.stringify({ public: !playlist.public }),
    });
  }

  async function setIncluded(trackId: number, included: boolean) {
    await run(`${base}/tracks/${trackId}`, {
      method: "PATCH",
      body: JSON.stringify({ included }),
    });
  }

  async function remove(trackId: number) {
    await run(`${base}/tracks/${trackId}`, { method: "DELETE" });
  }

  /** Move a track up/down by swapping with its neighbour, then send the full order. */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= tracks.length) return;
    const order = tracks.map((t) => t.id);
    [order[index], order[target]] = [order[target], order[index]];
    await run(`${base}/tracks`, {
      method: "PATCH",
      body: JSON.stringify({ orderedTrackIds: order }),
    });
  }

  async function deletePlaylist() {
    if (!confirm("delete this playlist? this can’t be undone.")) return;
    const ok = await run(base, { method: "DELETE" });
    if (ok) router.push("/playlists");
  }

  // --- push to spotify (8C.3) --------------------------------------------
  const alreadyPushed = playlist.status === "pushed";
  const [pushing, setPushing] = useState(false);
  // On success we surface the open-in-spotify url; null until pushed.
  const [pushedUrl, setPushedUrl] = useState<string | null>(
    alreadyPushed && playlist.spotifyPlaylistId
      ? `https://open.spotify.com/playlist/${playlist.spotifyPlaylistId}`
      : null,
  );
  // A reconnect/not-connected/not-configured message with a link to /sync.
  const [pushNotice, setPushNotice] = useState<{
    text: string;
    link?: boolean;
  } | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  async function push() {
    if (includedCount === 0) {
      setPushError("no included tracks to push.");
      return;
    }
    const verb = alreadyPushed ? "update" : "push";
    if (
      !confirm(
        `${verb} this playlist on your real spotify account? this writes ${includedCount} track${
          includedCount === 1 ? "" : "s"
        } to spotify.`,
      )
    ) {
      return;
    }
    setPushing(true);
    setPushError(null);
    setPushNotice(null);
    try {
      const res = await fetch(`${base}/push`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        url?: string;
      };
      if (!res.ok) {
        if (data.error === "reconnect" || data.error === "not_connected") {
          setPushNotice({
            text:
              data.message ??
              (data.error === "not_connected"
                ? "connect spotify to push playlists."
                : "reconnect spotify to grant playlist permissions."),
            link: true,
          });
          return;
        }
        if (data.error === "not_configured") {
          setPushNotice({
            text: "spotify credentials aren’t set — add them to .env.local.",
          });
          return;
        }
        throw new Error(data.error ?? "push failed");
      }
      setPushedUrl(data.url ?? null);
      router.refresh();
    } catch (e) {
      setPushError((e as Error).message);
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-foreground">
          {error}
        </p>
      )}

      {/* push to spotify (8C.3) */}
      <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-card p-6">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          push to spotify
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          {alreadyPushed
            ? "this playlist is on spotify. pushing again replaces its tracks with the current included ones."
            : "creates a new playlist on your real spotify account from the included tracks, in order."}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={push}
            disabled={pushing || busy || includedCount === 0}
            className="rounded-full bg-primary px-4 py-1.5 text-sm lowercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pushing
              ? alreadyPushed
                ? "updating…"
                : "pushing…"
              : alreadyPushed
                ? "update on spotify"
                : "push to spotify"}
          </button>
          <span className="text-xs lowercase tracking-widest text-muted-foreground">
            {fmtInt(includedCount)} included
          </span>
          {pushedUrl && (
            <a
              href={pushedUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-primary/40 px-4 py-1.5 text-sm lowercase tracking-wide text-primary transition-colors hover:bg-primary/10"
            >
              open in spotify
            </a>
          )}
        </div>

        {pushError && (
          <p className="text-sm text-destructive">{pushError}</p>
        )}
        {pushNotice && (
          <p className="text-sm text-muted-foreground">
            {pushNotice.text}
            {pushNotice.link && (
              <>
                {" "}
                <Link href="/sync" className="text-primary underline">
                  go to sync
                </Link>
                .
              </>
            )}
          </p>
        )}
      </section>

      {/* details: name + description + public toggle */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs lowercase tracking-widest text-muted-foreground">
            name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-base lowercase text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs lowercase tracking-widest text-muted-foreground">
            description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={saveDetails}
            disabled={busy || !dirty}
            className="rounded-full bg-primary px-4 py-1.5 text-sm lowercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            save
          </button>
          <button
            onClick={togglePublic}
            disabled={busy}
            className="rounded-full border border-border px-4 py-1.5 text-sm lowercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            make {playlist.public ? "private" : "public"}
          </button>
          <span className="text-xs lowercase tracking-widest text-muted-foreground">
            currently {playlist.public ? "public" : "private"}
          </span>
        </div>
      </section>

      {/* tracks */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          tracks
        </h2>
        {tracks.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm lowercase text-muted-foreground">
            no tracks — add some below.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {tracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i}
                count={tracks.length}
                busy={busy}
                onToggle={(inc) => setIncluded(t.id, inc)}
                onRemove={() => remove(t.id)}
                onMove={(dir) => move(i, dir)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* manual add (8B.4) */}
      <ManualAdd
        addUrl={`${base}/tracks`}
        busy={busy}
        onAdded={() => router.refresh()}
        setError={setError}
      />

      {/* danger zone */}
      <section className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-card p-6">
        <h2 className="font-display text-xl lowercase tracking-tight">
          delete playlist
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          removes the playlist and all its tracks. this doesn’t touch spotify.
        </p>
        <button
          onClick={deletePlaylist}
          disabled={busy}
          className="rounded-full border border-destructive/50 px-4 py-1.5 text-sm lowercase tracking-wide text-foreground transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          delete
        </button>
      </section>
    </div>
  );
}

function TrackRow({
  track,
  index,
  count,
  busy,
  onToggle,
  onRemove,
  onMove,
}: {
  track: PlaylistTrackRow;
  index: number;
  count: number;
  busy: boolean;
  onToggle: (included: boolean) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0 ${
        track.included ? "" : "opacity-40"
      }`}
    >
      <span className="tabular w-7 shrink-0 text-right text-xs text-muted-foreground">
        {index + 1}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm lowercase">
          {track.track ?? "unknown track"}
          {track.artist ? (
            <span className="text-muted-foreground"> — {track.artist}</span>
          ) : null}
        </span>
        {track.album && (
          <span className="truncate text-xs text-muted-foreground">
            {track.album}
          </span>
        )}
        {track.reason && (
          <span className="truncate text-xs italic text-muted-foreground">
            {track.reason}
          </span>
        )}
      </div>

      <span className="hidden shrink-0 text-xs lowercase tracking-widest text-muted-foreground sm:inline">
        {track.addedManually
          ? "added"
          : track.score !== null
            ? `score ${track.score.toFixed(2)}`
            : ""}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="move up"
          disabled={busy || index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </IconButton>
        <IconButton
          label="move down"
          disabled={busy || index === count - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </IconButton>
        <button
          onClick={() => onToggle(!track.included)}
          disabled={busy}
          className="rounded-full border border-border px-2.5 py-0.5 text-xs lowercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {track.included ? "exclude" : "include"}
        </button>
        <button
          onClick={onRemove}
          disabled={busy}
          className="rounded-full border border-border px-2.5 py-0.5 text-xs lowercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          remove
        </button>
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Local-catalogue search + click-to-add (8B.4), debounced. */
function ManualAdd({
  addUrl,
  busy,
  onAdded,
  setError,
}: {
  addUrl: string;
  busy: boolean;
  onAdded: () => void;
  setError: (msg: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocalTrack[]>([]);
  const [searching, setSearching] = useState(false);
  // uri → "added" | "exists" feedback after a click.
  const [status, setStatus] = useState<Record<string, "added" | "exists">>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => void search(q), 250);
  }

  async function search(q: string) {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/playlists/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "search failed");
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function add(t: LocalTrack) {
    setError(null);
    try {
      const res = await fetch(addUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uri: t.uri,
          artist: t.artist ?? undefined,
          track: t.track ?? undefined,
          album: t.album ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "add failed");
      setStatus((s) => ({ ...s, [t.uri]: data.added ? "added" : "exists" }));
      if (data.added) onAdded();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl lowercase tracking-tight">
        add a track
      </h2>
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="search your listening history…"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm lowercase text-foreground outline-none focus:border-primary"
      />

      {searching && (
        <p className="text-xs lowercase text-muted-foreground">searching…</p>
      )}

      {results.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-border">
          {results.map((r) => {
            const st = status[r.uri];
            return (
              <li
                key={r.uri}
                className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm lowercase">
                    {r.track ?? "unknown track"}
                    {r.artist ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {r.artist}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.album ? `${r.album} · ` : ""}
                    {fmtInt(r.plays)} plays
                  </span>
                </div>
                {st === "exists" ? (
                  <span className="shrink-0 text-xs lowercase tracking-widest text-muted-foreground">
                    already in playlist
                  </span>
                ) : st === "added" ? (
                  <span className="shrink-0 text-xs lowercase tracking-widest text-primary">
                    added
                  </span>
                ) : (
                  <button
                    onClick={() => add(r)}
                    disabled={busy}
                    className="shrink-0 rounded-full bg-primary px-3 py-0.5 text-xs lowercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
