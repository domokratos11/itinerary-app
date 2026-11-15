"use client";

import Image from "next/image";
import { LockKeyhole, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { LanguageSelect } from "@/components/language-select";
import { NewTripPanel } from "@/components/new-trip";
import { SetupWizard } from "@/components/setup-wizard";
import { TripSummaryText } from "@/components/trip-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { APP_VERSION } from "@/lib/app-reset";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { useActiveTrip, useAuthStore } from "@/lib/auth-store";
import { BASE_PATH } from "@/lib/base-path";
import { PHRASEBOOK_GUIDE_PATH } from "@/lib/phrasebook";
import { usePlanStore } from "@/lib/plan-store";
import { openMyTrips, openTrip } from "@/lib/trip-id";
import { useTripStore } from "@/lib/trip-store";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { leaveSharedView, useViewerStore } from "@/lib/viewer-store";
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
  const tripChosen = useAuthStore((s) => s.tripChosen);
  const tripArrived = useTripStore(
    (s) => Object.values(s.loaded).every(Boolean) || s.error !== null,
  );
  // The plan too, so no screen flashes "no stops" before its items arrive.
  const planArrived = usePlanStore((s) => s.ready || s.error !== null);
  const tripLoaded = tripArrived && planArrived;
  const online = useOnline();
  const viewer = useViewerStore((s) => s.status);
  const activeTrip = useActiveTrip();
  // "Finish later" opens the app at once, before the trip list says done.
  const [setupLeft, setSetupLeft] = useState(false);

  // A read-only link: its own screens, and never the sign-in ones.
  if (viewer !== "off") {
    if (viewer === "loading") return <Splash />;
    if (viewer === "closed") return <ShareClosed />;
    if (viewer === "failed")
      return online ? <ShareClosed /> : <OfflineScreen />;
    if (!tripLoaded) return <Splash />;
    return children;
  }

  if (status === "loading") return <Splash />;
  if (status === "signed-out")
    return (
      <Screen title={t("gate.signInTitle")}>
        <p>{t("gate.signInBody")}</p>
        <LanguageSelect id="gate-language" />
        <SignInButton />
      </Screen>
    );

  const email = user?.email ?? t("gate.thisAccount");
  if (!tripId) {
    // The list can answer before a trip is chosen from it; until then "No
    // trips yet" or the picker would only flash by.
    const choosing = trips !== null && trips.length > 0 && !tripChosen;
    if ((trips === null && !tripsFailed) || choosing)
      return online ? <Splash /> : <OfflineScreen />;
    // A single trip reaches here after "All itineraries" (or when it arrived
    // after the choice): it is still listed, with "New itinerary".
    if (trips && trips.length > 0) return <TripPicker />;
    return <NoTrips email={email} />;
  }
  if (access === "denied")
    return (
      <Screen title={t("gate.notOnTripTitle")}>
        <p>{t("gate.notOnTripBody", { email })}</p>
        <Button onClick={openMyTrips}>{t("gate.goToMyTrips")}</Button>
        <SignOutButton label={t("gate.useAnother")} variant="outline" />
      </Screen>
    );
  if (access === "missing")
    return (
      <Screen title={t("gate.notFoundTitle")}>
        <p>{t("gate.notFoundBody")}</p>
        <Button onClick={openMyTrips}>{t("gate.goToMyTrips")}</Button>
        <SignOutButton label={t("gate.signOut")} variant="outline" />
      </Screen>
    );
  if (access === "checking") return online ? <Splash /> : <OfflineScreen />;
  if (!tripLoaded) return <Splash />;
  // A new itinerary still being set up. Trips with no `setup` never see it.
  if (activeTrip?.setup === "pending" && !setupLeft)
    return (
      <SetupWizard
        tripId={tripId}
        trip={activeTrip}
        onDone={() => setSetupLeft(true)}
      />
    );
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

function Screen({
  title,
  wide = false,
  children,
}: {
  title: string;
  // Room for two columns from lg, for the trip picker.
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4"
    >
      <Card className={cn("w-full max-w-sm", wide && "lg:max-w-xl")}>
        <CardHeader>
          <LockKeyhole className="size-6 text-primary" aria-hidden />
          <CardTitle id="app-gate-title" className="text-lg">
            {title}
          </CardTitle>
          <CardDescription>{t("common.appName")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          {children}
          <p className="text-center text-xs">
            {t("common.version", { version: APP_VERSION })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// The link has expired, was revoked or never existed: the rules refuse all
// three alike, so the screen doesn't say which.
function ShareClosed() {
  return (
    <Screen title={t("share.closedTitle")}>
      <p>{t("share.closedBody")}</p>
      <Button variant="outline" onClick={leaveSharedView}>
        {t("share.memberSignIn")}
      </Button>
    </Screen>
  );
}

// The phrasebook's static copy needs no sign-in or trip, so it still opens
// from the precache here (a plain link: it isn't a Next route).
function OfflineScreen() {
  return (
    <Screen title={t("gate.offlineTitle")}>
      <p>{t("gate.offlineBody")}</p>
      <Button asChild variant="outline">
        <a href={`${BASE_PATH}${PHRASEBOOK_GUIDE_PATH}`}>
          {t("gate.offlinePhrasebook")}
        </a>
      </Button>
    </Screen>
  );
}

// Each trip as a card to open, with its dates and whether it still needs
// setting up. A long list scrolls inside the card, so sign-out stays in view.
function TripPicker() {
  const trips = useAuthStore((s) => s.trips) ?? [];
  return (
    <Screen title={t("gate.chooseTrip")} wide>
      <ul className="-mx-1 grid max-h-[min(55svh,28rem)] gap-2 overflow-y-auto px-1 py-0.5 lg:grid-cols-2">
        {trips.map((trip) => (
          <li key={trip.id} className="min-w-0">
            <Button
              variant="outline"
              className="h-auto min-h-14 w-full justify-start py-2 whitespace-normal"
              onClick={() => openTrip(trip.id)}
            >
              <TripSummaryText trip={trip} />
            </Button>
          </li>
        ))}
      </ul>
      <NewTripButton />
      <SignOutButton label={t("gate.signOut")} variant="outline" />
    </Screen>
  );
}

function NoTrips({ email }: { email: string }) {
  return (
    <Screen title={t("gate.noTripsTitle")}>
      <p>{t("gate.noTripsBody", { email })}</p>
      <NewTripButton />
      <SignOutButton label={t("gate.useAnother")} variant="outline" />
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
        {t("gate.newTrip")}
      </Button>
      {open && <NewTripPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SignInButton() {
  const [busy, setBusy] = useState(false);
  const start = () => {
    setBusy(true);
    signInWithGoogle()
      .catch((error: Error) =>
        toast.error(error.message, {
          action: { label: t("gate.tryAgain"), onClick: start },
        }),
      )
      .finally(() => setBusy(false));
  };
  return (
    <Button disabled={busy} onClick={start}>
      {busy ? t("gate.signingIn") : t("gate.signIn")}
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
          toast.error(t("gate.signOutFailed"));
        });
      }}
    >
      {label}
    </Button>
  );
}
