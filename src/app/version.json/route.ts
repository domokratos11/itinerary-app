export const dynamic = "force-static";

// Written to out/version.json at build time. A running app fetches it to see
// whether a newer version was deployed; the service worker never caches it.
export function GET() {
  return Response.json({ version: process.env.NEXT_PUBLIC_APP_VERSION });
}
