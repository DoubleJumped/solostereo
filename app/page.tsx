import { VT323 } from "next/font/google";
import { MuralDeck } from "@/components/cover/deck";
import { getRecentTracks } from "@/lib/queries";

// The mural photo carries the graffiti lettering; the only live type on the
// cover is the deck's LCD readout, so VT323 (terminal dot-matrix) is loaded
// here rather than in the root layout.
const lcdFont = VT323({
  variable: "--font-lcd",
  weight: "400",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

/**
 * The cover: the spray-painted cassette-deck mural, with the app projected
 * onto its LCD — the readout cycles the most recent plays. The negative
 * vertical margin undoes the root layout's main padding so the wall owns the
 * whole viewport (SiteNav hides itself on "/").
 */
export default function CoverPage() {
  const tracks = getRecentTracks(100);

  return (
    <div className={`${lcdFont.variable} -my-10`}>
      <MuralDeck tracks={tracks} />
    </div>
  );
}
