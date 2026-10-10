"use client";

import { useLayoutEffect, useRef, useState } from "react";
import geometry from "@/lib/muscle-map-geometry.json";
import { MUSCLE_LABELS } from "@/lib/muscles";
import type { MuscleId, MuscleScores } from "@/lib/types";
import { regionMuscles, type View } from "./MuscleMap";

type Region = { slug: string; paths: string[] };
type Box = [number, number, number, number];

/** Margin around the focused muscles, as a share of their size. */
const PAD = 0.2;
/** Tightest crop height in map units (the figure is 1280 tall), so one small muscle keeps body context. */
const MIN_HEIGHT = 300;
/** Loosest crop height: a taller focus centres on its top-scoring muscles and lets the rest run off the edge. */
const MAX_HEIGHT = 450;

/**
 * The exercise's muscles on one body view, cropped to the main ones. The view
 * with more score wins (front on a tie). Muscles in that view scoring at least
 * half its top score are the focus: they pulse and the crop frames them,
 * widened to the frame's own aspect so nothing is stretched. A focus taller
 * than MAX_HEIGHT centres on the top-scoring muscles instead. Lower scores are
 * a fainter static fill. The crop is measured before first paint, so the full
 * figure never flashes.
 */
export function MuscleFocus({ muscles }: { muscles: MuscleScores }) {
  const top = Math.max(0, ...Object.values(muscles).map((s) => s ?? 0));
  const view = pickView(muscles);
  const full = geometry.viewBoxes[view] as Box;
  const svgRef = useRef<SVGSVGElement>(null);
  const focusRef = useRef<SVGGElement>(null);
  const leadRef = useRef<SVGGElement>(null);
  const sideRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<Box>(full);

  const scored = (geometry[view] as Region[]).map((region) => ({
    region,
    score: Math.max(0, ...regionMuscles(view, region.slug).map((m) => muscles[m] ?? 0)),
  }));
  const viewTop = Math.max(0, ...scored.map((r) => r.score));
  const regions = scored.map((r) => ({ ...r, focused: r.score > 0 && r.score >= viewTop / 2 }));
  const focusKey = regions.filter((r) => r.focused).map((r) => `${r.region.slug}:${r.score}`).join();

  // The body fills the frame left of the FRONT/BACK word: crop to that area's
  // aspect and pin the drawing left (xMinYMid), so the word never covers it.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const focus = focusRef.current;
    const lead = leadRef.current;
    if (!svg || !focus || !lead) return;
    const b = focus.getBBox();
    const room = svg.clientWidth - (sideRef.current?.offsetWidth ?? 0) - 24;
    if (b.width === 0 || svg.clientHeight === 0 || room <= 0) return;
    setBox(crop(b, lead.getBBox(), full, room / svg.clientHeight));
  }, [view, focusKey, full]);

  const labels = (Object.entries(muscles) as [MuscleId, number][])
    .filter(([, s]) => s > 0 && s >= top / 2)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => MUSCLE_LABELS[m]);

  return (
    <figure className="musclefocus">
      <span ref={sideRef} className="side" aria-hidden="true">{view}</span>
      <svg ref={svgRef} viewBox={box.join(" ")} preserveAspectRatio="xMinYMid meet" aria-hidden="true">
        {regions.map(({ region, score, focused }) => {
          if (focused) return null;
          return region.paths.map((d, i) => (
            <path
              key={`${region.slug}-${i}`}
              d={d}
              className={score > 0 ? "minor" : undefined}
              style={score > 0 ? { opacity: 0.25 + (0.35 * score) / viewTop } : undefined}
            />
          ));
        })}
        <g ref={focusRef} className="focus">
          {regions.flatMap(({ region, score, focused }) =>
            focused && score < viewTop ? region.paths.map((d, i) => <path key={`${region.slug}-${i}`} d={d} />) : [],
          )}
          <g ref={leadRef}>
            {regions.flatMap(({ region, score }) =>
              score > 0 && score === viewTop
                ? region.paths.map((d, i) => <path key={`${region.slug}-${i}`} d={d} />)
                : [],
            )}
          </g>
        </g>
      </svg>
      <figcaption>{labels.join(" · ")}</figcaption>
    </figure>
  );
}

/** The view that shows more of the exercise's score; front on a tie. */
function pickView(muscles: MuscleScores): View {
  const total = (view: View) => {
    const shown = new Set((geometry[view] as Region[]).flatMap((r) => regionMuscles(view, r.slug)));
    return [...shown].reduce((sum, m) => sum + (muscles[m] ?? 0), 0);
  };
  return total("back") > total("front") ? "back" : "front";
}

/**
 * The focus bounds `b` padded, MIN_HEIGHT to MAX_HEIGHT tall (taller only when
 * the top-scoring `lead` alone needs it), widened to `aspect` (width / height
 * of the frame), and kept inside the figure where it fits. A focus that does
 * not fit the height centres on `lead`.
 */
function crop(b: DOMRect, lead: DOMRect, full: Box, aspect: number): Box {
  const [fx, fy, fw, fh] = full;
  const padded = b.height * (1 + 2 * PAD);
  const h = Math.min(Math.max(padded, MIN_HEIGHT), Math.max(MAX_HEIGHT, lead.height * (1 + 2 * PAD)));
  const w = Math.max(b.width * (1 + 2 * PAD), h * aspect);
  const anchor = padded <= h ? b : lead;
  const cx = b.x + b.width / 2;
  const cy = anchor.y + anchor.height / 2;
  const x = w >= fw ? fx + fw / 2 - w / 2 : Math.min(Math.max(cx - w / 2, fx), fx + fw - w);
  const y = h >= fh ? fy + fh / 2 - h / 2 : Math.min(Math.max(cy - h / 2, fy), fy + fh - h);
  return [x, y, w, h];
}
