import { loadEnvConfig } from "@next/env";
import fs from "node:fs";
import { fetchDemoDatabase } from "../lib/demo-snapshot";

loadEnvConfig(process.cwd());
async function main() {
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return;
  const manifest = "data/demo-manifest.json";
  if (!fs.existsSync(manifest)) {
    console.log("Using bundled demo snapshot (no publication manifest yet)");
    return;
  }
  const info = await fetchDemoDatabase(JSON.parse(fs.readFileSync(manifest, "utf8")), process.env.SOLOSTEREO_DB_PATH ?? "data/demo.db");
  console.log("Public archive ready: " + info.eventCount + " events through " + info.latestPlayedAt);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
