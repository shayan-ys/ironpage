"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { alarmIsLive } from "@/lib/alarm";
import { hapticRef } from "@/lib/haptics";
import { restSkipStorageKey, restWindow, type RestWindow } from "@/lib/rest";
import type { Session } from "@/lib/types";
import { AlarmLayers, getAudioContext, loadChime, useEndAlarm } from "./EndAlarm";

type AudioNavigator = Navigator & { audioSession?: { type: string } };
type ScreenWakeLock = { released: boolean; release: () => Promise<void>; addEventListener: (type: "release", listener: () => void) => void };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<ScreenWakeLock> } };

let wakeLock: ScreenWakeLock | null = null;
// Two independent reasons to keep the screen on. A rest ending (or being
// skipped) must not switch the screen off in the middle of a hold countdown.
let restWantsWake = false;
let holdWantsWake = false;
let wakeRequestPending = false;

function syncWakeLock(): void {
  if (typeof navigator === "undefined") return;
  if (!restWantsWake && !holdWantsWake) {
    const current = wakeLock;
    wakeLock = null;
    if (current && !current.released) void current.release().catch(() => {});
    return;
  }
  const api = (navigator as WakeLockNavigator).wakeLock;
  if (!api || wakeRequestPending || (wakeLock && !wakeLock.released)) return;
  wakeRequestPending = true;
  void api.request("screen").then((sentinel) => {
    wakeRequestPending = false;
    if (!restWantsWake && !holdWantsWake) {
      void sentinel.release().catch(() => {});
      return;
    }
    wakeLock = sentinel;
    sentinel.addEventListener("release", () => {
      if (wakeLock === sentinel) wakeLock = null;
    });
  }).catch(() => {
    wakeRequestPending = false;
  });
}

function holdWakeLock(): void {
  restWantsWake = true;
  syncWakeLock();
}

function dropWakeLock(): void {
  restWantsWake = false;
  syncWakeLock();
}

/** The hold countdown's own claim on the screen (components/HoldTimer.tsx). */
export function holdTimerWakeLock(on: boolean): void {
  holdWantsWake = on;
  syncWakeLock();
}

function ownerWasSkipped(sessionId: string, key: string): boolean {
  try {
    return localStorage.getItem(restSkipStorageKey(sessionId, key)) === "1";
  } catch {
    return false;
  }
}

/**
 * Called synchronously from the done switch's raw `change` or the hold
 * timer's start tap, the user gesture iOS needs to resume the AudioContext.
 * The vetoed tick itself lands 60 ms later in a timer; unlocking audio on a
 * tick that is then vetoed is harmless. The Wake Lock is taken on the accepted
 * tick (`primeRestAlerts`), so a vetoed tick never leaves a lock behind.
 */
export function unlockRestAlerts(): void {
  if (typeof window === "undefined") return;
  try {
    const sessionType = (navigator as AudioNavigator).audioSession;
    if (sessionType) sessionType.type = "transient";
    const context = getAudioContext();
    if (context && context.state !== "running") {
      void context.resume().catch(() => {});
      const silent = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = silent;
      source.connect(context.destination);
      source.start(0);
    }
    void loadChime();
  } catch {
    // Audio support is optional; a blocked audio device must not block logging.
  }
}

/** Called after an accepted done tick: keep the lock only if a rest now runs. */
export function primeRestAlerts(session: Session): void {
  if (typeof window === "undefined") return;
  const rest = restWindow(session);
  if (rest && Date.now() < rest.endsAt && !ownerWasSkipped(session.id, rest.key)) holdWakeLock();
  else dropWakeLock();
}

function remainingLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * `host` is an open sheet's layer element (components/Sheet.tsx): while one is
 * open the rest bar, Skip, end flash and touch-to-stop layer render there, above
 * the modal sheet, and a touch on them never closes it.
 *
 * `holdRunning`: a hold countdown or its end alarm owns the screen, so a rest
 * that ends under it ends silently instead of fighting it for the next touch.
 */
export function RestExperience({
  session,
  host,
  holdRunning,
}: {
  session: Session;
  host: HTMLElement | null;
  holdRunning: boolean;
}) {
  const rest = restWindow(session);
  const [now, setNow] = useState(0);
  const [skippedKey, setSkippedKey] = useState<string | null>(null);
  const alarm = useEndAlarm(dropWakeLock);
  const { phase } = alarm;
  const fillRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const handledKey = useRef<string | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const restRef = useRef<RestWindow | null>(rest);
  const skippedRef = useRef(false);
  const holdRunningRef = useRef(holdRunning);
  restRef.current = rest;
  holdRunningRef.current = holdRunning;
  const skipped = rest !== null && (skippedKey === rest.key || ownerWasSkipped(session.id, rest.key));
  skippedRef.current = skipped;

  function startAlert(owner: RestWindow, endedAt: number): void {
    if (handledKey.current === owner.key) return;
    handledKey.current = owner.key;
    if (
      holdRunningRef.current ||
      !alarmIsLive(owner.endsAt, endedAt, document.visibilityState === "visible", hiddenAt.current !== null)
    ) {
      alarm.clear();
      dropWakeLock();
      return;
    }
    alarm.start(owner.key);
  }

  useEffect(() => {
    if (rest) {
      setSkippedKey(ownerWasSkipped(session.id, rest.key) ? rest.key : null);
    } else {
      setSkippedKey(null);
    }
  }, [session.id, rest?.key]);

  // The sound is fetched and decoded as the session opens, allowing the service
  // worker to cache it before the phone reaches a dead zone. Playback stays locked
  // until the next real done gesture resumes the context.
  useEffect(() => {
    void loadChime();
    return () => dropWakeLock();
  }, []);

  // One requestAnimationFrame clock drives both the fill and the m:ss label.
  useEffect(() => {
    if (!rest || session.finishedAt || skippedKey === rest.key || ownerWasSkipped(session.id, rest.key)) {
      if (alarm.phaseRef.current.kind !== "idle" && alarm.phaseRef.current.key !== rest?.key) alarm.clear();
      if (!rest || session.finishedAt || skippedKey === rest?.key) dropWakeLock();
      return;
    }

    let frame = 0;
    const total = rest.seconds * 1000;
    const finishClock = (at: number) => {
      setNow(at);
      if (fillRef.current) fillRef.current.style.transform = "scaleX(0)";
      if (labelRef.current) labelRef.current.textContent = "0:00";
      startAlert(rest, at);
      dropWakeLock();
    };
    const tick = () => {
      const at = Date.now();
      const left = Math.max(0, rest.endsAt - at);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${total > 0 ? left / total : 0})`;
      if (labelRef.current) labelRef.current.textContent = remainingLabel(left);
      if (left <= 0) {
        finishClock(at);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const at = Date.now();
    setNow(at);
    if (at >= rest.endsAt) finishClock(at);
    else {
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${total > 0 ? (rest.endsAt - at) / total : 0})`;
      if (labelRef.current) labelRef.current.textContent = remainingLabel(rest.endsAt - at);
      frame = requestAnimationFrame(tick);
      holdWakeLock();
    }
    return () => cancelAnimationFrame(frame);
  }, [session.id, session.finishedAt, rest?.key, rest?.endsAt, rest?.seconds, skippedKey]);

  // Ending while hidden, or more than three seconds before foreground delivery,
  // is deliberately silent. A running rest reacquires its lock on foreground.
  useEffect(() => {
    function visibilityChanged() {
      const owner = restRef.current;
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const hidAt = hiddenAt.current;
      hiddenAt.current = null;
      const at = Date.now();
      if (owner && hidAt !== null && owner.endsAt <= at && handledKey.current !== owner.key) {
        handledKey.current = owner.key;
        setNow(at);
        if (alarm.phaseRef.current.kind === "alerting" && alarm.phaseRef.current.key === owner.key) alarm.clear();
        dropWakeLock();
      } else if (owner && at < owner.endsAt && !skippedRef.current) holdWakeLock();
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => document.removeEventListener("visibilitychange", visibilityChanged);
  }, []);

  useEffect(() => {
    if (phase.kind === "idle") return;
    if (!rest || phase.key !== rest.key || session.finishedAt) {
      dropWakeLock();
      alarm.clear();
    }
  }, [phase.kind, phase.kind === "idle" ? null : phase.key, rest?.key, session.finishedAt]);

  function skipRest(): void {
    if (!rest) return;
    try {
      localStorage.setItem(restSkipStorageKey(session.id, rest.key), "1");
    } catch {
      // Keep Skip effective for this view even if local storage is unavailable.
    }
    handledKey.current = rest.key;
    setSkippedKey(rest.key);
    dropWakeLock();
    alarm.clear();
  }

  if (now === 0) return null;
  const running = !!rest && !session.finishedAt && !skipped && now < rest.endsAt;
  const total = rest ? rest.seconds * 1000 : 0;
  const left = rest ? Math.max(0, rest.endsAt - now) : 0;

  const layers = (
    <>
      {running && rest && (
        <>
          <div className="restbar" role="status" aria-label={`Rest ${remainingLabel(left)}`}>
            <i ref={fillRef} className="restbar-fill" style={{ transform: `scaleX(${total > 0 ? left / total : 0})` }} />
            <span ref={labelRef} className="restbar-time">{remainingLabel(left)}</span>
          </div>
          <button type="button" className="rest-skip" ref={hapticRef} data-haptic="light" onClick={skipRest}>Skip</button>
        </>
      )}
      <AlarmLayers alarm={alarm} />
    </>
  );
  return host ? createPortal(layers, host) : layers;
}
