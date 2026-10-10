export const SWITCH_MOVE_TOLERANCE_PX = 10;

export type SwitchGesture = {
  maxDistance: number;
  cancelled: boolean;
};

/** A change without a recorded pointer/touch is a regular click or keyboard action. */
export function shouldAcceptSwitchChange(gesture: SwitchGesture | null): boolean {
  return gesture === null || (!gesture.cancelled && gesture.maxDistance <= SWITCH_MOVE_TOLERANCE_PX);
}
