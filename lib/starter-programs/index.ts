import type { Program, Unit } from "../types";
import { fullBody } from "./full-body";
import { upperLower } from "./upper-lower";
import { pushPullLegs } from "./push-pull-legs";
import { strength5x5 } from "./strength-5x5";

/**
 * A program a new install can start from. The first-run picker on the overview
 * builds one in the chosen unit and stores it with `PUT /api/program`; from
 * then on it is an ordinary stored program and these files no longer affect it.
 *
 * Starters leave `targets` off: a target ladder is dated, and fixed dates in a
 * shipped file would already be in the past for anyone who picks it later.
 * Progression is the `then` sentence instead.
 */
export interface StarterProgram {
  id: string;
  name: string;
  summary: string;
  daysPerWeek: number;
  level: "beginner" | "intermediate";
  build(unit: Unit): Program;
}

export const STARTER_PROGRAMS: StarterProgram[] = [fullBody, strength5x5, upperLower, pushPullLegs];
