"use client";

import { useEffect, useRef, useState, type ReactNode, type PointerEvent, type MouseEvent } from "react";
import { haptic, hapticRef, hapticZoneRef } from "@/lib/haptics";

const MAX_SCALE = 4;
/** Movement beyond this turns a touch into a pan or pinch, so it is no tap. */
const TAP_SLOP_PX = 8;

type View = { scale: number; x: number; y: number };
type Point = { x: number; y: number };
const IDENTITY: View = { scale: 1, x: 0, y: 0 };

function centroid(pts: Point[]): Point {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}

/**
 * Two-finger pinch zoom and one-finger pan (once zoomed) for its children,
 * with taps still reaching them. The browser's own gestures are off inside it
 * (`touch-action:none`), so a pinch zooms the content rather than the page.
 * A gesture that moved swallows the click that follows it. Pointers are not
 * captured: capture would retarget the click away from the tapped child.
 */
export function PinchZoom({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(IDENTITY);
  const pointers = useRef(new Map<number, Point>());
  // The gesture's starting state, re-based whenever a finger lands or lifts.
  const start = useRef<{ view: View; mid: Point; dist: number } | null>(null);
  const moved = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  // iOS Safari still fires its own pinch gesture events; keep them off the page.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("gesturestart", stop);
    el.addEventListener("gesturechange", stop);
    return () => {
      el.removeEventListener("gesturestart", stop);
      el.removeEventListener("gesturechange", stop);
    };
  }, []);

  function rebase() {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) {
      start.current = null;
      return;
    }
    const mid = centroid(pts);
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    start.current = { view: viewRef.current, mid, dist };
  }

  function onPointerDown(e: PointerEvent) {
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rebase();
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !start.current || !box.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const s = start.current;
    const mid = centroid(pts);
    const pinching = pts.length > 1 && s.dist > 0;
    if (!pinching && s.view.scale === 1) {
      // One finger on unzoomed content is a tap or nothing; never pan it.
      if (Math.hypot(mid.x - s.mid.x, mid.y - s.mid.y) > TAP_SLOP_PX) moved.current = true;
      return;
    }
    const dist = pinching ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    const scale = pinching ? Math.min(MAX_SCALE, Math.max(1, (s.view.scale * dist) / s.dist)) : s.view.scale;
    if (Math.hypot(mid.x - s.mid.x, mid.y - s.mid.y) > TAP_SLOP_PX || Math.abs(scale - s.view.scale) > 0.02) moved.current = true;

    // Keep the content point under the starting midpoint under the current midpoint.
    const rect = box.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const k = scale / s.view.scale;
    const x = mid.x - cx - (s.mid.x - cx - s.view.x) * k;
    const y = mid.y - cy - (s.mid.y - cy - s.view.y) * k;
    // Never pan the content's edge inside the frame.
    const maxX = ((scale - 1) * rect.width) / 2;
    const maxY = ((scale - 1) * rect.height) / 2;
    // Detents at both ends of the zoom range. Android only: a pinch is not a
    // tap, so an iPhone cannot tick for it.
    const was = viewRef.current.scale;
    if (pinching && ((scale === MAX_SCALE && was < MAX_SCALE) || (scale === 1 && was > 1))) haptic("light");
    setView({ scale, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) });
  }

  function onPointerEnd(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    rebase();
  }

  function onClickCapture(e: MouseEvent) {
    if (!moved.current) return;
    moved.current = false;
    e.stopPropagation();
    e.preventDefault();
  }

  const zoomed = view.scale > 1;
  return (
    <div
      ref={(el) => {
        box.current = el;
        // iPhone ticks for taps on the content whose handlers call `haptic()`.
        hapticZoneRef(el);
      }}
      className={className}
      style={{ position: "relative", overflow: "hidden", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "50% 50%" }}>
        {children}
      </div>
      {zoomed && (
        <button
          type="button"
          className="zoomreset"
          ref={hapticRef}
          data-haptic="selection"
          onClick={(e) => {
            e.stopPropagation();
            setView(IDENTITY);
          }}
        >
          Reset zoom
        </button>
      )}
    </div>
  );
}
