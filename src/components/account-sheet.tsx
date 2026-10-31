"use client";

import { UserRound } from "lucide-react";

import { SignOutButton } from "@/components/app-gate";
import { LanguageSelect } from "@/components/language-select";
import { AboutSettings } from "@/components/settings-about";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuthStore } from "@/lib/auth-store";
import { t } from "@/lib/i18n";

// Everything about the person rather than the trip: who is signed in, their
// language and theme, and this device's copy of the app. Signing out also
// removes the trip's offline copy from the device.
export function AccountSheet() {
  const user = useAuthStore((s) => s.user);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("settings.account")}
        >
          <UserRound />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader className="text-left">
          <SheetTitle>{t("settings.account")}</SheetTitle>
          <SheetDescription className="break-words">
            {user?.email ?? user?.name ?? t("settings.aGoogleAccount")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <div className="flex flex-col gap-4">
            <LanguageSelect id="account-language" />
            <div className="flex flex-col items-start gap-1.5">
              <span className="text-sm font-medium">{t("theme.theme")}</span>
              <ThemeToggle />
            </div>
          </div>
          <Separator />
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              {t("settings.signOutHint")}
            </p>
            <SignOutButton label={t("gate.signOut")} variant="outline" />
          </div>
          <Separator />
          <AboutSettings />
        </div>
      </SheetContent>
    </Sheet>
  );
}
