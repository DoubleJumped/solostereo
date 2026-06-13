import { SyncControls } from "@/components/sync/sync-controls";
import { fmtDate, fmtInt } from "@/lib/format";
import { getAccount, getSpotifyConfig, getSyncStats } from "@/lib/spotify";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_configured: "Spotify credentials are not set. Add them to .env.local.",
  state_mismatch: "The login response didn't match — please try connecting again.",
  exchange_failed: "Couldn't exchange the login code with Spotify. Try again.",
  access_denied: "Spotify access was declined.",
};

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = getSpotifyConfig() !== null;
  const account = getAccount();
  const stats = getSyncStats();
  const errorMsg = params.error ? (ERRORS[params.error] ?? params.error) : null;

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-2">
        <h1 className="font-display text-5xl lowercase tracking-tight">sync</h1>
        <p className="mt-1 max-w-xl text-sm lowercase text-muted-foreground">
          keep the archive current by pulling your recently played tracks from
          spotify. the import remains the source of truth — this just adds the
          recent tail.
        </p>
      </section>

      {errorMsg && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          {errorMsg}
        </p>
      )}
      {params.connected && account && (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
          connected as {account.display_name ?? account.account_id}.
        </p>
      )}

      {/* current state */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        <Stat
          label="latest event"
          value={stats.latest ? fmtDate(stats.latest) : "—"}
          small
        />
        <Stat label="total events" value={fmtInt(stats.total)} />
        <Stat label="from live sync" value={fmtInt(stats.apiRows)} />
      </section>

      {/* connection */}
      {!configured ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-2xl lowercase tracking-tight">
            not configured yet
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Create a Spotify app, then add{" "}
            <code className="font-mono text-xs text-primary">SPOTIFY_CLIENT_ID</code>
            ,{" "}
            <code className="font-mono text-xs text-primary">
              SPOTIFY_CLIENT_SECRET
            </code>{" "}
            and{" "}
            <code className="font-mono text-xs text-primary">
              SPOTIFY_REDIRECT_URI
            </code>{" "}
            to <code className="font-mono text-xs">.env.local</code> and restart
            the dev server. See the README (“Live Spotify sync”) for the full
            walkthrough.
          </p>
        </section>
      ) : !account ? (
        <section className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-2xl lowercase tracking-tight">
            connect your account
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            You’ll be sent to Spotify to authorize read access to your recently
            played tracks. Nothing is posted on your behalf.
          </p>
          <a
            href="/api/spotify/login"
            className="rounded-full bg-primary px-4 py-1.5 text-sm lowercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90"
          >
            connect spotify
          </a>
        </section>
      ) : (
        <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl lowercase tracking-tight">
              connected
            </h2>
            <span className="text-sm text-muted-foreground">
              {account.display_name ?? account.account_id}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
            <Field
              label="last synced"
              value={account.last_synced_at ? fmtDate(account.last_synced_at) : "never"}
            />
            <Field
              label="sync cursor"
              value={account.last_played_at ? fmtDate(account.last_played_at) : "—"}
            />
            <Field label="connected" value={fmtDate(account.connected_at)} />
          </dl>
          <SyncControls />
          <p className="max-w-xl text-xs text-muted-foreground">
            The API exposes only your last ~50 tracks, so sync often enough that
            you don’t play more than 50 between runs. Synced rows use the track’s
            full length for listening time (the API doesn’t report partial
            plays).
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-6">
      <div
        className={
          small
            ? "stat-numeral pt-1 text-lg leading-tight sm:text-xl"
            : "stat-numeral text-3xl sm:text-4xl"
        }
      >
        {value}
      </div>
      <div className="mt-2 text-xs lowercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs lowercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="tabular mt-1">{value}</dd>
    </div>
  );
}
