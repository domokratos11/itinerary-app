import type { TripDates } from "./schemas";
import type { Share, SharedTrip } from "./share";

export type NewShare = Pick<Share, "tripId" | "tripName" | "label"> & {
  expiresAt: string;
  // The trip's own dates, if it has them, published with the copy.
  dates?: TripDates | null;
};

// What a viewer opens: the link's details and its copy of the trip.
export type OpenedShare = { share: Share; trip: SharedTrip };

// Read-only links go only through this interface. The Firestore
// implementation is in src/lib; a memory version is used in tests.
export interface ShareRepository {
  // A trip's links, now and after every change. Members only.
  watchShares(
    tripId: string,
    onShares: (shares: Share[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  // Makes a link with this copy of the trip and returns it.
  create(input: NewShare, trip: SharedTrip): Promise<Share>;
  // Replaces the link's copy with this one, and its dates with the trip's.
  publish(
    share: Share,
    trip: SharedTrip,
    dates?: TripDates | null,
  ): Promise<void>;
  setExpiry(share: Share, expiresAt: string): Promise<void>;
  // Closes the link for good. Nothing is deleted; Clean up does that.
  revoke(share: Share): Promise<void>;
  // For a viewer, with no sign-in, always from the server. Null when the
  // link doesn't exist, has expired or was revoked: the rules refuse all
  // three alike.
  load(shareId: string): Promise<OpenedShare | null>;
}
