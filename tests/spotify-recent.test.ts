import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchRecentHistory } from "../lib/spotify-recent";

const base = "https://api.spotify.com/v1/me/player/recently-played";
const item = (n: number) => ({ played_at: new Date(1788600000000 + n * 180000).toISOString(),
  track: { name: "Track " + n, uri: "spotify:track:" + n, duration_ms: 180000, artists: [{name: "Artist"}], album: {name: "Album"} } });
const page = (items: unknown[], next: string | null = null) => Response.json({ items, next });

test("fetches all available pages and preserves the incremental cursor", async () => {
  const calls: string[] = [];
  const after = "2026-09-01T00:00:00.000Z";
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push(String(input));
    assert.equal((init!.headers as Record<string, string>).Authorization, "Bearer test-token");
    return calls.length === 1 ? page(Array.from({length: 50}, (_, i) => item(i)), base + "?before=1788600000000") : page([item(51)]);
  };
  const result = await fetchRecentHistory("test-token", after, { fetchImpl });
  assert.equal(new URL(calls[0]).searchParams.get("after"), String(Date.parse(after)));
  assert.equal(result.items.length, 51);
  assert.equal(result.pages, 2);
  assert.equal(result.possibleGap, false);
});

test("honors short Retry-After delays and retries a transient network failure", async () => {
  const delays: number[] = [];
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    if (calls === 1) throw new Error("temporary network failure");
    if (calls === 2) return new Response("limited", {status: 429, headers: {"Retry-After": "3"}});
    return page([item(1)]);
  };
  const result = await fetchRecentHistory("test-token", null, { fetchImpl, sleep: async ms => {delays.push(ms);} });
  assert.deepEqual(delays, [1000, 3000]);
  assert.equal(result.items.length, 1);
});

test("a failed later page rejects the entire result", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => ++calls === 1 ? page([item(1)], base + "?before=10") : new Response("forbidden", {status: 403});
  await assert.rejects(fetchRecentHistory("test-token", null, { fetchImpl }), /403/);
});

test("never forwards the Spotify token to a foreign pagination host", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {calls++; return page([item(1)], "https://example.com/steal");};
  await assert.rejects(fetchRecentHistory("test-token", null, { fetchImpl }), /Unexpected/);
  assert.equal(calls, 1);
});

test("rejects pagination loops, malformed items, and unbounded rate-limit waits", async () => {
  const first = base + "?limit=50";
  await assert.rejects(fetchRecentHistory("t", null, {fetchImpl: async () => page([item(1)], first)}), /did not finish/);
  await assert.rejects(fetchRecentHistory("t", null, {fetchImpl: async () => page([{played_at: "broken"}])}), /Invalid/);
  await assert.rejects(fetchRecentHistory("t", null, {fetchImpl: async () => new Response("", {status: 429, headers: {"Retry-After": "3600"}})}), /rate limited/);
});

test("flags a full final page as a possible gap, not a claim of missing plays", async () => {
  const result = await fetchRecentHistory("t", "2026-09-01T00:00:00Z", {fetchImpl: async () => page(Array.from({length: 50}, (_, i) => item(i)))});
  assert.equal(result.possibleGap, true);
});
