import { NextResponse } from "next/server";
import { syncRecentlyPlayed } from "@/lib/spotify";

/** Run an incremental recently-played sync (task 7.2). */
export async function POST() {
  try {
    return NextResponse.json(await syncRecentlyPlayed());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
