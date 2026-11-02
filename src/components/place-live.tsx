"use client";

import { useEffect, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { hoursDifference } from "@/domain/live-hours";
import {
  MapsError,
  type LivePlace,
  type PlacePhoto,
} from "@/domain/maps-service";
import type { PlaceRecord } from "@/domain/schemas";
import { BASE_PATH } from "@/lib/base-path";
import { intlLocale, t } from "@/lib/i18n";
import { mapsService } from "@/lib/maps-service-instance";
import {
  livePlace,
  placePhotos,
  showPhoto,
  shownPhotos,
} from "@/lib/place-live-cache";
import { useOnline } from "@/lib/use-online";

function messageFor(error: unknown): string {
  if (error instanceof MapsError) {
    if (error.kind === "quota") return t("live.limit");
    if (error.kind === "offline") return t("live.offline");
    if (error.kind === "not-configured") return t("live.notConfigured");
  }
  // The person sees a general message, so keep the real cause findable.
  console.warn("Google Maps call failed:", error);
  return t("live.noAnswer");
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

// Google's live details for a place, loaded as it opens. Nothing is stored, and
// lib/place-live-cache keeps reopening a place from being another billed call.
export function PlaceLive({ place }: { place: PlaceRecord }) {
  const online = useOnline();
  if (!place.googlePlaceId || !mapsService.isConfigured()) return null;
  if (!online)
    return (
      <p className="text-sm text-muted-foreground">
        {t("live.needsConnection")}
      </p>
    );
  return <LiveDetails place={place} placeId={place.googlePlaceId} />;
}

// Google's photos for a place, at the top of its details. Offline, PlaceLive
// says why they're missing.
export function PlacePhotos({ place }: { place: PlaceRecord }) {
  const online = useOnline();
  if (!online || !place.googlePlaceId || !mapsService.isConfigured())
    return null;
  return <Photos placeId={place.googlePlaceId} />;
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

  useEffect(() => {
    let current = true;
    livePlace(placeId)
      .then((answer) => {
        if (current) setLive(answer);
      })
      .catch((error: unknown) => {
        if (current) setProblem(messageFor(error));
      });
    return () => {
      current = false;
    };
  }, [placeId]);

  if (problem)
    return <p className="text-sm text-muted-foreground">{problem}</p>;
  if (!live)
    return (
      <Skeleton aria-label={t("live.loading")} className="h-24 rounded-lg" />
    );

  const difference = hoursDifference(place.openingHours, live.todayHours, t);
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("live.fromGoogle")}
        </h3>
        <GoogleAttribution />
      </div>
      {live.openNow !== null && (
        <p className="font-medium">
          {live.openNow ? t("live.openNow") : t("live.closedNow")}
        </p>
      )}
      {live.todayHours && (
        <p>{t("live.todayHours", { hours: live.todayHours })}</p>
      )}
      {live.rating !== null && (
        <p>
          {live.ratingCount !== null
            ? t("live.ratedCount", {
                rating: live.rating,
                count: live.ratingCount.toLocaleString(intlLocale()),
              })
            : t("live.rated", { rating: live.rating })}
        </p>
      )}
      {live.openNow === null && !live.todayHours && live.rating === null && (
        <p className="text-muted-foreground">{t("live.noDetails")}</p>
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
          {t("live.seeOnMaps")}
        </a>
      )}
    </section>
  );
}

function Photos({ placeId }: { placeId: string }) {
  const [photos, setPhotos] = useState<PlacePhoto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  // Each photo's image is requested only once it has been shown: that request
  // is what's billed. Going past the limit leaves the rest unloaded.
  const [loaded, setLoaded] = useState(() => shownPhotos(placeId));
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let current = true;
    placePhotos(placeId)
      .then((answer) => {
        if (!current) return;
        setLoaded(shownPhotos(placeId));
        setPhotos(answer);
      })
      .catch((error: unknown) => {
        // The live details beside them say the same, so one message is enough.
        messageFor(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [placeId]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const next = api.selectedScrollSnap();
      setIndex(next);
      if (showPhoto(placeId, next)) setLoaded(shownPhotos(placeId));
      else setBlocked(true);
    };
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, placeId]);

  if (failed || photos?.length === 0) return null;
  if (!photos)
    return (
      <Skeleton
        aria-label={t("live.loading")}
        className="aspect-[4/3] w-full rounded-lg"
      />
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
                    alt={t("live.photoAlt", {
                      index: i + 1,
                      total: photos.length,
                    })}
                    className="size-full object-cover"
                  />
                ) : (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {blocked ? t("live.limit") : t("live.loading")}
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
            {t("live.photoBy")}{" "}
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
            {t("live.original")}
          </a>
        )}
        <span className="ml-auto">
          {t("live.position", { index: index + 1, total: photos.length })}
        </span>
        <GoogleAttribution />
      </div>
    </section>
  );
}
