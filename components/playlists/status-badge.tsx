/** draft/pushed status chip — pushed glows primary, everything else stays quiet. */
export function StatusBadge({ status }: { status: string }) {
  const pushed = status === "pushed";
  return (
    <span
      className={
        pushed
          ? "rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs lowercase tracking-wide text-primary"
          : "rounded-sm border border-border px-2.5 py-0.5 text-xs lowercase tracking-wide text-muted-foreground"
      }
    >
      {status}
    </span>
  );
}
