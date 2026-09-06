import { LiquidDeck } from "@/components/cover/liquid-deck";
import { getRecentTracks } from "@/lib/queries";
import "@/components/cover/liquid-deck.css";

export const dynamic = "force-dynamic";

export default function CoverPage() {
  return <div className="-my-10"><LiquidDeck initialTracks={getRecentTracks(100)} /></div>;
}
