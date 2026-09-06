const RECENT_URL = "https://api.spotify.com/v1/me/player/recently-played";

export interface RecentItem {
  track: {
    name: string;
    uri: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string };
  } | null;
  played_at: string;
}


type Options = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

/** Read every available page before committing events or advancing the cursor. */
export async function fetchRecentHistory(token: string, after: string | null, options: Options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
  let url: URL | null = new URL(RECENT_URL);
  url.searchParams.set("limit", "50");
  if (after) url.searchParams.set("after", String(Date.parse(after)));
  const visited = new Set<string>();
  const items: RecentItem[] = [];
  let saturatedLastPage = false;

  while (url) {
    if (url.origin !== "https://api.spotify.com" || url.pathname !== "/v1/me/player/recently-played") {
      throw new Error("Unexpected Spotify pagination URL");
    }
    if (visited.has(url.href) || visited.size >= 100) {
      throw new Error("Spotify pagination did not finish; sync cursor was not advanced");
    }
    visited.add(url.href);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetchImpl(url, {
          headers: { Authorization: "Bearer " + token },
          signal: AbortSignal.timeout(15000),
        });
      } catch (error) {
        if (attempt === 2) throw error;
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (response.ok) break;
      const retryable = response.status === 429 || response.status >= 500;
      const retrySeconds = Number(response.headers.get("Retry-After") ?? 2 ** attempt);
      if (!retryable || attempt === 2 || !Number.isFinite(retrySeconds) || retrySeconds > 30) {
        throw new Error("recently-played failed: " + response.status +
          (response.status === 429 ? " — rate limited; retry later" : ""));
      }
      await response.body?.cancel();
      await sleep(Math.max(1, retrySeconds) * 1000);
    }
    if (!response?.ok) throw new Error("Spotify did not return a successful response");
    const page = await response.json() as { items?: RecentItem[]; next?: string | null };
    if (!Array.isArray(page.items) || !page.items.every(item =>
      item && typeof item.played_at === "string" && Number.isFinite(Date.parse(item.played_at)) &&
      (item.track === null || (item.track && typeof item.track.name === "string" &&
      typeof item.track.uri === "string" && Number.isFinite(item.track.duration_ms))))) {
      throw new Error("Invalid Spotify recent-history response; sync cursor was not advanced");
    }
    items.push(...page.items);
    saturatedLastPage = page.items.length >= 50;
    url = page.next ? new URL(page.next) : null;
  }
  return { items, pages: visited.size, possibleGap: Boolean(after && saturatedLastPage) };
}
