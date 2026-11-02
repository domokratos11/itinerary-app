"use client";

import Link from "next/link";
import { Eye, LogOut } from "lucide-react";

import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatTokyoDateTime } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { leaveSharedView, useViewerStore } from "@/lib/viewer-store";

// The account menu for someone on a read-only link: only the language and
// theme, which stay on this device, and a way back to signing in.
export function ViewerSheet() {
  const expiresAt = useViewerStore((s) => s.share?.expiresAt ?? null);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("share.viewerMenu")}
        >
          <Eye />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader className="text-left">
          <SheetTitle>{t("share.banner")}</SheetTitle>
          <SheetDescription>
            {expiresAt
              ? t("share.bannerUntil", {
                  date: formatTokyoDateTime(expiresAt),
                })
              : t("share.viewerHint")}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-5">
          <p className="text-sm text-muted-foreground">
            {t("share.viewerHint")}
          </p>
          <div className="flex flex-col gap-4">
            <LanguageSelect id="viewer-language" />
            <div className="flex flex-col items-start gap-1.5">
              <span className="text-sm font-medium">{t("theme.theme")}</span>
              <ThemeToggle />
            </div>
          </div>
          <Separator />
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              {t("share.leaveHint")}
            </p>
            <Button variant="outline" onClick={leaveSharedView}>
              <LogOut />
              {t("share.leave")}
            </Button>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// In place of a page a read-only link doesn't include, such as Budget or
// Settings, for anyone who types its address.
export function NotOnSharedView() {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 className="text-xl font-semibold">{t("share.notHereTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("share.notHereBody")}</p>
      <Button asChild variant="outline">
        <Link href="/">{t("share.backToTrip")}</Link>
      </Button>
    </div>
  );
}
