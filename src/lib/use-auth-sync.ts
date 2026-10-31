"use client";

import { useEffect, useState } from "react";

import type { TripRepository } from "@/domain/trip-repository";
import type { UserProfile, UserRepository } from "@/domain/user-repository";
import { watchUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";
import { getLocale, setLocale } from "@/lib/i18n";
import { chooseTrip, recallTripId, rememberTripId } from "@/lib/trip-id";
import { tripRepository } from "@/lib/trip-repository-instance";
import { userRepository } from "@/lib/user-repository-instance";

// Tracks who is signed in, finds their trips, opens one and checks they are a
// member of it. Everything here runs in the browser only, so the build never
// touches Firebase. `fromUrl` is the ?trip= of the link, if any.
export function useAuthSync(
  fromUrl: string | null,
  repository: TripRepository = tripRepository,
  users: UserRepository = userRepository,
): void {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const email = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const trips = useAuthStore((s) => s.trips);
  const tripsFailed = useAuthStore((s) => s.tripsFailed);
  const tripId = useAuthStore((s) => s.tripId);
  const member = useAuthStore((s) => s.access === "member");
  const [profile, setProfile] = useState<{
    uid: string;
    value: UserProfile;
  } | null>(null);

  useEffect(
    () => watchUser((user) => useAuthStore.getState().setUser(user)),
    [],
  );

  useEffect(() => {
    if (!email) return;
    const store = useAuthStore.getState();
    repository.canCreateTrips().then(store.setCanCreateTrips);
    return repository.watchMyTrips(email, store.setTrips, store.setTripsFailed);
  }, [email, repository]);

  useEffect(() => {
    if (!uid) return;
    let current = true;
    users.get(uid).then((value) => {
      if (current) setProfile({ uid, value });
    });
    return () => {
      current = false;
    };
  }, [uid, users]);

  // The language saved for this person wins. Someone without one keeps what
  // they see now, which also saves it for their other devices.
  useEffect(() => {
    if (!profile) return;
    if (profile.value.language) setLocale(profile.value.language);
    else
      users.update(profile.uid, { language: getLocale() }).catch(() => {
        // The next sign-in tries again.
      });
  }, [profile, users]);

  // Once a trip is open it stays open; opening another reloads the page.
  const profileReady = profile !== null && profile.uid === uid;
  const listAnswered = trips !== null || tripsFailed;
  useEffect(() => {
    if (tripId || !profileReady || !listAnswered) return;
    useAuthStore.getState().setTripId(
      chooseTrip({
        fromUrl,
        remembered: recallTripId(),
        lastTripId: profile.value.lastTripId,
        trips: trips?.map((trip) => trip.id) ?? null,
      }),
    );
  }, [tripId, profileReady, listAnswered, fromUrl, profile, trips]);

  // Restarted for each user and trip, so a different account is checked afresh.
  useEffect(() => {
    if (!tripId || !uid) return;
    useAuthStore.getState().setAccess("checking");
    return repository.watchAccess(tripId, (access) =>
      useAuthStore.getState().setAccess(access),
    );
  }, [tripId, uid, repository]);

  // Only a trip the user could open is worth coming back to.
  useEffect(() => {
    if (!member || !tripId || !uid) return;
    rememberTripId(tripId);
    users.update(uid, { lastTripId: tripId }).catch(() => {
      // Only a convenience; the next open tries again.
    });
  }, [member, tripId, uid, users]);
}
