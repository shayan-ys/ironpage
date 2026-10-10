import { getProgram } from "@/lib/store";
import { SettingsClient } from "@/components/SettingsClient";
import pkg from "@/package.json";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return <SettingsClient program={(await getProgram()) ?? null} version={pkg.version} />;
}
