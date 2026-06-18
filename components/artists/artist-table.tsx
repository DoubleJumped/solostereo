"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ArtistTableRow } from "@/lib/queries";
import { fmtDate, fmtInt, fmtMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey =
  | "listeningMinutes"
  | "meaningfulPlays"
  | "firstPlayedAt"
  | "lastPlayedAt"
  | "distinctTracks"
  | "activeYears"
  | "topYear";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "meaningfulPlays", label: "plays", align: "right" },
  { key: "listeningMinutes", label: "time", align: "right" },
  { key: "firstPlayedAt", label: "first played", align: "right" },
  { key: "lastPlayedAt", label: "last played", align: "right" },
  { key: "distinctTracks", label: "tracks", align: "right" },
  { key: "activeYears", label: "years", align: "right" },
  { key: "topYear", label: "top year", align: "right" },
];

const PAGE_SIZE = 100;

/**
 * Artist explorer table (task 5.1): every artist, instant client-side search
 * and sorting on every numeric/date column. Rows render in pages of 100 to
 * keep the DOM light with 4,600+ artists.
 */
export function ArtistTable({ rows }: { rows: ArtistTableRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("listeningMinutes");
  const [desc, setDesc] = useState(true);
  const [shown, setShown] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? rows.filter((r) => r.artistName.toLowerCase().includes(q))
      : [...rows];
    matched.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return desc ? -cmp : cmp;
    });
    return matched;
  }, [rows, query, sortKey, desc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
    setShown(PAGE_SIZE);
  }

  const visible = filtered.slice(0, shown);

  // Body cell classes: the column you're sorting by glows green so the eye can
  // follow it down the table; otherwise muted columns stay muted.
  const cell = (key: SortKey, muted = false) =>
    cn(
      "tabular px-3 py-2 text-right",
      sortKey === key
        ? "text-primary"
        : muted
          ? "text-muted-foreground"
          : undefined,
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <input
          type="search"
          placeholder="search artists…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE_SIZE);
          }}
          className="w-full max-w-xs rounded-md border border-border bg-card px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring sm:w-72"
        />
        <span className="tabular text-xs text-muted-foreground">
          {fmtInt(filtered.length)} artist{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-left text-xs lowercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3 font-normal">artist</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-3 text-right font-normal">
                  <button
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      "transition-colors hover:text-foreground",
                      sortKey === c.key && "text-primary",
                    )}
                  >
                    {c.label}
                    {sortKey === c.key && (desc ? " ↓" : " ↑")}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-normal">most played</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  no artists match “{query}”
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr
                key={r.artistName}
                className="border-b border-border/60 odd:bg-primary/[0.03] last:border-b-0 hover:bg-primary/[0.07]"
              >
                <td className="max-w-[14rem] truncate px-4 py-2">
                  <Link
                    href={`/artists/${encodeURIComponent(r.artistName)}`}
                    className="font-medium text-primary transition-colors hover:text-primary/70"
                  >
                    {r.artistName}
                  </Link>
                </td>
                <td className={cell("meaningfulPlays")}>
                  {fmtInt(r.meaningfulPlays)}
                </td>
                <td className={cell("listeningMinutes")}>
                  {fmtMinutes(r.listeningMinutes)}
                </td>
                <td className={cell("firstPlayedAt", true)}>
                  {fmtDate(r.firstPlayedAt)}
                </td>
                <td className={cell("lastPlayedAt", true)}>
                  {fmtDate(r.lastPlayedAt)}
                </td>
                <td className={cell("distinctTracks")}>
                  {fmtInt(r.distinctTracks)}
                </td>
                <td className={cell("activeYears")}>{r.activeYears}</td>
                <td className={cell("topYear")}>{r.topYear}</td>
                <td className="max-w-[12rem] truncate px-4 py-2 text-muted-foreground">
                  {r.topTrack ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > shown && (
        <button
          onClick={() => setShown((s) => s + PAGE_SIZE)}
          className="self-center rounded-full border border-border px-4 py-1.5 text-xs lowercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          show {Math.min(PAGE_SIZE, filtered.length - shown)} more
        </button>
      )}
    </div>
  );
}
