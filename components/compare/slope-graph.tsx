import type { RankedArtist } from "@/lib/queries";

/**
 * Signature (task 6.3b): rank-change slope graph. The union of both years'
 * top 10 artists; a line per artist from their rank in year A to year B.
 * Risers (and new entries) are amber, fallers fade to gray, ranks past 10
 * collapse into an "11+" lane.
 */
export function SlopeGraph({
  topA,
  topB,
  yearA,
  yearB,
}: {
  topA: RankedArtist[]; // year A top 25, ranked
  topB: RankedArtist[];
  yearA: number;
  yearB: number;
}) {
  const rankA = new Map(topA.map((r, i) => [r.artistName, i + 1]));
  const rankB = new Map(topB.map((r, i) => [r.artistName, i + 1]));

  const names = [
    ...new Set([
      ...topA.slice(0, 10).map((r) => r.artistName),
      ...topB.slice(0, 10).map((r) => r.artistName),
    ]),
  ];

  const LANES = 11; // ranks 1..10 + the "11+" lane
  const lane = (rank: number | undefined) =>
    rank === undefined || rank > 10 ? LANES : rank;

  const W = 760;
  const ROW = 30;
  const TOP = 44;
  const H = TOP + LANES * ROW + 16;
  const XA = 232;
  const XB = W - 232;
  const y = (l: number) => TOP + (l - 1) * ROW + ROW / 2;

  const trunc = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  // stagger labels that share a lane (mainly the 11+ lane)
  const usedA = new Map<number, number>();
  const usedB = new Map<number, number>();

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-2xl lowercase tracking-tight">
        the shuffle
      </h2>
      <p className="mt-1 text-xs lowercase tracking-wide text-muted-foreground">
        how the top ten reshuffled from {yearA} to {yearB}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full min-w-[40rem]"
        role="img"
        aria-label={`rank changes from ${yearA} to ${yearB}`}
      >
        <text
          x={XA - 42}
          y={26}
          textAnchor="end"
          className="fill-[var(--color-chart-2)]"
          fontSize="13"
          fontFamily="var(--font-lcd), monospace"
        >
          {yearA}
        </text>
        <text
          x={XB + 42}
          y={26}
          textAnchor="start"
          className="fill-[var(--color-primary)]"
          fontSize="13"
          fontFamily="var(--font-lcd), monospace"
        >
          {yearB}
        </text>

        {/* 11+ lane divider */}
        <line
          x1={24}
          x2={W - 24}
          y1={y(LANES) - ROW / 2 - 4}
          y2={y(LANES) - ROW / 2 - 4}
          stroke="var(--color-border)"
          strokeDasharray="3 4"
        />
        <text
          x={24}
          y={y(LANES) + 4}
          fontSize="10"
          className="fill-[var(--color-muted-foreground)]"
        >
          11+
        </text>

        {names.map((name) => {
          const ra = rankA.get(name);
          const rb = rankB.get(name);
          const la = lane(ra);
          const lb = lane(rb);

          const offA = (usedA.get(la) ?? 0) * 12;
          usedA.set(la, (usedA.get(la) ?? 0) + (la === LANES ? 1 : 0));
          const offB = (usedB.get(lb) ?? 0) * 12;
          usedB.set(lb, (usedB.get(lb) ?? 0) + (lb === LANES ? 1 : 0));

          const improved = lb < la; // smaller lane = better rank
          const color = improved
            ? "var(--color-primary)"
            : lb === la
              ? "var(--color-chart-2)"
              : "var(--color-muted-foreground)";
          const opacity = improved ? 1 : lb === la ? 0.8 : 0.45;

          return (
            <g key={name} opacity={opacity}>
              <text
                x={XA - 14}
                y={y(la) + 4 + offA}
                textAnchor="end"
                fontSize="11"
                className="fill-[var(--color-foreground)]"
              >
                {ra ? `${ra}. ` : ""}
                {trunc(name)}
              </text>
              <circle cx={XA} cy={y(la) + offA} r="2.5" fill={color} />
              <line
                x1={XA}
                y1={y(la) + offA}
                x2={XB}
                y2={y(lb) + offB}
                stroke={color}
                strokeWidth={improved ? 1.8 : 1.2}
              />
              <circle cx={XB} cy={y(lb) + offB} r="2.5" fill={color} />
              <text
                x={XB + 14}
                y={y(lb) + 4 + offB}
                textAnchor="start"
                fontSize="11"
                className="fill-[var(--color-foreground)]"
              >
                {rb ? `${rb}. ` : ""}
                {trunc(name)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
