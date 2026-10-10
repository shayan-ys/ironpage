"use client";

import Link from "next/link";
import { hapticRef } from "@/lib/haptics";

/** Header icon that opens the readiness page; `from` is where its back link returns. */
export function RecoveryLink({ from }: { from: string }) {
  return (
    <Link
      className="recoverylink"
      href={`/recovery?from=${encodeURIComponent(from)}`}
      aria-label="Muscle readiness"
      ref={hapticRef}
      data-haptic="medium"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="4.5" r="2.5" />
        <path d="M5 9.5h14M12 9.5v5.5M12 15l-3.5 6.5M12 15l3.5 6.5M8 9.5l-1 5M16 9.5l1 5" />
      </svg>
    </Link>
  );
}
