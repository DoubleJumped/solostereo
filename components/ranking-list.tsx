export interface RankingRow {
  name: string;
  sub?: string;
  value: string;
  subValue?: string;
}

/**
 * A designed ranking list: Fraunces rank numerals, hairline separators,
 * right-aligned tabular values.
 */
export function RankingList({
  title,
  rows,
  emptyMessage = "nothing in this period",
}: {
  title: string;
  rows: RankingRow[];
  emptyMessage?: string;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-card">
      <h2 className="px-5 pb-1 pt-5 font-display text-2xl lowercase tracking-tight">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ol className="px-2 pb-3">
          {rows.map((row, i) => (
            <li
              key={`${row.name}|${row.sub ?? ""}`}
              className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0"
            >
              <span className="stat-numeral w-7 shrink-0 text-right text-lg text-muted-foreground/70">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{row.name}</span>
                {row.sub && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.sub}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="tabular block text-sm text-primary">
                  {row.value}
                </span>
                {row.subValue && (
                  <span className="tabular block text-xs text-muted-foreground">
                    {row.subValue}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
