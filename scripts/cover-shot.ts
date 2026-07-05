/**
 * Screenshot the cover page ("/") at the mural's exact aspect ratio, so the
 * stage fills the viewport and the overlay geometry in
 * components/cover/deck.tsx can be checked against the painted deck.
 *
 * Usage:
 *   npx playwright install chromium                       # one-time
 *   SOLOSTEREO_DB_PATH=data/demo.db npm run dev           # in one terminal
 *   npx tsx scripts/cover-shot.ts [out.png]               # in another
 *
 * Override the target with SOLOSTEREO_URL (defaults to http://localhost:3000).
 */
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.SOLOSTEREO_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? path.join(process.cwd(), "docs", "cover-shot.png");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    // same aspect ratio as /cover-wall.jpg — the stage cover-fits edge to
    // edge, so overlay drift is visible without letterboxing
    viewport: { width: 1338, height: 753 },
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT });
  await browser.close();
  console.log("wrote", OUT);
}

main();
