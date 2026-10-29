import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { Suspense } from "react";

import { PlanSync } from "@/components/plan-sync";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const instrumentSansHeading = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Japan Trip 2026–27",
  description: "Our day-by-day plan for Japan, Dec 2026 – Jan 2027.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        "font-mono",
        geistMono.variable,
        instrumentSansHeading.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <Suspense fallback={null}>
          <PlanSync />
        </Suspense>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
