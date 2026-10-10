"use client";

import { useEffect, useRef } from "react";
import { cancelGlide, findSetRow, glideToSet, pulse, stickyBottom } from "./setFocus";

const HANDOFF_DELAY_MS = 300;
const SCROLL_CANCEL_PX = 24;

type PendingHandoff = { timer: number; cleanup: () => void };

export function useSupersetScroll(): (targetKey: string) => void {
  const pending = useRef<PendingHandoff | null>(null);

  function disarm(): void {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    pending.current.cleanup();
    pending.current = null;
  }

  function arm(targetKey: string): void {
    disarm();
    const startScrollY = window.scrollY;
    const cancel = () => disarm();
    const onIntent = (event: Event) => {
      if (!(event.target as HTMLElement | null)?.closest?.(".rest-capture")) cancel();
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - startScrollY) > SCROLL_CANCEL_PX) cancel();
    };
    const inputTypes = ["pointerdown", "touchstart", "wheel", "keydown"] as const;
    for (const type of inputTypes) window.addEventListener(type, onIntent, { capture: true, passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    const cleanup = () => {
      for (const type of inputTypes) window.removeEventListener(type, onIntent, true);
      window.removeEventListener("scroll", onScroll);
    };
    const timer = window.setTimeout(() => {
      disarm();
      const row = findSetRow(targetKey);
      if (!row) return;
      const bounds = row.getBoundingClientRect();
      const top = stickyBottom();
      const comfortableInset = (window.innerHeight - top) * 0.15;
      if (bounds.top >= top + comfortableInset && bounds.bottom <= window.innerHeight - comfortableInset) {
        pulse(row);
        return;
      }
      glideToSet(row);
    }, HANDOFF_DELAY_MS);
    pending.current = { timer, cleanup };
  }

  useEffect(() => () => {
    disarm();
    cancelGlide();
  }, []);

  return arm;
}
