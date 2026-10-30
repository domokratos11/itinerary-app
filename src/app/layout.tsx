import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist_Mono, Oxanium } from "next/font/google";
import { Suspense } from "react";

import { AppHeader, BottomNav } from "@/components/app-header";
import { OfflineBanner } from "@/components/offline-banner";
import { PlanSync } from "@/components/plan-sync";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: "Japan Trip 2026–27",
  description: "Our day-by-day plan for Japan, Dec 2026 – Jan 2027.",
  appleWebApp: {
    capable: true,
    title: "Japan Trip",
    statusBarStyle: "default",
  },
  icons: { apple: `${BASE_PATH}/apple-touch-icon.png` },
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
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <ThemeProvider>
          <ServiceWorkerRegister />
          <Suspense fallback={null}>
            <AppHeader />
          </Suspense>
          <OfflineBanner />
          <Suspense fallback={null}>
            <PlanSync />
          </Suspense>
          {children}
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
