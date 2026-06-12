/**
 * Shared empty-state treatment for pages that exist in the nav but are not
 * built yet. Each gets replaced by the real page in its delivery phase.
 */
export function PageStub({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="flex flex-col items-start gap-4 py-24">
      <h1 className="font-display text-5xl lowercase tracking-tight">
        {title}
      </h1>
      <p className="max-w-md text-muted-foreground">{description}</p>
      <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs lowercase tracking-wide text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" />
        coming soon
      </span>
    </section>
  );
}
