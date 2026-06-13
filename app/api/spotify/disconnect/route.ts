import { NextResponse } from "next/server";
import { disconnectAccount } from "@/lib/spotify";

/** Forget the connected account and its tokens. Synced rows are kept. */
export async function POST() {
  disconnectAccount();
  return NextResponse.json({ ok: true });
}
