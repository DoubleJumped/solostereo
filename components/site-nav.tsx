"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/wordmark";

const pages = [
  { href: "/", label: "overview" },
  { href: "/year", label: "year in review" },
  { href: "/artists", label: "artists" },
  { href: "/compare", label: "compare" },
  { href: "/sync", label: "sync" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex h-14 max-w-6xl items-baseline gap-5 overflow-x-auto px-6 sm:gap-8">
        <Wordmark className="text-xl" />
        <ul className="flex items-baseline gap-4 sm:gap-6">
          {pages.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "whitespace-nowrap text-sm lowercase tracking-wide transition-colors",
                    active
                      ? "text-primary"
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
