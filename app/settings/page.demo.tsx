"use client";

import { getProgram } from "@/lib/demo/store";
import { useDemoStore } from "@/lib/demo/use-demo-store";
import { SettingsClient } from "@/components/SettingsClient";
import pkg from "@/package.json";

/** The demo's settings: app/settings/page.tsx over the browser store. */
export default function DemoSettingsPage() {
  const program = useDemoStore(getProgram);
  return program === undefined ? <main className="wrap" /> : <SettingsClient program={program} version={pkg.version} />;
}
