"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";

const pages = [
  { href: "/overview", label: "overview" },
  { href: "/year", label: "year in review" },
  { href: "/artists", label: "artists" },
  { href: "/skips", label: "skips" },
  { href: "/compare", label: "compare" },
  { href: "/playlists", label: "playlists" },
  { href: "/sync", label: "sync" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  // The cover page ("/") is a full-bleed jukebox with its own way in — no nav.
  if (pathname === "/") return null;

  // The deck's faceplate: dot-matrix labels on a lifted panel, the active
  // page lit up in phosphor like the segment that's currently playing.
  return (
    <header className="border-b border-border bg-card/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-baseline gap-5 overflow-x-auto px-6 sm:gap-8">
        <Wordmark className="text-2xl" />
        <ul className="flex items-baseline gap-4 font-display text-lg sm:gap-6">
          {pages.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "whitespace-nowrap lowercase tracking-wide transition-colors",
                    active
                      ? "lcd-glow text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
