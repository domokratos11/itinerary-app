"use client";

import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { useMediaQuery } from "@/lib/use-media-query";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitLabel?: string;
  canSubmit?: boolean;
  children: ReactNode;
};

// A form in a Dialog on wide screens and a bottom Drawer on phones, the
// same split the place details and "Add to day" use.
export function EditPanel({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitLabel = t("common.save"),
  canSubmit = true,
  children,
}: Props) {
  const wide = useMediaQuery("(min-width: 768px)");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
      >
        {t("common.cancel")}
      </Button>
      <Button type="submit" disabled={!canSubmit}>
        {submitLabel}
      </Button>
    </>
  );

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader className="pr-10">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className={description ? "" : "sr-only"}>
                {description ?? title}
              </DialogDescription>
            </DialogHeader>
            {children}
            <DialogFooter>{actions}</DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className={description ? "" : "sr-only"}>
              {description ?? title}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4">
            {children}
          </div>
          <DrawerFooter className="flex-row justify-end">
            {actions}
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

// A labelled form field.
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
