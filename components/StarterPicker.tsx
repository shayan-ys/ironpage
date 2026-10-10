"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Unit } from "@/lib/types";
import { STARTER_PROGRAMS, type StarterProgram } from "@/lib/starter-programs";
import { hapticRef } from "@/lib/haptics";

/**
 * First run: no program is stored, so the overview offers the starter
 * programs. Choosing one builds it in the picked unit, stores it with
 * `PUT /api/program`, and refreshes into the normal overview.
 */
export function StarterPicker() {
  const router = useRouter();
  const [unit, setUnit] = useState<Unit>("lb");
  const [saving, setSaving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function choose(starter: StarterProgram) {
    if (saving) return;
    setSaving(starter.id);
    setFailed(false);
    try {
      const res = await fetch("/api/program", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(starter.build(unit)),
      });
      if (!res.ok) throw new Error(`PUT /api/program ${res.status}`);
      router.refresh();
    } catch {
      setSaving(null);
      setFailed(true);
    }
  }

  return (
    <>
      <div className="kicker">Welcome</div>
      <h1 className="title">Pick a program</h1>
      <p className="subtle">
        Choose a starting plan. Loads are first guesses: adjust them as you log, and the app
        carries your real weights forward from then on.
      </p>

      <div className="unitswitch" role="group" aria-label="Weight unit">
        {(["lb", "kg"] as const).map((u) => (
          <button
            key={u}
            type="button"
            className={unit === u ? "on" : undefined}
            aria-pressed={unit === u}
            ref={hapticRef}
            data-haptic="light"
            onClick={() => setUnit(u)}
          >
            {u}
          </button>
        ))}
      </div>

      <div className="daygrid">
        {STARTER_PROGRAMS.map((starter) => {
          const days = starter.build(unit).days;
          return (
            <section key={starter.id} className="daycard startercard">
              <div className="top">
                <h2>{starter.name}</h2>
                <span className="count">
                  {starter.daysPerWeek} days / week · {starter.level}
                </span>
              </div>
              <p className="startersum">{starter.summary}</p>
              <div className="exlist">
                {days.map((day) => (
                  <span key={day.id} className="ex">
                    {day.name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="save starteruse"
                ref={hapticRef}
                data-haptic="medium"
                disabled={saving !== null}
                onClick={() => choose(starter)}
              >
                {saving === starter.id ? "Saving…" : "Use this program"}
              </button>
            </section>
          );
        })}
      </div>
      {failed && <p className="cardwarn">Could not save the program. Check the connection and try again.</p>}

      <p className="subtle starterown">
        Have your own program?{" "}
        <Link href="/settings" ref={hapticRef} data-haptic="medium">
          Paste JSON in Settings
        </Link>
      </p>
    </>
  );
}
