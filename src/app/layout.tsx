import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist_Mono, Oxanium } from "next/font/google";
import { Suspense } from "react";

import { AppHeader, BottomNav } from "@/components/app-header";
import { AppSidebar, AppSidebarProvider } from "@/components/app-sidebar";
import { AppGate } from "@/components/app-gate";
import { LocaleRoot } from "@/components/locale-root";
import { OfflineBanner } from "@/components/offline-banner";
import { PlanSync } from "@/components/plan-sync";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import { VersionGate } from "@/components/version-gate";
import { Toaster } from "@/components/ui/sonner";
import { BASE_PATH } from "@/lib/base-path";
import { cn } from "@/lib/utils";

// Oxanium has no Japanese glyphs, so Japanese text falls back to the
// phone's own fonts. next/font serves the font from the site, so it works
// offline.
const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-sans",
  fallback: [
    "Hiragino Sans",
    "Hiragino Kaku Gothic ProN",
    "Yu Gothic",
    "Noto Sans JP",
    "system-ui",
    "sans-serif",
  ],
});

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Trip Planner",
  description: "A private day-by-day trip plan.",
  appleWebApp: {
    capable: true,
    title: "Trip Planner",
    statusBarStyle: "default",
  },
  // Spelled out because of the base path: browsers otherwise ask for
  // /favicon.ico at the domain root, which isn't ours. The version makes them
  // fetch it again, as they hold on to favicons for a long time.
  icons: {
    icon: [
      {
        url: `${BASE_PATH}/favicon.ico?v=${process.env.NEXT_PUBLIC_APP_VERSION}`,
        sizes: "any",
      },
      {
        url: `${BASE_PATH}/icon-192.png?v=${process.env.NEXT_PUBLIC_APP_VERSION}`,
        type: "image/png",
        sizes: "192x192",
      },
    ],
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the class on <html> before the first paint, so the
    // server markup can differ from the client's.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        "font-sans",
        oxanium.variable,
        geistMono.variable,
      )}
    >
      {/* Grammarly and similar extensions edit <body> before React loads.
          These ask Grammarly to stay away; nothing here needs it. */}
      <body
        suppressHydrationWarning
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        <ThemeProvider>
          <VersionGate>
            <ServiceWorkerRegister />
            <Suspense fallback={null}>
              <PlanSync />
            </Suspense>
            {/* Nothing inside renders, in the static HTML or the browser, until
                a signed-in member has their trip. */}
            <LocaleRoot>
              <AppGate>
                <AppSidebarProvider>
                  <Suspense fallback={null}>
                    <AppHeader />
                  </Suspense>
                  <OfflineBanner />
                  <div className="flex flex-1">
                    <Suspense fallback={null}>
                      <AppSidebar />
                    </Suspense>
                    <div className="flex min-w-0 flex-1 flex-col">
                      {children}
                    </div>
                  </div>
                  <Suspense fallback={null}>
                    <BottomNav />
                  </Suspense>
                </AppSidebarProvider>
              </AppGate>
            </LocaleRoot>
          </VersionGate>
          {/* On phones, keep toasts above the bottom tab bar. */}
          <Toaster
            mobileOffset={{
              bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
