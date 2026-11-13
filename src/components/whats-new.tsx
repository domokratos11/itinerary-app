"use client";

import { useState, type ReactNode } from "react";

import { CHANGELOG, changelogForDisplay } from "@/domain/changelog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { APP_VERSION } from "@/lib/app-reset";
import { formatFullDate } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

function Entries() {
  const entries = changelogForDisplay(CHANGELOG, APP_VERSION);
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("changelog.empty")}</p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {entries.map((entry) => (
        <section key={entry.date} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">
            {t("changelog.entryHeading", {
              version: entry.version,
              date: formatFullDate(entry.date),
            })}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {entry.items.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// The summary of what changed in each version: a Dialog on wide screens and a
// bottom Drawer on phones, like EditPanel.
export function WhatsNewPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wide = useMediaQuery("(min-width: 768px)");

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="pr-10">
            <DialogTitle>{t("changelog.title")}</DialogTitle>
            <DialogDescription>{t("changelog.description")}</DialogDescription>
          </DialogHeader>
          <Entries />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{t("changelog.title")}</DrawerTitle>
          <DrawerDescription>{t("changelog.description")}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <Entries />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// The version label as a button that opens the summary.
export function WhatsNewButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t("changelog.open")}
        onClick={() => setOpen(true)}
        className={cn(
          "underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        {children}
      </button>
      {open && <WhatsNewPanel open onOpenChange={setOpen} />}
    </>
  );
}
