import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getSpotifyConfig } from "@/lib/spotify";

/** OAuth redirect target: validate state, exchange the code, persist tokens. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/sync?${q}`, url.origin));

  const cfg = getSpotifyConfig();
  if (!cfg) return back("error=not_configured");

  const error = url.searchParams.get("error");
  if (error) return back(`error=${encodeURIComponent(error)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("spotify_oauth_state")?.value;
  if (!code || !state || state !== cookieState) {
    return back("error=state_mismatch");
  }

  try {
    await exchangeCode(cfg, code);
  } catch {
    return back("error=exchange_failed");
  }

  const res = back("connected=1");
  res.cookies.delete("spotify_oauth_state");
  return res;
}
