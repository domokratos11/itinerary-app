import {
  MapsError,
  type LivePlace,
  type MapLine,
  type MapPin,
  type MapsService,
  type MapView,
  type PlacePhoto,
  type PlaceSuggestion,
  type WalkingLeg,
} from "@/domain/maps-service";
import { distanceKm, type LatLng } from "@/lib/geo";

// In-memory Maps for tests and previews: no network, and it remembers what was
// asked for. Walking legs are worked out from straight-line distance.
export class LocalMapsService implements MapsService {
  lastPins: MapPin[] = [];
  lastLines: MapLine[] = [];
  legCalls = 0;

  constructor(
    private configured = true,
    private fixtures: {
      photos?: PlacePhoto[];
      live?: LivePlace;
      suggestions?: PlaceSuggestion[];
    } = {},
  ) {}

  isConfigured(): boolean {
    return this.configured;
  }

  private check(): void {
    if (!this.configured) throw new MapsError("not-configured");
  }

  async createMap(): Promise<MapView> {
    this.check();
    return {
      update: (pins, lines) => {
        this.lastPins = pins;
        this.lastLines = lines;
      },
      destroy: () => {},
    };
  }

  async walkingLeg(from: LatLng, to: LatLng): Promise<WalkingLeg> {
    this.check();
    this.legCalls += 1;
    const meters = Math.round(distanceKm(from, to) * 1000);
    return { minutes: Math.ceil(meters / 80), meters, path: [from, to] };
  }

  async photos(): Promise<PlacePhoto[]> {
    this.check();
    return this.fixtures.photos ?? [];
  }

  async liveDetails(): Promise<LivePlace> {
    this.check();
    return (
      this.fixtures.live ?? {
        openNow: null,
        rating: null,
        ratingCount: null,
        todayHours: null,
        mapsUrl: null,
      }
    );
  }

  async suggestPlaces(): Promise<PlaceSuggestion[]> {
    this.check();
    return this.fixtures.suggestions ?? [];
  }

  async locatePlace(placeId: string): Promise<LatLng & { placeId: string }> {
    this.check();
    return { placeId, lat: 35.7, lng: 139.7 };
  }
}
