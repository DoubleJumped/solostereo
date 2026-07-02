import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Canonical detail-page paths (names are URL-encoded path segments). */
export function artistHref(artistName: string): string {
  return `/artists/${encodeURIComponent(artistName)}`;
}

export function trackHref(artistName: string, trackName: string): string {
  return `/tracks/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`;
}
