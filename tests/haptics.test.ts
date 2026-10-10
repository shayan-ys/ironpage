import { afterEach, describe, expect, it, vi } from "vitest";
import { haptic, hapticOnMs, hapticRef, hapticZoneRef, levelHaptic, rpeHaptic } from "../lib/haptics";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { get: () => ua, configurable: true });
}

function button(kind?: string) {
  const el = document.createElement("button");
  if (kind) el.dataset.haptic = kind;
  document.body.append(el);
  return el;
}

/** Every `haptic()` fire, by kind. */
function recordHaptics(): string[] {
  const fired: string[] = [];
  window.addEventListener("haptic", (event) => fired.push((event as CustomEvent<string>).detail));
  return fired;
}

/** The tap an iPhone delivers: it lands on the overlay label, not the host. */
function tapOverlay(el: HTMLElement) {
  el.querySelector<HTMLElement>(":scope > [data-haptic-trigger]")!.click();
}

afterEach(() => {
  document.body.innerHTML = "";
  setUserAgent(ANDROID);
  vi.restoreAllMocks();
});

describe("hapticRef on iOS", () => {
  it("runs the host's click handler exactly once per tap, with the tagged kind", () => {
    setUserAgent(IPHONE);
    const fired = recordHaptics();
    const el = button("medium");
    const onClick = vi.fn();
    el.addEventListener("click", onClick);

    hapticRef(el);
    tapOverlay(el);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0].target).toBe(el);
    expect(fired).toEqual(["medium"]);
  });

  // The ref is re-run on re-mounts; a second overlay would be dead weight
  // over the first and its listener a second action per tap.
  it("stays one overlay and one action however often the ref runs", () => {
    setUserAgent(IPHONE);
    const fired = recordHaptics();
    const el = button();
    const onClick = vi.fn();
    el.addEventListener("click", onClick);

    hapticRef(el);
    hapticRef(el);
    hapticRef(el);
    tapOverlay(el);

    expect(el.querySelectorAll("[data-haptic-trigger]").length).toBe(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(fired).toEqual(["light"]);
  });

  it("keeps a disabled control silent and inert", () => {
    setUserAgent(IPHONE);
    const fired = recordHaptics();
    const el = button("heavy");
    const onClick = vi.fn();
    el.addEventListener("click", onClick);
    el.disabled = true;

    hapticRef(el);
    tapOverlay(el);

    expect(onClick).not.toHaveBeenCalled();
    expect(fired).toEqual([]);
  });

  it("does not move an already-positioned host", () => {
    setUserAgent(IPHONE);
    const el = button();
    el.style.position = "absolute";

    hapticRef(el);

    expect(el.style.position).toBe("absolute");
  });

  // React re-renders `<button>{complete ? "Finish" : "End"}</button>` by
  // assigning textContent, which wipes the overlay without re-running the ref.
  it("keeps buzzing after the host's text is rewritten", async () => {
    setUserAgent(IPHONE);
    const fired = recordHaptics();
    const el = button("medium");
    el.textContent = "End workout";

    hapticRef(el);
    el.textContent = "Finish workout";
    await Promise.resolve();
    tapOverlay(el);

    expect(el.textContent).toBe("Finish workout");
    expect(fired).toEqual(["medium"]);
  });
});

describe("hapticRef off iOS", () => {
  it("vibrates the tagged kind's pattern on click, light when untagged", () => {
    setUserAgent(ANDROID);
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    const heavy = button("heavy");
    const plain = button();

    hapticRef(heavy);
    hapticRef(plain);
    heavy.click();
    plain.click();

    expect(vibrate.mock.calls).toEqual([[40], [14]]);
    expect(heavy.querySelector("[data-haptic-trigger]")).toBeNull();
  });
});

describe("hapticZoneRef on iOS", () => {
  /** A zone with one target under the finger, as `elementFromPoint` reports it. */
  function zoneOver(onTargetClick: (event: MouseEvent) => void) {
    setUserAgent(IPHONE);
    const zone = document.createElement("div");
    const target = document.createElement("span");
    zone.append(target);
    document.body.append(zone);
    target.addEventListener("click", onTargetClick);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(target);
    hapticZoneRef(zone);
    const label = zone.querySelector<HTMLElement>(":scope > [data-haptic-trigger]")!;
    const tap = new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
    label.dispatchEvent(tap);
    return tap;
  }

  it("hands the tap to what is under the finger and ticks when it buzzed", () => {
    const seen: { x: number; y: number }[] = [];
    const tap = zoneOver((event) => {
      seen.push({ x: event.clientX, y: event.clientY });
      haptic("grade3");
    });

    expect(seen).toEqual([{ x: 40, y: 60 }]);
    expect(tap.defaultPrevented).toBe(false);
  });

  // Cancelling the label's click stops its forward to the switch: no tick for
  // a tap the page did not answer, such as one beside the body with nothing picked.
  it("withholds the tick when the tapped target's handlers stayed silent", () => {
    const tap = zoneOver(() => {});

    expect(tap.defaultPrevented).toBe(true);
  });
});

describe("graded haptics", () => {
  it("buzzes longer at every step up the RPE scale", () => {
    const on = [6, 7, 8, 9, 10].map((rpe) => hapticOnMs(rpeHaptic(rpe)));
    for (let i = 1; i < on.length; i++) expect(on[i]).toBeGreaterThan(on[i - 1]);
  });

  it("rounds and clamps ratings to the 6–10 scale", () => {
    expect(rpeHaptic(7.6)).toBe(rpeHaptic(8));
    expect(rpeHaptic(4)).toBe(rpeHaptic(6));
    expect(rpeHaptic(11)).toBe(rpeHaptic(10));
  });

  it("buzzes hotter muscles harder, uncoloured ones with the plain tick", () => {
    expect(levelHaptic(0)).toBe("selection");
    const on = [1, 2, 3, 4, 5].map((level) => hapticOnMs(levelHaptic(level)));
    for (let i = 1; i < on.length; i++) expect(on[i]).toBeGreaterThan(on[i - 1]);
  });
});
