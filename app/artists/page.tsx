import { ArtistTable } from "@/components/artists/artist-table";
import { PageStub } from "@/components/page-stub";
import { getArtistTable } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function ArtistsPage() {
  const rows = getArtistTable();

  if (rows.length === 0) {
    return (
      <PageStub
        title="artists"
        description="Import your streaming history and every artist you have ever played will be here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="pt-2">
        <h1 className="font-display text-5xl lowercase tracking-tight">
          artists
        </h1>
        <p className="mt-1 text-sm lowercase text-muted-foreground">
          everyone you have ever played
        </p>
      </section>
      <ArtistTable rows={rows} />
    </div>
  );
}
