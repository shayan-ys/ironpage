"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { hapticRef } from "@/lib/haptics";

// Prefixed for a build served under a base path (the demo).
const SOUND_URL = `${process.env.GYM_BASE_PATH ?? ""}/sounds/rest-alarm.m4a`;
const ALERT_CAP_MS = 10000;
/** After a touch stops an alarm or cancels a hold, touches stay swallowed this long after it ends. */
const RELEASE_GUARD_MS = 500;
/** A click the stopping touch never delivered is still swallowed if it lands this soon after release. */
const LATE_CLICK_MS = 600;

export type AlarmPhase = { kind: "idle" } | { kind: "alerting"; key: string } | { kind: "releasing"; key: string };

const IDLE: AlarmPhase = { kind: "idle" };

let audioContext: AudioContext | null = null;
let chimePromise: Promise<AudioBuffer | null> | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

export function loadChime(): Promise<AudioBuffer | null> {
  const context = getAudioContext();
  if (!context) return Promise.resolve(null);
  if (!chimePromise) {
    chimePromise = fetch(SOUND_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Chime request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .catch(() => {
        chimePromise = null;
        return null;
      });
  }
  return chimePromise;
}

function stopAlertSound(sourceRef: { current: AudioBufferSourceNode | null }): void {
  const source = sourceRef.current;
  sourceRef.current = null;
  if (!source) return;
  try {
    source.stop();
  } catch {
    // The source may already have stopped.
  }
  source.disconnect();
}

function playChime(
  isStillAlerting: () => boolean,
  sourceRef: { current: AudioBufferSourceNode | null },
): void {
  void loadChime().then(async (buffer) => {
    const context = getAudioContext();
    if (!buffer || !context || !isStillAlerting()) return;
    let source: AudioBufferSourceNode | null = null;
    try {
      if (context.state !== "running") await context.resume();
      if (!isStillAlerting()) return;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(context.destination);
      sourceRef.current = source;
      source.onended = () => {
        if (sourceRef.current === source) sourceRef.current = null;
      };
      source.start();
    } catch {
      if (sourceRef.current === source) sourceRef.current = null;
      try {
        source?.stop();
      } catch {
        // The source may not have started.
      }
      source?.disconnect();
      // Sound can be unavailable on a device without Web Audio output.
    }
  });
}

function swallowNextClick(): void {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.removeEventListener("click", swallow, true);
    clearTimeout(expire);
  };
  const expire = window.setTimeout(() => window.removeEventListener("click", swallow, true), LATE_CLICK_MS);
  window.addEventListener("click", swallow, true);
}

export interface EndAlarm {
  phase: AlarmPhase;
  /** The latest phase, for timers and listeners that outlive a render. */
  phaseRef: { readonly current: AlarmPhase };
  /** Flash and loop the chime until a touch or the 10 s cap stops it. */
  start: (key: string) => void;
  /** A touch stopped something: own every touch until 500 ms after the last one ends. */
  guard: (key: string) => void;
  /** End silently, without the touch guard (page hidden, owner gone). */
  clear: () => void;
  onCaptureDown: (pointerId: number) => void;
  /** True for a click no pointerdown preceded (assistive activation): it stopped the alarm itself. */
  onCaptureClick: () => boolean;
  onCaptureUp: (pointerId: number) => void;
}

/**
 * The end alarm shared by the rest end (components/RestExperience.tsx) and the
 * hold end (components/HoldTimer.tsx): flash, looping chime, 10 s cap, and a
 * capture layer whose first touch stops it. The layer stays mounted, swallowing
 * every touch and click, until 500 ms after the last finger on it lifts, so a
 * tap that stops the alarm never lands on the page underneath. The cap and a
 * click-only activation arm the same 500 ms guard; hiding the page ends a
 * sounding alarm silently.
 *
 * `onStopped` runs when a touch or the cap ends a sounding alarm.
 */
export function useEndAlarm(onStopped?: () => void): EndAlarm {
  const [phase, setPhase] = useState<AlarmPhase>(IDLE);
  const phaseRef = useRef<AlarmPhase>(IDLE);
  const soundRef = useRef<AudioBufferSourceNode | null>(null);
  const releaseTimer = useRef<number | undefined>(undefined);
  const clickSeen = useRef(true);
  // A pointerdown since the last click: that click belongs to a touch the
  // pointer handlers already acted on.
  const pointerSeen = useRef(false);
  const downPointers = useRef(new Set<number>());
  const onStoppedRef = useRef(onStopped);
  onStoppedRef.current = onStopped;

  function changePhase(next: AlarmPhase): void {
    const current = phaseRef.current;
    if (current.kind === "alerting" && (next.kind !== "alerting" || next.key !== current.key)) {
      stopAlertSound(soundRef);
    }
    phaseRef.current = next;
    setPhase(next);
  }

  function clear(): void {
    clearTimeout(releaseTimer.current);
    downPointers.current.clear();
    pointerSeen.current = false;
    if (phaseRef.current.kind !== "idle") changePhase(IDLE);
  }

  function start(key: string): void {
    clearTimeout(releaseTimer.current);
    changePhase({ kind: "alerting", key });
    playChime(() => phaseRef.current.kind === "alerting" && phaseRef.current.key === key, soundRef);
  }

  // Leaves any armed release in place: a click-only cancel arms it first.
  function guard(key: string): void {
    changePhase({ kind: "releasing", key });
  }

  function release(): void {
    if (phaseRef.current.kind === "alerting") onStoppedRef.current?.();
    clear();
    if (!clickSeen.current) swallowNextClick();
    clickSeen.current = true;
  }

  function armRelease(): void {
    clearTimeout(releaseTimer.current);
    if (downPointers.current.size === 0) releaseTimer.current = window.setTimeout(release, RELEASE_GUARD_MS);
  }

  function onCaptureDown(pointerId: number): void {
    clearTimeout(releaseTimer.current);
    downPointers.current.add(pointerId);
    clickSeen.current = false;
    pointerSeen.current = true;
    const current = phaseRef.current;
    if (current.kind !== "alerting") return;
    onStoppedRef.current?.();
    guard(current.key);
  }

  function onCaptureClick(): boolean {
    clickSeen.current = true;
    const clickOnly = !pointerSeen.current;
    pointerSeen.current = false;
    if (!clickOnly) return false;
    const current = phaseRef.current;
    if (current.kind === "alerting") {
      onStoppedRef.current?.();
      guard(current.key);
    }
    armRelease();
    return true;
  }

  function onCaptureUp(pointerId: number): void {
    downPointers.current.delete(pointerId);
    armRelease();
  }

  useEffect(() => {
    if (phase.kind !== "alerting") return;
    const key = phase.key;
    const timer = window.setTimeout(() => {
      onStoppedRef.current?.();
      guard(key);
      armRelease();
    }, ALERT_CAP_MS);
    return () => clearTimeout(timer);
  }, [phase.kind, phase.kind === "alerting" ? phase.key : null]);

  useEffect(() => {
    function visibilityChanged() {
      if (document.visibilityState === "hidden" && phaseRef.current.kind === "alerting") clear();
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      clearTimeout(releaseTimer.current);
      stopAlertSound(soundRef);
    };
  }, []);

  return { phase, phaseRef, start, guard, clear, onCaptureDown, onCaptureClick, onCaptureUp };
}

/**
 * The alarm's flash and capture layer. `holding` keeps the capture layer up
 * while the hold countdown runs; its first touch goes to `onHoldTouch` instead.
 * `children` render beneath the flash (the countdown face). The capture layer
 * keeps its place in the tree across countdown, alarm and release, so a touch
 * in progress never loses its target.
 */
export function AlarmLayers({
  alarm,
  holding = false,
  onHoldTouch,
  children,
}: {
  alarm: EndAlarm;
  holding?: boolean;
  onHoldTouch?: () => void;
  children?: ReactNode;
}) {
  const { phase } = alarm;
  return (
    <>
      {children}
      {phase.kind === "alerting" ? <div key={phase.key} className="rest-flash" aria-hidden="true" /> : null}
      {holding || phase.kind !== "idle" ? (
        <div
          ref={hapticRef}
          data-haptic="medium"
          className="rest-capture"
          onPointerDown={(event) => {
            // Touch pointers are captured implicitly; a mouse needs it so its
            // pointerup still reaches the layer and releases the guard.
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // The pointer may already be gone.
            }
            const idle = alarm.phaseRef.current.kind === "idle";
            alarm.onCaptureDown(event.pointerId);
            if (holding && idle) onHoldTouch?.();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            const idle = alarm.phaseRef.current.kind === "idle";
            if (alarm.onCaptureClick() && holding && idle) onHoldTouch?.();
          }}
          onPointerUp={(event) => alarm.onCaptureUp(event.pointerId)}
          onPointerCancel={(event) => alarm.onCaptureUp(event.pointerId)}
        />
      ) : null}
    </>
  );
}
