import {
  MapsError,
  type LivePlace,
  type MapLine,
  type MapOptions,
  type MapPin,
  type MapsService,
  type MapView,
  type PlacePhoto,
  type PlaceSuggestion,
  type WalkingLeg,
} from "@/domain/maps-service";
import type { LatLng } from "@/lib/geo";
import { mapsConfig } from "@/lib/maps.config";

const READY_CALLBACK = "__itineraryMapsReady";
const MAX_PHOTOS = 10;
const PHOTO_WIDTH = 800;
const TOKYO: LatLng = { lat: 35.6812, lng: 139.7671 };

type MapsWindow = Window & {
  gm_authFailure?: () => void;
  [READY_CALLBACK]?: () => void;
};

// Google reports a refused key here, not as a rejected promise.
const authListeners = new Set<() => void>();
let authFailed = false;
let loading: Promise<void> | null = null;

// The SDK is one script tag, added the first time something needs it, so
// nothing is downloaded until a map or a live feature is opened.
function loadSdk(): Promise<void> {
  if (!mapsConfig.browserKey || !mapsConfig.mapId)
    return Promise.reject(new MapsError("not-configured"));
  if (authFailed) return Promise.reject(new MapsError("not-configured"));
  if (!navigator.onLine) return Promise.reject(new MapsError("offline"));
  loading ??= new Promise<void>((resolve, reject) => {
    const page = window as MapsWindow;
    page[READY_CALLBACK] = () => resolve();
    page.gm_authFailure = () => {
      authFailed = true;
      authListeners.forEach((listener) => listener());
    };
    const params = new URLSearchParams({
      key: mapsConfig.browserKey!,
      v: "weekly",
      language: "en",
      region: "JP",
      loading: "async",
      callback: READY_CALLBACK,
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      // Allow another try once the connection is back.
      loading = null;
      script.remove();
      reject(new MapsError("failed", "The Maps script didn't load"));
    };
    document.head.append(script);
  });
  return loading;
}

function asMapsError(error: unknown): MapsError {
  if (error instanceof MapsError) return error;
  const text = String(error);
  if (!navigator.onLine) return new MapsError("offline", text);
  if (/RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|OverQuota|quota|\b429\b/i.test(text))
    return new MapsError("quota", text);
  return new MapsError("failed", text);
}

async function guarded<T>(call: () => Promise<T>): Promise<T> {
  try {
    await loadSdk();
    return await call();
  } catch (error) {
    throw asMapsError(error);
  }
}

function pointKey(point: LatLng): string {
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
}

export class GoogleMapsService implements MapsService {
  // Session memory only: route results may not be stored.
  private legs = new Map<string, Promise<WalkingLeg>>();
  private session: google.maps.places.AutocompleteSessionToken | null = null;
  private predictions = new Map<string, google.maps.places.PlacePrediction>();

  isConfigured(): boolean {
    return Boolean(mapsConfig.browserKey && mapsConfig.mapId);
  }

  createMap(container: HTMLElement, options: MapOptions): Promise<MapView> {
    return guarded(async () => {
      const [{ Map, Polyline }, { AdvancedMarkerElement, PinElement }, core] =
        await Promise.all([
          google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary(
            "marker",
          ) as Promise<google.maps.MarkerLibrary>,
          google.maps.importLibrary("core") as Promise<google.maps.CoreLibrary>,
        ]);
      const map = new Map(container, {
        mapId: mapsConfig.mapId,
        center: TOKYO,
        zoom: 12,
        colorScheme:
          options.colorScheme === "dark"
            ? core.ColorScheme.DARK
            : core.ColorScheme.LIGHT,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      const onAuthFailure = () => options.onFailure("not-configured");
      authListeners.add(onAuthFailure);

      let markers: google.maps.marker.AdvancedMarkerElement[] = [];
      let polylines: google.maps.Polyline[] = [];
      let framed = "";

      function clear() {
        markers.forEach((marker) => {
          marker.map = null;
        });
        polylines.forEach((line) => line.setMap(null));
        markers = [];
        polylines = [];
      }

      function frame(pins: MapPin[]) {
        // Only when the pins change, so a new route doesn't move the map.
        const key = pins.map((pin) => pin.id).join("|");
        if (key === framed || pins.length === 0) return;
        framed = key;
        if (pins.length === 1) {
          map.setCenter(pins[0].position);
          map.setZoom(15);
          return;
        }
        const bounds = new core.LatLngBounds();
        pins.forEach((pin) => bounds.extend(pin.position));
        map.fitBounds(bounds, 48);
      }

      return {
        update(pins: MapPin[], lines: MapLine[]) {
          clear();
          markers = pins.map((pin) => {
            const content = new PinElement({
              background: pin.color,
              borderColor: "#ffffff",
              glyphColor: "#ffffff",
              glyphText: pin.label ?? undefined,
              scale: pin.emphasised ? 1.3 : 1,
            });
            const marker = new AdvancedMarkerElement({
              map,
              position: pin.position,
              title: pin.title,
              gmpClickable: pin.clickable,
            });
            marker.append(content);
            if (pin.clickable)
              marker.addEventListener("gmp-click", () =>
                options.onPinClick(pin.id),
              );
            return marker;
          });
          polylines = lines.map(
            (line) =>
              new Polyline({
                map,
                path: line.path,
                ...(line.kind === "walk"
                  ? { strokeColor: "#2563eb", strokeWeight: 4 }
                  : {
                      // Dashes, for a connection that isn't a real route.
                      strokeOpacity: 0,
                      icons: [
                        {
                          icon: {
                            path: "M 0,-1 0,1",
                            strokeColor: "#6b7280",
                            strokeOpacity: 1,
                            scale: 2,
                          },
                          offset: "0",
                          repeat: "12px",
                        },
                      ],
                    }),
              }),
          );
          frame(pins);
        },
        destroy() {
          clear();
          authListeners.delete(onAuthFailure);
        },
      };
    });
  }

  walkingLeg(from: LatLng, to: LatLng): Promise<WalkingLeg> {
    const key = `${pointKey(from)}|${pointKey(to)}`;
    const known = this.legs.get(key);
    if (known) return known;
    const request = guarded(async () => {
      const { Route } = (await google.maps.importLibrary(
        "routes",
      )) as google.maps.RoutesLibrary;
      const { routes } = await Route.computeRoutes({
        origin: from,
        destination: to,
        travelMode: "WALKING",
        fields: ["durationMillis", "distanceMeters", "path"],
      });
      const route = routes?.[0];
      if (!route?.durationMillis || route.distanceMeters === undefined)
        throw new MapsError("failed", "No walking route");
      return {
        minutes: Math.max(1, Math.round(route.durationMillis / 60_000)),
        meters: route.distanceMeters,
        path: (route.path ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
      };
    });
    this.legs.set(key, request);
    // A failure shouldn't stick: it may be a lost connection.
    request.catch(() => this.legs.delete(key));
    return request;
  }

  photos(placeId: string): Promise<PlacePhoto[]> {
    return guarded(async () => {
      const place = await this.place(placeId);
      await place.fetchFields({ fields: ["photos"] });
      return (place.photos ?? []).slice(0, MAX_PHOTOS).map((photo) => {
        const author = photo.authorAttributions[0];
        return {
          url: photo.getURI({ maxWidth: PHOTO_WIDTH }),
          authorName: author?.displayName ?? null,
          authorUrl: author?.uri ?? null,
          mapsUrl: photo.googleMapsURI ?? null,
        };
      });
    });
  }

  liveDetails(placeId: string, weekday: string): Promise<LivePlace> {
    return guarded(async () => {
      const place = await this.place(placeId);
      await place.fetchFields({
        fields: [
          "rating",
          "userRatingCount",
          "regularOpeningHours",
          "utcOffsetMinutes",
          "googleMapsURI",
        ],
      });
      const prefix = `${weekday}:`;
      const today = place.regularOpeningHours?.weekdayDescriptions.find(
        (line) => line.startsWith(prefix),
      );
      // isOpen answers undefined when the place publishes no hours.
      const open = place.regularOpeningHours ? await place.isOpen() : undefined;
      return {
        openNow: open ?? null,
        rating: place.rating ?? null,
        ratingCount: place.userRatingCount ?? null,
        todayHours: today ? today.slice(prefix.length).trim() : null,
        mapsUrl: place.googleMapsURI ?? null,
      };
    });
  }

  suggestPlaces(input: string): Promise<PlaceSuggestion[]> {
    return guarded(async () => {
      const { AutocompleteSessionToken, AutocompleteSuggestion } =
        (await google.maps.importLibrary(
          "places",
        )) as google.maps.PlacesLibrary;
      this.session ??= new AutocompleteSessionToken();
      const { suggestions } =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: this.session,
          includedRegionCodes: ["jp"],
          language: "en",
        });
      return suggestions.flatMap((suggestion) => {
        const prediction = suggestion.placePrediction;
        if (!prediction) return [];
        this.predictions.set(prediction.placeId, prediction);
        return [
          {
            placeId: prediction.placeId,
            name: prediction.mainText?.text ?? prediction.text.text,
            detail: prediction.secondaryText?.text ?? null,
          },
        ];
      });
    });
  }

  locatePlace(placeId: string): Promise<LatLng & { placeId: string }> {
    return guarded(async () => {
      // A place from its prediction carries the session, which ends here.
      const prediction = this.predictions.get(placeId);
      const place = prediction
        ? prediction.toPlace()
        : await this.place(placeId);
      this.session = null;
      this.predictions.clear();
      await place.fetchFields({ fields: ["location"] });
      if (!place.location) throw new MapsError("failed", "No location");
      return {
        placeId: place.id,
        lat: place.location.lat(),
        lng: place.location.lng(),
      };
    });
  }

  private async place(id: string): Promise<google.maps.places.Place> {
    const { Place } = (await google.maps.importLibrary(
      "places",
    )) as google.maps.PlacesLibrary;
    return new Place({ id });
  }
}
