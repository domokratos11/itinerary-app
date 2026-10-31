import type { MapsService } from "@/domain/maps-service";
import { GoogleMapsService } from "@/lib/google-maps-service";

// The one Maps service the app uses. Screens call it, never the Maps SDK.
export const mapsService: MapsService = new GoogleMapsService();
