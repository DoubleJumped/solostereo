/** Publish data only: immutable sanitized release asset + one manifest commit.
 * Never stages local source edits. Render's existing auto-deploy builds that commit.
 * --prepare uploads an asset and writes the local manifest for the initial reviewed release.
 */
import { loadEnvConfig } from "@next/env";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { buildDemoDatabase } from "./build-demo-db";
import { inspectSnapshot, validateManifest, type DemoManifest } from "../lib/demo-snapshot";

loadEnvConfig(process.cwd());
const REPO = "DoubleJumped/solostereo";
const MANIFEST = "data/demo-manifest.json";
const ENDPOINT = "repos/" + REPO + "/contents/" + MANIFEST;
function gh(args: string[]) {
  return execFileSync("gh", args, { encoding: "utf8", windowsHide: true, timeout: 180000,
    stdio: ["ignore", "pipe", "pipe"] });
}
function remoteManifest(): { sha: string; content: string } | null {
  try { return JSON.parse(gh(["api", ENDPOINT + "?ref=master"])); }
  catch (error) {
    if (String(error).includes("404")) return null;
    throw error;
  }
}

async function main() {
  fs.mkdirSync("data", { recursive: true });
  const lock = "data/publish.lock";
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, "utf8"));
    let running = true;
    try { process.kill(pid, 0); } catch { running = false; }
    if (running) throw new Error("Another archive publication is running");
    fs.unlinkSync(lock);
  }
  const handle = fs.openSync(lock, "wx");
  fs.writeFileSync(handle, String(process.pid));
  fs.closeSync(handle);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "solostereo-publish-"));
  try {
    const previous = remoteManifest();
    const snapshot = path.join(directory, "demo.db");
    await buildDemoDatabase(process.env.SOLOSTEREO_DB_PATH ?? "data/solostereo.db", snapshot);
    const info = inspectSnapshot(snapshot);
    const prepare = process.argv.includes("--prepare");
    if (previous && !prepare) {
      const prior = validateManifest(JSON.parse(Buffer.from(previous.content, "base64").toString("utf8")));
      if (info.eventCount === prior.eventCount && info.latestPlayedAt === prior.latestPlayedAt) {
        console.log("No new listening since the last publication; website data is current.");
        return;
      }
      if (info.eventCount < prior.eventCount) throw new Error("Refusing to publish an archive with fewer events than the website");
    }
    const compressed = gzipSync(fs.readFileSync(snapshot));
    const sha256 = createHash("sha256").update(compressed).digest("hex");
    const asset = "archive-" + sha256 + ".db.gz";
    const assetPath = path.join(directory, asset);
    fs.writeFileSync(assetPath, compressed);
    const tag = "archive-" + new Date().toISOString().slice(0, 7);
    let release: { assets: { name: string }[] };
    try { release = JSON.parse(gh(["release", "view", tag, "--repo", REPO, "--json", "assets"])); }
    catch (error) {
      if (!/404|not found/.test(String(error))) throw error;
      gh(["release", "create", tag, "--repo", REPO, "--target", "master", "--latest=false", "--title", "Public listening snapshots — " + tag.slice(8), "--notes", "Sanitized read-only listening snapshots for the Solo Stereo website. Spotify account credentials are excluded."]);
      release = { assets: [] };
    }
    if (!release.assets.some(a => a.name === asset)) gh(["release", "upload", tag, assetPath, "--repo", REPO]);
    const manifest: DemoManifest = { version: 1, url: "https://github.com/" + REPO + "/releases/download/" + tag + "/" + asset,
      sha256, ...info, generatedAt: new Date().toISOString() };
    const content = JSON.stringify(manifest, null, 2) + "\n";
    validateManifest(manifest);
    if (prepare) {
      fs.writeFileSync(MANIFEST, content);
      console.log("Prepared the public archive manifest for the reviewed website release.");
      return;
    }
    const payload = path.join(directory, "commit.json");
    fs.writeFileSync(payload, JSON.stringify({ message: "data: refresh public listening archive through " + info.latestPlayedAt,
      content: Buffer.from(content).toString("base64"), branch: "master", ...(previous ? { sha: previous.sha } : {}) }));
    const updated = JSON.parse(gh(["api", "--method", "PUT", ENDPOINT, "--input", payload]));
    const verified = remoteManifest();
    if (!verified || Buffer.from(verified.content, "base64").toString("utf8") !== content) throw new Error("Public archive manifest verification failed");
    console.log("Published " + info.eventCount + " events; Render auto-deploy requested by commit " + updated.commit.sha);
  } finally {
    // This unique directory was created above; remove only its own flat temporary files.
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
    fs.unlinkSync(lock);
  }
}
main().catch(error => { console.error("[" + new Date().toISOString() + "] publication failed: " + String(error)); process.exitCode = 1; });
