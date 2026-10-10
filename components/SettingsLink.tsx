"use client";

import Link from "next/link";
import { hapticRef } from "@/lib/haptics";

/** Header gear that opens the settings page. */
export function SettingsLink() {
  return (
    <Link className="recoverylink" href="/settings" aria-label="Settings" ref={hapticRef} data-haptic="medium">
      {/* The hub is a path, not a <circle>: `.recoverylink svg circle` is filled. */}
      <svg viewBox="0 0 24 24" aria-hidden="true" strokeLinejoin="round">
        <path d="M10.31 5.21L10.35 2.64H13.65L13.69 5.21A7 7 0 0 1 15.61 6L17.45 4.22L19.78 6.55L18 8.39A7 7 0 0 1 18.79 10.31L21.36 10.35V13.65L18.79 13.69A7 7 0 0 1 18 15.61L19.78 17.45L17.45 19.78L15.61 18A7 7 0 0 1 13.69 18.79L13.65 21.36H10.35L10.31 18.79A7 7 0 0 1 8.39 18L6.55 19.78L4.22 17.45L6 15.61A7 7 0 0 1 5.21 13.69L2.64 13.65V10.35L5.21 10.31A7 7 0 0 1 6 8.39L4.22 6.55L6.55 4.22L8.39 6A7 7 0 0 1 10.31 5.21Z" />
        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0z" />
      </svg>
    </Link>
  );
}
