import type { Metadata, Viewport } from "next";
import { SyncOnLoad } from "@/components/SyncOnLoad";
import { DemoBar } from "@/lib/demo/DemoBar";
import "./globals.css";

// The demo's root layout (`*.demo.tsx` routes, see next.config.mjs). Unlike
// app/layout.tsx it registers no service worker, checks for no updates and
// links no manifest: the demo is a page to try, not an app to install.
// DemoBar's module installs the `/api` shim before any page renders.

export const metadata: Metadata = {
  title: "Ironpage demo",
  description: "Try Ironpage in your browser. Your data stays in this browser.",
};

export const viewport: Viewport = {
  themeColor: "#0d0f10",
  width: "device-width",
  initialScale: 1,
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoBar />
        <SyncOnLoad />
        {children}
      </body>
    </html>
  );
}
