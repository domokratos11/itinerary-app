"use client";

import Image from "next/image";
import { LockKeyhole, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { LanguageSelect } from "@/components/language-select";
import { NewTripPanel } from "@/components/new-trip";
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
      <Screen title={t("gate.signInTitle")}>
        <p>{t("gate.signInBody")}</p>
        <LanguageSelect id="gate-language" />
        <SignInButton />
      </Screen>
    );

  const email = user?.email ?? t("gate.thisAccount");
  if (!tripId) {
    if (trips === null && !tripsFailed)
      return online ? <Splash /> : <OfflineScreen />;
    if (trips && trips.length > 1) return <TripPicker />;
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

function OfflineScreen() {
  return (
    <Screen title={t("gate.offlineTitle")}>
      <p>{t("gate.offlineBody")}</p>
    </Screen>
  );
}

function TripPicker() {
  const trips = useAuthStore((s) => s.trips) ?? [];
  return (
    <Screen title={t("gate.chooseTrip")}>
      <ul className="flex flex-col gap-2">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => openTrip(trip.id)}
            >
              {trip.name ?? t("common.myTrip")}
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
