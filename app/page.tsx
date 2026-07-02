import { MuralDeck } from "@/components/cover/deck";
import { getRecentTracks } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * The cover: the spray-painted cassette-deck mural, with the app projected
 * onto its LCD — the readout cycles the most recent plays. The LCD font
 * (--font-lcd) now comes from the root layout, since the whole app speaks it.
 * The negative vertical margin undoes the root layout's main padding so the
 * wall owns the whole viewport (SiteNav hides itself on "/").
 */
export default function CoverPage() {
  const tracks = getRecentTracks(100);

  return (
    <div className="-my-10">
      <MuralDeck tracks={tracks} />
    </div>
  );
}
