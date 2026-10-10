import geometry from "@/lib/muscle-map-geometry.json";
import { PinchZoom } from "./PinchZoom";
import styles from "./MuscleSummary.module.css";
import type { MuscleId } from "@/lib/types";
import { haptic, levelHaptic } from "@/lib/haptics";

/** Five fixed heat steps (see `impactLevel`), cool → hot. */
const HEAT = ["var(--cool)", "var(--accent)", "var(--warm)", "var(--hot)", "var(--max)"];

export type View = "front" | "back";
type Region = { slug: string; paths: string[] };
export type MuscleLevels = Partial<Record<MuscleId, number>>;

/**
 * Front and back body map coloured by heat level per muscle (0 or absent is
 * uncoloured). `onSelect` makes regions tappable and receives the region's
 * muscles; a tap on a region does not bubble, so a parent's click handler
 * sees only taps beside the body. `selected` outlines those muscles' regions.
 * `zoomable` adds pinch zoom and makes the figures larger. `legend` names the
 * cool and hot ends of the scale.
 */
export default function MuscleMap({
  levels,
  label,
  legend = ["Less", "More"],
  onSelect,
  selected = [],
  zoomable = false,
}: {
  levels: MuscleLevels;
  label: string;
  legend?: [string, string];
  onSelect?: (muscles: MuscleId[]) => void;
  selected?: MuscleId[];
  zoomable?: boolean;
}) {
  const figures = (
    <div className={styles.figures}>
      {(["front", "back"] as const).map((view) => (
        <figure className={styles.figure} key={view}>
          <svg viewBox={geometry.viewBoxes[view].join(" ")} role="img" aria-label={`${view} ${label}`}>
            {(geometry[view] as Region[]).flatMap((region) => {
              // A region fed by several groups takes the highest level, not the sum.
              const targets = regionMuscles(view, region.slug);
              const level = Math.max(0, ...targets.map((m) => levels[m] ?? 0));
              const fill = level > 0 ? HEAT[level - 1] : "var(--panel2)";
              const picked = targets.some((m) => selected.includes(m));
              const select = onSelect && targets.length > 0 ? onSelect : undefined;
              return region.paths.map((d, i) => (
                <path
                  key={`${region.slug}-${i}`}
                  d={d}
                  fill={fill}
                  stroke={picked ? "var(--ink)" : level > 0 ? "var(--bg)" : "var(--line)"}
                  strokeWidth={picked ? 5 : level > 0 ? 1.5 : 1}
                  strokeLinejoin="round"
                  onClick={
                    select &&
                    ((e) => {
                      e.stopPropagation();
                      // Hotter (more tired) muscles buzz harder on Android.
                      haptic(levelHaptic(level));
                      select(targets);
                    })
                  }
                  style={select ? { cursor: "pointer" } : undefined}
                />
              ));
            })}
          </svg>
          <figcaption>{view}</figcaption>
        </figure>
      ))}
    </div>
  );
  return (
    <div className={`${styles.map}${zoomable ? ` ${styles.large}` : ""}`}>
      {zoomable ? <PinchZoom>{figures}</PinchZoom> : figures}
      <div className={styles.legend} aria-hidden="true">
        <span>{legend[0]}</span>
        {HEAT.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
        <span>{legend[1]}</span>
      </div>
    </div>
  );
}

/**
 * MuscleMap's male regions mapped to the 18 groups (spec: front delts →
 * frontDeltoid, side delts → front deltoids, rear + side delts → back deltoids,
 * lats + upper back → upperBack). Unlisted regions (head, hands, knees …) are
 * inert silhouette.
 */
export function regionMuscles(view: View, slug: string): MuscleId[] {
  if (view === "front") {
    switch (slug) {
      case "chest":
      case "upperChest":
      case "lowerChest":
        return ["chest"];
      case "frontDeltoid":
        return ["front-delts"];
      case "deltoids":
        return ["side-delts"];
      case "biceps":
        return ["biceps"];
      case "triceps":
        return ["triceps"];
      case "forearm":
        return ["forearms"];
      case "abs":
      case "upperAbs":
      case "lowerAbs":
        return ["abs"];
      case "obliques":
        return ["obliques"];
      case "quadriceps":
      case "innerQuad":
      case "outerQuad":
        return ["quads"];
      case "calves":
        return ["calves"];
      case "tibialis":
        return ["tibialis"];
      case "trapezius":
        return ["traps"];
      default:
        return [];
    }
  }
  switch (slug) {
    case "trapezius":
      return ["traps"];
    case "deltoids":
      return ["side-delts", "rear-delts"];
    case "rearDeltoid":
      return ["rear-delts"];
    case "upperBack":
      return ["lats", "upper-back"];
    case "triceps":
      return ["triceps"];
    case "lowerBack":
      return ["lower-back"];
    case "forearm":
      return ["forearms"];
    case "gluteal":
      return ["glutes"];
    case "hamstring":
      return ["hamstrings"];
    case "calves":
      return ["calves"];
    default:
      return [];
  }
}
