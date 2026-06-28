/**
 * Demo mode — set NEXT_PUBLIC_DEMO=1 to run the app as a public, read-only
 * showcase (see README → "Demo deploy"). In this mode the database is opened
 * read-only (lib/db.ts), so every write path — live Spotify sync, playlist
 * generation, and playlist edits — is blocked at the source. The UI layers
 * friendly "disabled in the demo" messaging on top.
 *
 * The flag uses the NEXT_PUBLIC_ prefix so the same check works in both server
 * components/route handlers and client components (Next inlines it into the
 * client bundle at build time).
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
