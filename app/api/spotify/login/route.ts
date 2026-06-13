import { NextResponse } from "next/server";
import { buildAuthorizeUrl, getSpotifyConfig, newState } from "@/lib/spotify";

/** Start the OAuth authorization-code flow (task 7.1). */
export async function GET() {
  const cfg = getSpotifyConfig();
  if (!cfg) {
    return NextResponse.redirect(
      new URL("/sync?error=not_configured", "http://127.0.0.1:3000"),
    );
  }
  const state = newState();
  const res = NextResponse.redirect(buildAuthorizeUrl(cfg, state));
  res.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
