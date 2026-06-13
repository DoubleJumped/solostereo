"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Sync-now + disconnect actions for the connected account. */
export function SyncControls() {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetch("/api/spotify/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      setMessage(
        `fetched ${data.fetched} · added ${data.inserted} new · ${data.skipped} already had`,
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setMessage(null);
    try {
      await fetch("/api/spotify/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={sync}
          disabled={busy !== null}
          className="rounded-full bg-primary px-4 py-1.5 text-sm lowercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === "sync" ? "syncing…" : "sync now"}
        </button>
        <button
          onClick={disconnect}
          disabled={busy !== null}
          className="rounded-full border border-border px-4 py-1.5 text-sm lowercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          disconnect
        </button>
      </div>
      {message && (
        <p className="tabular text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
