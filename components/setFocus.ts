/**
 * Where the page puts the set you are working: its row's centre sits at this
 * fraction of the screen height from the top. One value for every scroll the
 * app makes to a set — landing on a resumed session, the jump pill
 * (components/CurrentSetPill.tsx) and the superset hand-off — so the current
 * set always turns up in the same place.
 */
export const FOCUS_LINE = 0.4;

const SCROLL_FALLBACK_MS = 700;
const LATE_CLICK_MS = 600;

let stopGuard: (() => void) | null = null;

export function findSetRow(key: string): HTMLElement | null {
  for (const row of document.querySelectorAll<HTMLElement>("[data-setref]")) {
    if (row.dataset.setref === key) return row;
  }
  return null;
}

/** Bottom edge of the sticky progress bar: everything above it is covered. */
export function stickyBottom(): number {
  return document.querySelector<HTMLElement>(".progresswrap")?.getBoundingClientRect().bottom ?? 0;
}

export function pulse(row: HTMLElement): void {
  row.classList.remove("handoff-pulse");
  void row.offsetWidth;
  row.classList.add("handoff-pulse");
  window.setTimeout(() => row.classList.remove("handoff-pulse"), 750);
}

/** The window scroll offset that puts the row's centre on the focus line. */
export function focusScrollTop(row: HTMLElement): number {
  const box = row.getBoundingClientRect();
  return Math.max(0, window.scrollY + box.top + box.height / 2 - window.innerHeight * FOCUS_LINE);
}

/**
 * Smooth-scroll the row onto the focus line. While the page moves, a touch
 * stops it where it is and swallows the click that touch would make, so a tap
 * meant for a row that has since slid away does not tick the one under the
 * finger. The row pulses once the motion settles.
 */
export function glideToSet(row: HTMLElement): void {
  cancelGlide();
  window.scrollTo({ top: focusScrollTop(row), behavior: "smooth" });
  stopGuard = guardWhileMoving(row);
}

export function cancelGlide(): void {
  stopGuard?.();
  stopGuard = null;
}

function guardWhileMoving(row: HTMLElement): () => void {
  let moving = true;
  let downAt = Number.NEGATIVE_INFINITY;
  let removeClickTimer: number | undefined;
  const freeze = () => {
    if (!moving) return;
    downAt = performance.now();
    window.scrollTo({ top: window.scrollY, behavior: "instant" });
  };
  const onPointerDown = (event: Event) => {
    if ((event.target as HTMLElement | null)?.closest?.(".rest-capture")) return;
    freeze();
  };
  const onTouchStart = (event: Event) => {
    if ((event.target as HTMLElement | null)?.closest?.(".rest-capture")) return;
    freeze();
  };
  const swallowClick = (event: Event) => {
    if (performance.now() - downAt > LATE_CLICK_MS || downAt === Number.NEGATIVE_INFINITY) return;
    downAt = Number.NEGATIVE_INFINITY;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  let settleFallback = 0;
  const settle = () => {
    if (!moving) return;
    moving = false;
    clearTimeout(settleFallback);
    window.removeEventListener("scrollend", settle);
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("touchstart", onTouchStart, true);
    removeClickTimer = window.setTimeout(() => window.removeEventListener("click", swallowClick, true), 1500);
    pulse(row);
  };
  window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
  window.addEventListener("click", swallowClick, true);
  window.addEventListener("scrollend", settle);
  settleFallback = window.setTimeout(settle, SCROLL_FALLBACK_MS);
  return () => {
    moving = false;
    clearTimeout(settleFallback);
    clearTimeout(removeClickTimer);
    window.removeEventListener("scrollend", settle);
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("touchstart", onTouchStart, true);
    window.removeEventListener("click", swallowClick, true);
  };
}
