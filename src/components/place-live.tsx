"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { hoursDifference } from "@/domain/live-hours";
import {
  MapsError,
  type LivePlace,
  type PlacePhoto,
} from "@/domain/maps-service";
import type { PlaceRecord } from "@/domain/schemas";
import { BASE_PATH } from "@/lib/base-path";
import { mapsService } from "@/lib/maps-service-instance";
import { tryTap } from "@/lib/tap-limit";
import { weekdayInTokyo } from "@/lib/tokyo-date";
import { useOnline } from "@/lib/use-online";

const LIMIT_MESSAGE = "Today's limit for this was reached. It's back tomorrow.";

function messageFor(error: unknown): string {
  if (error instanceof MapsError) {
    if (error.kind === "quota") return LIMIT_MESSAGE;
    if (error.kind === "offline") return "You're offline.";
    if (error.kind === "not-configured") return "Google Maps isn't set up yet.";
  }
  return "Google didn't answer. Try again later.";
}

// Required beside Google's data when no Google map is showing. Google allows
// the name in text only where a logo doesn't fit, so text is just the fallback
// until the logo file is in public/.
function GoogleAttribution() {
  const [noLogo, setNoLogo] = useState(false);
  if (noLogo)
    return (
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        Google Maps
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed-size logo
    <img
      src={`${BASE_PATH}/google-maps-logo.svg`}
      alt="Google Maps"
      className="h-4 w-auto"
      onError={() => setNoLogo(true)}
    />
  );
}

// Google's photos and live details for a place. Nothing is fetched until it's
// tapped and nothing is stored, which keeps them inside the free allowance and
// Google's terms.
export function PlaceLive({ place }: { place: PlaceRecord }) {
  const online = useOnline();
  if (!place.googlePlaceId || !mapsService.isConfigured()) return null;
  if (!online)
    return (
      <p className="text-sm text-muted-foreground">
        Photos and live details need a connection.
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      <LiveDetails place={place} placeId={place.googlePlaceId} />
      <Photos placeId={place.googlePlaceId} />
    </div>
  );
}

function LiveDetails({
  place,
  placeId,
}: {
  place: PlaceRecord;
  placeId: string;
}) {
  const [live, setLive] = useState<LivePlace | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!tryTap("live")) return setProblem(LIMIT_MESSAGE);
    setLoading(true);
    setProblem(null);
    mapsService
      .liveDetails(placeId, weekdayInTokyo())
      .then(setLive)
      .catch((error: unknown) => setProblem(messageFor(error)))
      .finally(() => setLoading(false));
  }

  if (!live)
    return (
      <div className="flex flex-col gap-1">
        <Button variant="outline" disabled={loading} onClick={load}>
          <Globe />
          {loading ? "Asking Google…" : "Live from Google"}
        </Button>
        {problem && <p className="text-sm text-destructive">{problem}</p>}
      </div>
    );

  const difference = hoursDifference(place.openingHours, live.todayHours);
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Live from Google
        </h3>
        <GoogleAttribution />
      </div>
      {live.openNow !== null && (
        <p className="font-medium">
          {live.openNow ? "Open now" : "Closed now"}
        </p>
      )}
      {live.todayHours && <p>Today: {live.todayHours}</p>}
      {live.rating !== null && (
        <p>
          Rated {live.rating}
          {live.ratingCount !== null &&
            ` from ${live.ratingCount.toLocaleString("en-US")} reviews`}
        </p>
      )}
      {live.openNow === null && !live.todayHours && live.rating === null && (
        <p className="text-muted-foreground">Google has no details for this.</p>
      )}
      {difference && (
        <p className="rounded-md bg-muted px-2 py-1.5">{difference}</p>
      )}
      {live.mapsUrl && (
        <a
          href={live.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline"
        >
          See it on Google Maps
        </a>
      )}
    </section>
  );
}

function Photos({ placeId }: { placeId: string }) {
  const [photos, setPhotos] = useState<PlacePhoto[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  // Each photo's image is requested only once it has been shown: that request
  // is what's billed. Going past the limit leaves the rest unloaded.
  const [loaded, setLoaded] = useState<Set<number>>(new Set([0]));
  const seen = useRef(loaded);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const next = api.selectedScrollSnap();
      setIndex(next);
      if (seen.current.has(next)) return;
      if (!tryTap("photo")) return setBlocked(true);
      seen.current = new Set([...seen.current, next]);
      setLoaded(seen.current);
    };
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  function load() {
    if (!tryTap("photo")) return setProblem(LIMIT_MESSAGE);
    setLoading(true);
    setProblem(null);
    mapsService
      .photos(placeId)
      .then(setPhotos)
      .catch((error: unknown) => setProblem(messageFor(error)))
      .finally(() => setLoading(false));
  }

  if (!photos)
    return (
      <div className="flex flex-col gap-1">
        <Button variant="outline" disabled={loading} onClick={load}>
          <ImageIcon />
          {loading ? "Asking Google…" : "Show photo"}
        </Button>
        {problem && <p className="text-sm text-destructive">{problem}</p>}
      </div>
    );

  if (photos.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Google has no photos.</p>
    );

  const current = photos[index];
  return (
    <section className="flex flex-col gap-2">
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent>
          {photos.map((photo, i) => (
            <CarouselItem key={photo.url}>
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted">
                {loaded.has(i) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Google's URL, which can't be stored or optimised
                  <img
                    src={photo.url}
                    alt={`Photo ${i + 1} of ${photos.length}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {blocked ? LIMIT_MESSAGE : "Loading…"}
                  </p>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {photos.length > 1 && (
          <>
            <CarouselPrevious type="button" className="left-2" />
            <CarouselNext type="button" className="right-2" />
          </>
        )}
      </Carousel>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {current.authorName && (
          <span className="flex items-center gap-1.5">
            {current.authorPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- the photographer's avatar, from Google
              <img
                src={current.authorPhotoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-5 rounded-full"
              />
            )}
            Photo by{" "}
            {current.authorUrl ? (
              <a
                href={current.authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {current.authorName}
              </a>
            ) : (
              current.authorName
            )}
          </span>
        )}
        {current.mapsUrl && (
          <a
            href={current.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Original on Google Maps
          </a>
        )}
        <span className="ml-auto">
          {index + 1} of {photos.length}
        </span>
        <GoogleAttribution />
      </div>
    </section>
  );
}
