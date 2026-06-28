/**
 * Thin notice shown on every page in demo mode (NEXT_PUBLIC_DEMO=1). Sets
 * expectations: the visuals are live and clickable, but the write features
 * (live Spotify sync + playlist export) are disabled.
 */
export function DemoBanner() {
  return (
    <div className="border-b border-primary/30 bg-primary/10">
      <p className="mx-auto max-w-6xl px-6 py-2 text-xs lowercase tracking-wide text-foreground">
        demo · explore the visuals freely — live spotify sync &amp; playlist
        export are disabled on this read-only copy.
      </p>
    </div>
  );
}
