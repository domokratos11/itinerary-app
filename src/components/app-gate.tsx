"use client";

import Image from "next/image";
import { LockKeyhole, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NewTripPanel } from "@/components/new-trip";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_VERSION } from "@/lib/app-reset";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";
import { BASE_PATH } from "@/lib/base-path";
import { openMyTrips, openTrip } from "@/lib/trip-id";
import { useTripStore } from "@/lib/trip-store";
import { useOnline } from "@/lib/use-online";

// The first thing on every page. `children` is the whole app and renders only
// for a signed-in member whose trip has arrived; everything else gets a screen
// of its own. The store starts as "loading", so the static HTML holds only the
// splash and nothing can show before sign-in.
export function AppGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const trips = useAuthStore((s) => s.trips);
  const tripsFailed = useAuthStore((s) => s.tripsFailed);
  const tripId = useAuthStore((s) => s.tripId);
  const access = useAuthStore((s) => s.access);
  const tripLoaded = useTripStore(
    (s) => Object.values(s.loaded).every(Boolean) || s.error !== null,
  );
  const online = useOnline();

  if (status === "loading") return <Splash />;
  if (status === "signed-out")
    return (
      <Screen title="Sign in to continue">
        <p>Only the people on a trip&apos;s member list can see it.</p>
        <SignInButton />
      </Screen>
    );

  const email = user?.email ?? "This account";
  if (!tripId) {
    if (trips === null && !tripsFailed)
      return online ? <Splash /> : <OfflineScreen />;
    if (trips && trips.length > 1) return <TripPicker />;
    return <NoTrips email={email} />;
  }
  if (access === "denied")
    return (
      <Screen title="Not on this trip">
        <p>
          {email} isn&apos;t on this trip&apos;s member list, or the link is
          incomplete. Ask someone on the trip to add your email, or use another
          account.
        </p>
        <Button onClick={openMyTrips}>Go to my trips</Button>
        <SignOutButton label="Use another account" variant="outline" />
      </Screen>
    );
  if (access === "missing")
    return (
      <Screen title="Trip not found">
        <p>There is no trip with this link. Check that you copied all of it.</p>
        <Button onClick={openMyTrips}>Go to my trips</Button>
        <SignOutButton label="Sign out" variant="outline" />
      </Screen>
    );
  if (access === "checking") return online ? <Splash /> : <OfflineScreen />;
  if (!tripLoaded) return <Splash />;
  return children;
}

// Shown while the answer is on its way. Says nothing about any trip.
export function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Image
        src={`${BASE_PATH}/icon-192.png`}
        alt=""
        width={96}
        height={96}
        loading="eager"
        className="animate-pulse"
      />
    </div>
  );
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4"
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <LockKeyhole className="size-6 text-primary" aria-hidden />
          <CardTitle id="app-gate-title" className="text-lg">
            {title}
          </CardTitle>
          <CardDescription>Trip Planner</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          {children}
          <p className="text-center text-xs">Version {APP_VERSION}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function OfflineScreen() {
  return (
    <Screen title="You're offline">
      <p>
        This device hasn&apos;t opened the trip before, so it has no copy to
        show. Connect to the internet to load it.
      </p>
    </Screen>
  );
}

function TripPicker() {
  const trips = useAuthStore((s) => s.trips) ?? [];
  return (
    <Screen title="Choose a trip">
      <ul className="flex flex-col gap-2">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => openTrip(trip.id)}
            >
              {trip.name ?? "My trip"}
            </Button>
          </li>
        ))}
      </ul>
      <NewTripButton />
      <SignOutButton label="Sign out" variant="outline" />
    </Screen>
  );
}

function NoTrips({ email }: { email: string }) {
  return (
    <Screen title="No trips yet">
      <p>
        {email} isn&apos;t on any trip&apos;s member list. Ask someone on a trip
        to add your email, or use another account.
      </p>
      <NewTripButton />
      <SignOutButton label="Use another account" variant="outline" />
    </Screen>
  );
}

function NewTripButton() {
  const canCreate = useAuthStore((s) => s.canCreateTrips);
  const [open, setOpen] = useState(false);
  if (!canCreate) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        New trip
      </Button>
      {open && <NewTripPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SignInButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      onClick={() => {
        setBusy(true);
        signInWithGoogle()
          .catch((error: Error) => toast.error(error.message))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? "Signing in…" : "Sign in with Google"}
    </Button>
  );
}

export function SignOutButton({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "outline";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        signOut().catch(() => {
          setBusy(false);
          toast.error("Couldn't sign out. Try again.");
        });
      }}
    >
      {label}
    </Button>
  );
}
