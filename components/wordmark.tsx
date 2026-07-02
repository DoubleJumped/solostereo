import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The solostereo wordmark: dot-matrix LCD type with a blinking phosphor
 * cursor, like a deck waiting for input. Used in the nav (small) and as a
 * hero mark on empty states (large).
 */
export function Wordmark({
  className,
  asLink = true,
}: {
  className?: string;
  asLink?: boolean;
}) {
  const mark = (
    <span
      className={cn(
        "font-display lowercase tracking-tight text-foreground",
        className,
      )}
    >
      solostereo
      <span aria-hidden className="blink lcd-glow text-primary">
        _
      </span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <Link href="/" className="no-underline">
      {mark}
    </Link>
  );
}
