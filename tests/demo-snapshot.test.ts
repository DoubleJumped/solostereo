import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { buildDemoDatabase } from "../scripts/build-demo-db";
import { fetchDemoDatabase, inspectSnapshot, validateManifest, type DemoManifest } from "../lib/demo-snapshot";

test("build sanitizes credentials, preserves source, validates downloads, and retains last good data on failure", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "solostereo-test-"));
  try {
    const source = path.join(directory, "source.db");
    const snapshot = path.join(directory, "snapshot.db");
    const downloaded = path.join(directory, "downloaded.db");
    const db = new Database(source);
    for (const file of fs.readdirSync("db/migrations").filter(f => f.endsWith(".sql")).sort()) db.exec(fs.readFileSync(path.join("db/migrations", file), "utf8"));
    db.prepare("INSERT INTO listening_events (dedup_hash, played_at, source_filename, artist_name, track_name, ms_played, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("fixture-hash", "2026-09-05T20:00:00.000Z", "test", "Artist", "Track", 180000, "2026-09-05T20:10:00.000Z");
    db.prepare("INSERT INTO spotify_account (id, account_id, access_token, refresh_token, token_expires_at, connected_at) VALUES (1, ?, ?, ?, ?, ?)")
      .run("fixture-account", "fixture-access-secret", "fixture-refresh-secret", "2026-09-06T00:00:00Z", "2026-09-05T00:00:00Z");
    db.close();
    const original = fs.readFileSync(source);
    await assert.rejects(buildDemoDatabase(source, source), /must differ/);
    await buildDemoDatabase(source, snapshot);
    assert.deepEqual(fs.readFileSync(source), original);
    assert.equal(inspectSnapshot(snapshot).eventCount, 1);
    assert.equal(fs.readFileSync(snapshot).includes(Buffer.from("fixture-refresh-secret")), false);
    const gz = gzipSync(fs.readFileSync(snapshot));
    const sha256 = createHash("sha256").update(gz).digest("hex");
    const manifest: DemoManifest = {version: 1, url: "https://github.com/DoubleJumped/solostereo/releases/download/archive-2026-09/archive-" + sha256 + ".db.gz",
      sha256, ...inspectSnapshot(snapshot), generatedAt: "2026-09-05T23:00:00Z"};
    const response: typeof fetch = async () => new Response(gz);
    await fetchDemoDatabase(manifest, downloaded, response);
    const good = fs.readFileSync(downloaded);
    await assert.rejects(fetchDemoDatabase({...manifest, sha256: "a".repeat(64)}, downloaded, response), /checksum/);
    await assert.rejects(fetchDemoDatabase({...manifest, eventCount: 2}, downloaded, response), /do not match/);
    assert.deepEqual(fs.readFileSync(downloaded), good);
    const secretGz = gzipSync(original);
    await assert.rejects(fetchDemoDatabase({...manifest, sha256: createHash("sha256").update(secretGz).digest("hex")}, downloaded, async () => new Response(secretGz)), /credentials/);
    assert.deepEqual(fs.readFileSync(downloaded), good);
    assert.throws(() => validateManifest({...manifest, url: "https://example.com/archive.db.gz"}), /Invalid/);
  } finally {
    for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
    fs.rmdirSync(directory);
  }
});
