/**
 * Browser-only haptic feedback. Two platforms, two mechanisms, one vocabulary:
 *
 * - Android (and any browser with the Vibration API): `haptic(kind)` plays a
 *   vibration pattern. Strength is not a parameter of the API, so "stronger"
 *   means longer pulses and more of them.
 * - iPhone: Safari never shipped the Vibration API. Its only web haptic is the
 *   fixed system tick a native `<input type="checkbox" switch>` plays when a
 *   real tap toggles it. Since iOS 26.5 the toggle must come from a trusted
 *   event (WebKit 313638@main), so script cannot play it, repeat it or vary it:
 *   every kind below is the same single tick on an iPhone, and a gesture that
 *   is not a tap (a pinch, a drag) cannot tick at all.
 *
 * Both refs below get that tick from a transparent `<label>` laid over the
 * element, wired to a hidden switch. A tap lands on the label; WebKit forwards
 * it to the switch as a trusted click, and the switch ticks. The switch itself
 * is never under the finger: a touch that starts on a switch is the switch's
 * gesture and cannot scroll the page (and a drag from it toggles it, WebKit
 * bug 321591). A label has no touch handling, so a scroll that starts on it
 * scrolls, and only a real tap produces a click.
 *
 * The label is the click's target, and its default action (forwarding to the
 * switch) replaces whatever lies under it: an `<a>` would not navigate, and a
 * handler calling `preventDefault` (Next's `<Link>` does) would cancel the
 * tick. So the label stops the tap's click and clicks what it covers itself.
 *
 * - `hapticRef`, for a button or link: re-clicks the host and always ticks.
 *   The kind comes from `data-haptic`; untagged elements play "light".
 * - `hapticZoneRef`, for a surface with many targets (the muscle map):
 *   re-clicks whatever is under the finger and ticks only when that click's
 *   handlers called `haptic()`. The handlers choose the kind and whether the
 *   tap deserved feedback at all.
 *
 * Each `haptic()` fire also dispatches a `window` "haptic" CustomEvent
 * (detail = kind), so the wiring is observable without a device.
 */

const GRADES = ["grade1", "grade2", "grade3", "grade4", "grade5"] as const;
type Grade = (typeof GRADES)[number];

export type HapticKind =
  /** Opening a picker, a sheet or a disclosure; choosing among options. */
  | "selection"
  /** Small edits: add or remove a row, add a note, skip the rest. */
  | "light"
  /** Commitments: page navigation, start, pause, end. */
  | "medium"
  /** Destructive confirmations. */
  | "heavy"
  /** Closing something out that keeps the data. */
  | "warning"
  /** A finished workout. */
  | "success"
  /** A five-step intensity scale: `rpeHaptic`, `levelHaptic`. */
  | Grade;

// Vibration pattern per kind (ms, vibrate/pause alternating).
const PATTERN: Record<HapticKind, number | number[]> = {
  selection: 8,
  light: 14,
  medium: 24,
  heavy: 40,
  warning: [30, 60, 30],
  success: [45, 55, 45, 55, 90],
  // Longer at each step, then extra pulses at the top of the scale.
  grade1: 10,
  grade2: 18,
  grade3: 28,
  grade4: [32, 45, 32],
  grade5: [40, 40, 40, 40, 70],
};

/** The haptic for an RPE rating, rounded and clamped to the 6–10 scale. */
export function rpeHaptic(rating: number): HapticKind {
  return GRADES[Math.min(10, Math.max(6, Math.round(rating))) - 6];
}

/**
 * The haptic for a heat level on the muscle map (0 uncoloured, 1–5): hotter
 * buzzes harder, and an uncoloured muscle gets the plain selection tick.
 */
export function levelHaptic(level: number): HapticKind {
  return level < 1 ? "selection" : GRADES[Math.min(5, Math.round(level)) - 1];
}

/** Total vibration time of a kind's pattern, in ms (pauses excluded). */
export function hapticOnMs(kind: HapticKind): number {
  const pattern = PATTERN[kind];
  if (typeof pattern === "number") return pattern;
  return pattern.reduce((sum, ms, i) => (i % 2 === 0 ? sum + ms : sum), 0);
}

export function haptic(kind: HapticKind = "light"): void {
  if (typeof window === "undefined") return;
  // Observable hook: proves the trigger ran for this action, device or not.
  window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
  try {
    navigator.vibrate?.(PATTERN[kind]);
  } catch {
    // best-effort — never let a missing capability break the UI
  }
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function kindOf(el: HTMLElement): HapticKind {
  const kind = el.dataset.haptic;
  return kind && kind in PATTERN ? (kind as HapticKind) : "light";
}

const bound = new WeakSet<HTMLElement>();

/**
 * Lay the tick label over `el` and hand each tap's click to `onTap`, which
 * stops at the label; `onTap` cancels the event to withhold the tick.
 */
function attachTickLabel(el: HTMLElement, onTap: (event: MouseEvent, label: HTMLLabelElement) => void): void {
  const label = document.createElement("label");
  label.setAttribute("data-haptic-trigger", "");
  label.setAttribute("aria-hidden", "true");
  Object.assign(label.style, { position: "absolute", inset: "0" });
  label.style.setProperty("-webkit-tap-highlight-color", "transparent");

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.setAttribute("switch", "");
  // Hidden: never hit-tested, never focused (a focusable switch would take
  // focus on every tap and close the keyboard), out of the accessibility tree.
  Object.assign(toggle.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "0",
    visibility: "hidden",
  });
  // The forwarded click is the label's business, not the page's.
  toggle.addEventListener("click", (event) => event.stopPropagation());

  label.addEventListener("click", (event) => {
    event.stopPropagation();
    onTap(event, label);
  });

  label.append(toggle);
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.append(label);
  // React updates a host whose only child is a string by assigning
  // `textContent` ("End workout" → "Finish workout"), which drops the label.
  // The ref does not run again for that, so put the label back here.
  new MutationObserver(() => {
    if (label.parentNode !== el) el.append(label);
  }).observe(el, { childList: true });
}

/**
 * Ref callback: a haptic on every tap of a button or link.
 *
 *     <button ref={hapticRef} data-haptic="medium" onClick={…}>Pause</button>
 *
 * Idempotent, so React re-running the ref never stacks overlays or listeners.
 */
export function hapticRef(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined" || bound.has(el)) return;
  bound.add(el);

  if (!isIos()) {
    // A disabled button fires no click, so it never buzzes.
    el.addEventListener("click", () => haptic(kindOf(el)));
    return;
  }

  attachTickLabel(el, (event) => {
    // A click can reach the label inside a disabled button. Cancelling it stops
    // the forward, so a disabled control stays silent.
    if (el.matches(":disabled")) {
      event.preventDefault();
      return;
    }
    haptic(kindOf(el));
    el.click();
  });
}

/**
 * Ref callback: iPhone ticks for a surface whose own click handlers call
 * `haptic()`. Elsewhere it attaches nothing, since those calls already vibrate.
 * The label sits above the surface's content; give any control that must stay
 * on top of it a z-index.
 */
export function hapticZoneRef(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined" || bound.has(el) || !isIos()) return;
  bound.add(el);

  attachTickLabel(el, (event, label) => {
    label.style.pointerEvents = "none";
    const under = document.elementFromPoint(event.clientX, event.clientY);
    label.style.pointerEvents = "";
    let fired = false;
    const heard = () => {
      fired = true;
    };
    window.addEventListener("haptic", heard);
    under?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: event.clientX,
        clientY: event.clientY,
        view: window,
      }),
    );
    window.removeEventListener("haptic", heard);
    if (!fired) event.preventDefault();
  });
}
