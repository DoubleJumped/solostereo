import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("summary failures roll back events and cursor; a successful retry inserts once", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "solostereo-sync-test-"));
  const source = path.join(directory, "fixture.db");
  const previousFetch = globalThis.fetch;
  const previousEnv = { ...process.env };
  process.env.SOLOSTEREO_DB_PATH = source;
  process.env.NEXT_PUBLIC_DEMO = "0";
  process.env.SPOTIFY_CLIENT_ID = "fixture-client";
  process.env.SPOTIFY_CLIENT_SECRET = "fixture-secret";
  const db = new Database(source);
  try {
    for (const file of fs.readdirSync("db/migrations").filter(f => f.endsWith(".sql")).sort()) db.exec(fs.readFileSync(path.join("db/migrations",file),"utf8"));
    db.prepare("INSERT INTO spotify_account (id, account_id, access_token, refresh_token, token_expires_at, connected_at, last_played_at) VALUES (1, ?, ?, ?, ?, ?, ?)")
      .run("fixture", "fixture-access", "fixture-refresh", "2099-01-01T00:00:00Z", "2026-09-01T00:00:00Z", "2026-09-01T00:00:00Z");
    const item = {played_at: "2026-09-05T20:00:00.000Z", track: {name:"Fixture",uri:"spotify:track:fixture",duration_ms:180000,artists:[{name:"Artist"}],album:{name:"Album"}}};
    globalThis.fetch = async () => Response.json({items:[item],next:null});
    const { syncRecentlyPlayed } = await import("../lib/spotify");
    db.exec("CREATE TRIGGER fail_summary BEFORE DELETE ON overview_alltime BEGIN SELECT RAISE(ABORT, 'fixture summary failure'); END");
    await assert.rejects(syncRecentlyPlayed(), /fixture summary failure/);
    assert.equal((db.prepare("SELECT COUNT(*) n FROM listening_events").get() as {n:number}).n, 0);
    assert.equal((db.prepare("SELECT last_played_at v FROM spotify_account").get() as {v:string}).v, "2026-09-01T00:00:00Z");
    db.exec("DROP TRIGGER fail_summary");
    assert.equal((await syncRecentlyPlayed()).inserted, 1);
    assert.equal((await syncRecentlyPlayed()).inserted, 0);
    assert.equal((db.prepare("SELECT last_played_at v FROM spotify_account").get() as {v:string}).v, item.played_at);
    assert.equal((db.prepare("SELECT SUM(raw_plays) n FROM artist_summary").get() as {n:number}).n, 1);
  } finally {
    db.close();
    globalThis.fetch = previousFetch;
    for (const key of ["SOLOSTEREO_DB_PATH", "NEXT_PUBLIC_DEMO", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"]) {
      if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key];
    }
    for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory,file));
    fs.rmdirSync(directory);
  }
});
