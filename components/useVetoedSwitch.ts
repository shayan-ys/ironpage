"use client";

import { useCallback, useEffect, useRef } from "react";
import { shouldAcceptSwitchChange, type SwitchGesture } from "@/lib/switch-veto";

type ActiveGesture = SwitchGesture & {
  startX: number;
  startY: number;
  pointerId: number | null;
  touchId: number | null;
  source: "pointer" | "touch";
};

let activeGesture: ActiveGesture | null = null;
let gestureListenersInstalled = false;

function updateMovement(x: number, y: number) {
  if (!activeGesture) return;
  const distance = Math.hypot(x - activeGesture.startX, y - activeGesture.startY);
  activeGesture.maxDistance = Math.max(activeGesture.maxDistance, distance);
}

function findTouch(touches: TouchList, identifier: number | null): Touch | null {
  for (let index = 0; index < touches.length; index++) {
    const touch = touches.item(index);
    if (touch && (identifier === null || touch.identifier === identifier)) return touch;
  }
  return null;
}

function clearAfterGesture(record: ActiveGesture) {
  window.setTimeout(() => {
    if (activeGesture === record) activeGesture = null;
  }, 1000);
}

function startPointer(event: PointerEvent) {
  if (!event.isPrimary) return;
  if (event.pointerType === "touch" && activeGesture?.source === "touch") {
    activeGesture.pointerId = event.pointerId;
    return;
  }
  activeGesture = {
    startX: event.clientX,
    startY: event.clientY,
    maxDistance: 0,
    cancelled: false,
    pointerId: event.pointerId,
    touchId: null,
    source: "pointer",
  };
}

function startTouch(event: TouchEvent) {
  const touch = event.touches.item(0);
  if (!touch) return;
  activeGesture = {
    startX: touch.clientX,
    startY: touch.clientY,
    maxDistance: 0,
    cancelled: false,
    pointerId: null,
    touchId: touch.identifier,
    source: "touch",
  };
}

function installGestureTracking() {
  if (gestureListenersInstalled || typeof document === "undefined") return;
  gestureListenersInstalled = true;

  document.addEventListener("pointerdown", startPointer, true);
  document.addEventListener("pointermove", (event) => {
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    if (activeGesture.source === "touch" && event.pointerType !== "touch") return;
    updateMovement(event.clientX, event.clientY);
  }, true);
  document.addEventListener("pointerup", (event) => {
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    updateMovement(event.clientX, event.clientY);
    clearAfterGesture(activeGesture);
  }, true);
  document.addEventListener("pointercancel", (event) => {
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    updateMovement(event.clientX, event.clientY);
    activeGesture.cancelled = true;
    clearAfterGesture(activeGesture);
  }, true);

  const passiveCapture = { capture: true, passive: true } as const;
  document.addEventListener("touchstart", startTouch, passiveCapture);
  document.addEventListener("touchmove", (event) => {
    if (!activeGesture || activeGesture.source !== "touch") return;
    const touch = findTouch(event.touches, activeGesture.touchId);
    if (touch) updateMovement(touch.clientX, touch.clientY);
  }, passiveCapture);
  document.addEventListener("touchend", (event) => {
    if (!activeGesture || activeGesture.source !== "touch") return;
    const touch = findTouch(event.changedTouches, activeGesture.touchId);
    if (!touch) return;
    updateMovement(touch.clientX, touch.clientY);
    clearAfterGesture(activeGesture);
  }, passiveCapture);
  document.addEventListener("touchcancel", (event) => {
    if (!activeGesture || activeGesture.source !== "touch") return;
    const touch = findTouch(event.changedTouches, activeGesture.touchId);
    if (touch) updateMovement(touch.clientX, touch.clientY);
    activeGesture.cancelled = true;
    clearAfterGesture(activeGesture);
  }, passiveCapture);
}

/** Keeps controlled native switches tappable while dropping cancelled or dragged changes. */
export function useVetoedSwitch(onAcceptedChange: () => void) {
  const inputRef = useCallback((input: HTMLInputElement | null) => {
    if (input) input.setAttribute("switch", "");
  }, []);
  const callbackRef = useRef(onAcceptedChange);
  callbackRef.current = onAcceptedChange;

  useEffect(() => {
    installGestureTracking();
  }, []);

  function onChange() {
    const observedGesture = activeGesture;
    window.setTimeout(() => {
      if (activeGesture === observedGesture) activeGesture = null;
      if (shouldAcceptSwitchChange(observedGesture)) callbackRef.current();
    }, 60);
  }

  return { inputRef, onChange };
}
