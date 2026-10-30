"use client";

import { LockKeyhole } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";
import { useTripId } from "@/lib/use-trip-id";

// Covers the app while a trip link is open but its plan can't be shown:
// nobody signed in, or someone who isn't on the trip's member list. The
// trip-less preview (no ?trip=) shows only the bundled files and needs no
// sign-in. Must be used inside a Suspense boundary.
export function AuthGate() {
  const tripId = useTripId();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const access = useAuthStore((s) => s.access);

  if (!tripId || status === "loading") return null;
  if (status === "signed-out")
    return (
      <Screen title="Sign in to open the trip">
        <p>
          Only the people on this trip&apos;s member list can see and edit it.
        </p>
        <SignInButton />
      </Screen>
    );
  if (access === "denied")
    return (
      <Screen title="Not on this trip">
        <p>
          {user?.email ?? "This account"} isn&apos;t on this trip&apos;s member
          list, or the link is incomplete. Ask the trip owner to add your email,
          or use another account.
        </p>
        <SignOutButton label="Use another account" />
      </Screen>
    );
  if (access === "missing")
    return (
      <Screen title="Trip not found">
        <p>There is no trip with this link. Check that you copied all of it.</p>
        <SignOutButton label="Sign out" />
      </Screen>
    );
  return null;
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4"
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <LockKeyhole className="size-6 text-primary" aria-hidden />
          <CardTitle id="auth-gate-title" className="text-lg">
            {title}
          </CardTitle>
          <CardDescription>Japan Trip 2026–27</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          {children}
        </CardContent>
      </Card>
    </div>
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
