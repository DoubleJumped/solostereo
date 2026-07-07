import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The house toggle-chip look (metric/range/year selectors, chart toggles). */
export function chipClass(active: boolean): string {
  return cn(
    "rounded-sm border px-3 py-0.5 transition-colors",
    active
      ? "border-primary/60 bg-primary/15 text-primary"
      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
  );
}

/** Canonical detail-page paths (names are URL-encoded path segments). */
export function artistHref(artistName: string): string {
  return `/artists/${encodeURIComponent(artistName)}`;
}

export function trackHref(artistName: string, trackName: string): string {
  return `/tracks/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`;
}
