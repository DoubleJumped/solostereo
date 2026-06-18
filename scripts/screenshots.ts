/**
 * Capture demo screenshots of each screen into docs/screenshots/ for the
 * README. Uses your real database, so the shots reflect your own listening.
 *
 * Usage:
 *   npx playwright install chromium   # one-time, downloads the browser
 *   npm run dev                       # in one terminal
 *   npm run screenshots               # in another
 *
 * Override the target with SOLOSTEREO_URL (defaults to http://localhost:3000).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.SOLOSTEREO_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "screenshots");

// One representative artist for the detail page. Falls back gracefully if the
// name isn't present — the page just 404s, so pick your own top artist here.
const ARTIST = "Red Hot Chili Peppers";

const shots: { name: string; route: string; full: boolean }[] = [
  { name: "overview", route: "/", full: true },
  { name: "year", route: "/year", full: true },
  { name: "artists", route: "/artists", full: false },
  { name: "artist", route: `/artists/${encodeURIComponent(ARTIST)}`, full: true },
  { name: "compare", route: "/compare", full: true },
  { name: "sync", route: "/sync", full: false },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
  });

  for (const s of shots) {
    await page.goto(BASE + s.route, { waitUntil: "networkidle" });
    // Let recharts measure and draw after hydration.
    await page.waitForTimeout(1500);
    const file = path.join(OUT, `${s.name}.png`);
    await page.screenshot({ path: file, fullPage: s.full });
    console.log("saved", path.relative(process.cwd(), file));
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
