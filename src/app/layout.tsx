import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { Suspense } from "react";

import { OfflineBanner } from "@/components/offline-banner";
import { PlanSync } from "@/components/plan-sync";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { BASE_PATH } from "@/lib/base-path";
import { cn } from "@/lib/utils";

const instrumentSansHeading = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Japan Trip 2026–27",
  description: "Our day-by-day plan for Japan, Dec 2026 – Jan 2027.",
  appleWebApp: { capable: true, title: "Japan Trip", statusBarStyle: "default" },
  icons: { apple: `${BASE_PATH}/apple-touch-icon.png` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16a34a",
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
        "font-mono",
        geistMono.variable,
        instrumentSansHeading.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <ServiceWorkerRegister />
          <OfflineBanner />
          <Suspense fallback={null}>
            <PlanSync />
          </Suspense>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
