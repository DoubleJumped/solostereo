// Lightweight liveness probe for Render's health check (see render.yaml
// healthCheckPath). Does NO database work, so it answers instantly even while
// a heavy page query is blocking the event loop — decoupling Render's
// readiness/port detection from page render time.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}
