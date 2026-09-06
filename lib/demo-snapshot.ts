import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export interface DemoManifest {
  version: 1;
  url: string;
  sha256: string;
  eventCount: number;
  latestPlayedAt: string | null;
  generatedAt: string;
}

export function inspectSnapshot(file: string) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma("quick_check", { simple: true }) !== "ok") throw new Error("Snapshot integrity check failed");
    const accounts = db.prepare("SELECT COUNT(*) n FROM spotify_account").get() as { n: number };
    if (accounts.n !== 0) throw new Error("Refusing a public snapshot containing Spotify credentials");
    return db.prepare("SELECT COUNT(*) eventCount, MAX(played_at) latestPlayedAt FROM listening_events")
      .get() as { eventCount: number; latestPlayedAt: string | null };
  } finally { db.close(); }
}

export function validateManifest(value: unknown): DemoManifest {
  const m = value as DemoManifest;
  if (!m || m.version !== 1 || typeof m.url !== "string" ||
    !/^https:\/\/github\.com\/DoubleJumped\/solostereo\/releases\/download\/archive-\d{4}-\d{2}\/archive-[a-f0-9]{64}\.db\.gz$/.test(m.url) ||
    !/^[a-f0-9]{64}$/.test(m.sha256) || !Number.isSafeInteger(m.eventCount) || m.eventCount < 0 ||
    (m.latestPlayedAt !== null && (typeof m.latestPlayedAt !== "string" || !Number.isFinite(Date.parse(m.latestPlayedAt)))) ||
    typeof m.generatedAt !== "string" || !Number.isFinite(Date.parse(m.generatedAt))) {
    throw new Error("Invalid public archive manifest");
  }
  return m;
}

/** A failed download never replaces the last good database. */
export async function fetchDemoDatabase(value: unknown, output: string, fetchImpl: typeof fetch = fetch) {
  const manifest = validateManifest(value);
  const res = await fetchImpl(manifest.url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error("Archive download failed: " + res.status);
  const compressed = Buffer.from(await res.arrayBuffer());
  if (createHash("sha256").update(compressed).digest("hex") !== manifest.sha256) {
    throw new Error("Archive checksum mismatch");
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = output + ".download-" + process.pid;
  try {
    fs.writeFileSync(temporary, gunzipSync(compressed, { maxOutputLength: 200 * 1024 * 1024 }));
    const info = inspectSnapshot(temporary);
    if (info.eventCount !== manifest.eventCount || info.latestPlayedAt !== manifest.latestPlayedAt) {
      throw new Error("Archive contents do not match the manifest");
    }
    fs.renameSync(temporary, output);
    return info;
  } finally { fs.rmSync(temporary, { force: true }); }
}
