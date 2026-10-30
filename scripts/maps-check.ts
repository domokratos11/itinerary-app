/**
 * Checks the Google Maps setup and tests train routes in Japan.
 * Run with `npm run maps:check`; add `-- --embed` to also serve the Maps Embed
 * transit test at http://localhost:3000/. Keys come from .env (git-ignored)
 * and are never printed. Nothing is stored.
 */
import { createServer } from "node:http";

const ORIGIN = "Ueno Station, Tokyo";
const DESTINATION = "Asakusa Station, Tokyo";
const LOCAL_URL = "http://localhost:3000/";

type RouteResponse = {
  routes?: {
    duration?: string;
    distanceMeters?: number;
    legs?: {
      steps?: {
        travelMode?: string;
        transitDetails?: { transitLine?: { name?: string } };
      }[];
    }[];
  }[];
};

function requireKey(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Set ${name} in .env. See docs/maps-setup.md.`);
    process.exit(1);
  }
  return value;
}

async function postJson<T>(
  url: string,
  key: string,
  fieldMask: string,
  body: unknown,
  referer?: string,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
      ...(referer ? { Referer: referer } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function checkScriptKey(key: string) {
  const { places } = await postJson<{ places?: { id: string }[] }>(
    "https://places.googleapis.com/v1/places:searchText",
    key,
    "places.id",
    { textQuery: "Ueno Zoo, Tokyo" },
  );
  const id = places?.[0]?.id;
  if (!id) throw new Error("Text Search returned no place");
  const details = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "location,formattedAddress",
    },
  });
  if (!details.ok) {
    throw new Error(`${details.status}: ${await details.text()}`);
  }
  const place = (await details.json()) as { formattedAddress?: string };
  console.log(`Script key OK. Ueno Zoo: ${place.formattedAddress}`);
}

async function testRoute(key: string, travelMode: "TRANSIT" | "WALK") {
  const { routes } = await postJson<RouteResponse>(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    key,
    "routes.duration,routes.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.transitDetails.transitLine.name",
    {
      origin: { address: ORIGIN },
      destination: { address: DESTINATION },
      travelMode,
    },
    LOCAL_URL,
  );
  const route = routes?.[0];
  if (!route) {
    console.log(`Routes ${travelMode}: no route returned`);
    return;
  }
  const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const modes = [...new Set(steps.map((step) => step.travelMode))].join(", ");
  const lines = steps.flatMap((step) => {
    const name = step.transitDetails?.transitLine?.name;
    return name ? [name] : [];
  });
  console.log(
    `Routes ${travelMode}: ${route.duration}, ${route.distanceMeters} m, step modes: ${modes}, lines: ${lines.join(", ") || "none"}`,
  );
}

function serveEmbed(key: string) {
  const params = new URLSearchParams({
    key,
    origin: ORIGIN,
    destination: DESTINATION,
    mode: "transit",
  });
  const html = `<!doctype html><title>Embed transit test</title>
<iframe width="100%" height="600" style="border:0" allowfullscreen loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  src="https://www.google.com/maps/embed/v1/directions?${params}"></iframe>`;
  createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  }).listen(3000, () => {
    console.log(`Embed test at ${LOCAL_URL} (Ctrl+C to stop)`);
  });
}

async function main() {
  process.loadEnvFile(".env");
  const browserKey = requireKey("GOOGLE_MAPS_BROWSER_KEY");
  const scriptKey = requireKey("GOOGLE_MAPS_SCRIPT_KEY");

  await checkScriptKey(scriptKey);
  await testRoute(browserKey, "WALK");
  await testRoute(browserKey, "TRANSIT");

  if (process.argv.includes("--embed")) serveEmbed(browserKey);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
