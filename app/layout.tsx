import type { Metadata, Viewport } from "next";
import { PwaInit } from "@/components/PwaInit";
import { SyncOnLoad } from "@/components/SyncOnLoad";
import { UpdateCheck } from "@/components/UpdateCheck";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ironpage",
  description: "Your lifting log, on your Home Screen.",
  applicationName: "Ironpage",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Ironpage" },
};

export const viewport: Viewport = {
  themeColor: "#0d0f10",
  width: "device-width",
  initialScale: 1,
  // Deliberately no maximum-scale / user-scalable lock: that would kill
  // pinch-zoom for real accessibility use. Instead every text-entry control is
  // kept at >=16px (see .usernote in globals.css), which is what actually stops
  // iOS zooming on focus. Add a field below 16px and the zoom bug comes back.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaInit />
        <SyncOnLoad />
        <UpdateCheck />
        {children}
      </body>
    </html>
  );
}
