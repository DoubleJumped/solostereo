/**
 * Thin notice shown on every page in demo mode (NEXT_PUBLIC_DEMO=1). Styled
 * as a strip of the deck's LCD: expectations up front — the visuals are live
 * and clickable, but the write features (live Spotify sync + playlist export)
 * are disabled.
 */
export function DemoBanner() {
  return (
    <div className="crt border-b border-primary/30 bg-black/40">
      <p className="lcd-glow mx-auto max-w-6xl px-6 py-1.5 font-display text-base lowercase tracking-wide text-primary">
        {">>>"} demo · explore the visuals freely — live spotify sync &amp;
        playlist export are disabled on this read-only copy
      </p>
    </div>
  );
}
