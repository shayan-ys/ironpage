"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { alarmIsLive } from "@/lib/alarm";
import { holdLabel } from "@/lib/hold";
import { AlarmLayers, useEndAlarm } from "./EndAlarm";
import { holdTimerWakeLock } from "./RestExperience";

/** A running hold countdown on row `s` of exercise `e`. */
export interface Hold {
  e: number;
  s: number;
  /** Absolute end time (epoch ms); the countdown is always read against it. */
  endsAt: number;
  seconds: number;
  name: string;
  /** The row's display tag: "1", "2"… or "W1"… */
  label: string;
}

/**
 * The full-screen hold countdown for a timed exercise. While it runs, the
 * shared capture layer owns every touch: the first one cancels the hold, leaves
 * the set untouched, and is swallowed with the 500 ms guard. At zero it hands
 * the hold to `onEnd`, which ticks the set with `doneAt` = the end time, then
 * sounds the same end alarm as the rest bar (components/EndAlarm.tsx) unless
 * the end was reached hidden or delivered late (`alarmIsLive`).
 *
 * `host` is an open sheet's layer element, as for the rest layers.
 * `onBusyChange` reports whether the countdown or its alarm owns the screen.
 */
export function HoldTimer({
  hold,
  host,
  onEnd,
  onCancel,
  onBusyChange,
}: {
  hold: Hold | null;
  host: HTMLElement | null;
  onEnd: (hold: Hold) => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const alarm = useEndAlarm();
  const labelRef = useRef<HTMLDivElement>(null);
  // The hold that has ended or been cancelled, so the frame clock, the timer
  // backup and a touch cannot settle it twice.
  const settledKey = useRef<string | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const key = hold ? `hold:${hold.e}:${hold.s}:${hold.endsAt}` : null;
  const busy = hold !== null || alarm.phase.kind !== "idle";

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  useEffect(() => {
    if (!hold || !key) return;
    let frame = 0;
    const finish = (at: number) => {
      if (settledKey.current === key) return;
      settledKey.current = key;
      cancelAnimationFrame(frame);
      clearTimeout(backup);
      if (labelRef.current) labelRef.current.textContent = holdLabel(0);
      const live = alarmIsLive(hold.endsAt, at, document.visibilityState === "visible", hiddenAt.current !== null);
      onEndRef.current(hold);
      holdTimerWakeLock(false);
      if (live) alarm.start(key);
      else alarm.clear();
    };
    const tick = () => {
      const at = Date.now();
      const left = hold.endsAt - at;
      if (labelRef.current) labelRef.current.textContent = holdLabel(left);
      if (left <= 0) finish(at);
      else frame = requestAnimationFrame(tick);
    };
    // Frames stop while the page is hidden; the timer still settles the set
    // there (silently), or on return if the phone suspended the page.
    const backup = window.setTimeout(() => finish(Date.now()), Math.max(0, hold.endsAt - Date.now()));
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      if (Date.now() >= hold.endsAt) {
        finish(Date.now());
        return;
      }
      hiddenAt.current = null;
      holdTimerWakeLock(true);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    hiddenAt.current = document.visibilityState === "hidden" ? Date.now() : null;
    holdTimerWakeLock(true);
    document.addEventListener("visibilitychange", visibilityChanged);
    tick();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(backup);
      document.removeEventListener("visibilitychange", visibilityChanged);
      holdTimerWakeLock(false);
    };
  }, [key]);

  function cancelHold(): void {
    if (!key) return;
    // Guard even if the hold has just settled: the layer must outlive this touch.
    alarm.guard(key);
    if (settledKey.current === key) return;
    settledKey.current = key;
    onCancel();
  }

  const layers = (
    <AlarmLayers alarm={alarm} holding={!!hold} onHoldTouch={cancelHold}>
      {hold ? (
        <div className="hold" role="timer" aria-label={`${hold.name} hold`}>
          <div ref={labelRef} className="hold-time">
            {holdLabel(hold.seconds * 1000)}
          </div>
          <div className="hold-what">
            {hold.name} · set {hold.label}
          </div>
          <div className="hold-hint">tap anywhere to cancel</div>
        </div>
      ) : null}
    </AlarmLayers>
  );
  return host ? createPortal(layers, host) : layers;
}
