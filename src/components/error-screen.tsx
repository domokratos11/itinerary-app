"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n";

// What a crashed screen shows instead of going blank. The error stays in
// the console for debugging; the screen only offers ways out.
export function ErrorScreen({
  error,
  children,
}: {
  error: unknown;
  children: ReactNode;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Card role="alert" aria-labelledby="error-screen-title">
        <CardHeader>
          <TriangleAlert className="size-6 text-destructive" aria-hidden />
          <CardTitle id="error-screen-title" className="text-lg">
            {t("error.title")}
          </CardTitle>
          <CardDescription>{t("error.body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          {children}
        </CardContent>
      </Card>
    </main>
  );
}
