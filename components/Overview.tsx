import type { OverviewData } from "@/lib/page-data";
import type { Program, Session } from "@/lib/types";
import { DayCard } from "@/components/DayCard";
import { RecoveryLink } from "@/components/RecoveryLink";
import { SettingsLink } from "@/components/SettingsLink";
import { ResumeBanner } from "@/components/ResumeBanner";
import { StarterPicker } from "@/components/StarterPicker";

/**
 * The overview screen, shared by the server page (`app/page.tsx`) and the
 * demo's (`app/page.demo.tsx`). With no stored program it is the first-run
 * starter picker.
 */
export function Overview({
  program,
  active,
  lastByDay,
  doses,
}: OverviewData & { program: Program | null; active: Session | null }) {
  if (!program) {
    return (
      <main className="wrap">
        <StarterPicker />
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="headactions">
        <RecoveryLink from="/" />
        <SettingsLink />
      </div>
      <div className="kicker">Workout</div>
      <h1 className="title">Pick today’s day</h1>
      <p className="subtle">
        Tap a day to start. Pause any time and pick it up tomorrow — I keep your place.
      </p>

      {active && <ResumeBanner active={active} />}

      <div className="daygrid">
        {program.days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            lastPerformed={lastByDay[day.id] ?? null}
            active={active}
            doses={doses}
          />
        ))}
      </div>
    </main>
  );
}
