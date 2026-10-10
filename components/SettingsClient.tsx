"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hapticRef } from "@/lib/haptics";
import { validateProgram } from "@/lib/program-validate";
import { programPrompt } from "@/lib/program-prompt";
import { REPO_URL, VIDEO_BRAVE_KEY } from "@/lib/site";
import { STARTER_PROGRAMS } from "@/lib/starter-programs";
import type { Program, Unit } from "@/lib/types";
import { ConfirmSheet } from "./ConfirmSheet";

/** Saves `data` as a JSON file through a temporary object URL. */
function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The settings page: replace the program (a starter or pasted JSON, both
 * checked by `validateProgram` and confirmed), download it, export every
 * workout, copy a prompt that has an AI write a program, the form-video app,
 * and the version. Writes go through `PUT /api/program` with the login cookie.
 */
export function SettingsClient({ program, version }: { program: Program | null; version: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"starter" | "paste" | null>(null);
  const [unit, setUnit] = useState<Unit>(program?.unit ?? "lb");
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<{ program: Program; label: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [brave, setBrave] = useState(false);

  useEffect(() => setBrave(localStorage.getItem(VIDEO_BRAVE_KEY) === "1"), []);

  function checkPaste() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      setErrors([`Not valid JSON: ${(e as Error).message}`]);
      return;
    }
    const result = validateProgram(parsed);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setPending({ program: result.program, label: "the pasted program" });
  }

  async function replace() {
    if (!pending) return;
    setStatus("Saving…");
    try {
      const res = await fetch("/api/program", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pending.program),
      });
      const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
      if (!res.ok) {
        setErrors(body.errors ?? [`The server refused the program (${res.status}).`]);
        setStatus(null);
        return;
      }
      setPending(null);
      setMode(null);
      setJson("");
      setStatus("Program replaced.");
      router.refresh();
    } catch {
      setStatus("Could not reach the server. The program was not changed.");
    } finally {
      setPending(null);
    }
  }

  async function exportAll() {
    setStatus("Exporting…");
    try {
      const res = await fetch("/api/export", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      downloadJson(await res.json(), `ironpage-export-${new Date().toISOString().slice(0, 10)}.json`);
      setStatus(null);
    } catch {
      setStatus("Export failed. Check the connection and try again.");
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(programPrompt(window.location.origin));
      setStatus("Prompt copied. Paste it into ChatGPT or Claude, then add your program.");
    } catch {
      setStatus("Could not copy to the clipboard.");
    }
  }

  function pickVideo(useBrave: boolean) {
    setBrave(useBrave);
    if (useBrave) localStorage.setItem(VIDEO_BRAVE_KEY, "1");
    else localStorage.removeItem(VIDEO_BRAVE_KEY);
  }

  // Exercises in the current program whose id the replacement drops: their
  // history stays in past sessions, but no new exercise carries it on.
  const keptIds = new Set(pending?.program.days.flatMap((d) => d.exercises.map((e) => e.id)));
  const droppedIds = new Set(
    program?.days.flatMap((d) => d.exercises.map((e) => e.id)).filter((id) => !keptIds.has(id)),
  );

  return (
    <main className="settings">
      <header className="shead">
        <Link className="back" href="/" ref={hapticRef} data-haptic="medium">
          ← back
        </Link>
        <div className="kicker">Settings</div>
        <h1>Settings</h1>
      </header>

      {status && (
        <p className="set-status" aria-live="polite">
          {status}
        </p>
      )}

      <section className="set-section">
        <h2>Program</h2>
        {program ? (
          <p className="subtle">
            {program.days.length} days in {program.unit}: {program.days.map((d) => d.name).join(", ")}
          </p>
        ) : (
          <p className="subtle">No program yet.</p>
        )}
        <div className="set-row">
          <button
            className="set-btn"
            ref={hapticRef}
            data-haptic="selection"
            onClick={() => setMode(mode === "starter" ? null : "starter")}
          >
            Pick a starter
          </button>
          <button
            className="set-btn"
            ref={hapticRef}
            data-haptic="selection"
            onClick={() => setMode(mode === "paste" ? null : "paste")}
          >
            Paste JSON
          </button>
        </div>

        {mode === "starter" && (
          <div className="set-panel">
            <div className="set-row" role="group" aria-label="Unit">
              {(["lb", "kg"] as const).map((u) => (
                <button
                  key={u}
                  className={`set-chip${unit === u ? " on" : ""}`}
                  aria-pressed={unit === u}
                  ref={hapticRef}
                  data-haptic="light"
                  onClick={() => setUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>
            {STARTER_PROGRAMS.map((s) => (
              <button
                key={s.id}
                className="set-starter"
                ref={hapticRef}
                data-haptic="selection"
                onClick={() => setPending({ program: s.build(unit), label: s.name })}
              >
                <b>{s.name}</b>
                <span>
                  {s.daysPerWeek} days a week · {s.level}
                </span>
                <span>{s.summary}</span>
              </button>
            ))}
          </div>
        )}

        {mode === "paste" && (
          <div className="set-panel">
            <textarea
              className="set-json"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder='{ "unit": "lb", "days": [ … ] }'
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={10}
              aria-label="Program JSON"
            />
            <button className="set-btn" ref={hapticRef} data-haptic="medium" onClick={checkPaste} disabled={!json.trim()}>
              Check and use
            </button>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="set-errors" aria-live="polite">
            {errors.slice(0, 50).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {errors.length > 50 && <li>…and {errors.length - 50} more</li>}
          </ul>
        )}

        <div className="set-row">
          {program && (
            <button
              className="set-btn"
              ref={hapticRef}
              data-haptic="light"
              onClick={() => downloadJson(program, "program.json")}
            >
              Download program JSON
            </button>
          )}
          <button className="set-btn" ref={hapticRef} data-haptic="light" onClick={copyPrompt}>
            Copy AI prompt
          </button>
        </div>
      </section>

      <section className="set-section">
        <h2>Data</h2>
        <p className="subtle">Every workout and the program, as one JSON file.</p>
        <button className="set-btn" ref={hapticRef} data-haptic="light" onClick={exportAll}>
          Export all data
        </button>
      </section>

      <section className="set-section">
        <h2>Form videos</h2>
        <p className="subtle">Where the form button opens its YouTube search, on this device.</p>
        <div className="set-row" role="group" aria-label="Form videos">
          <button
            className={`set-chip${brave ? "" : " on"}`}
            aria-pressed={!brave}
            ref={hapticRef}
            data-haptic="light"
            onClick={() => pickVideo(false)}
          >
            YouTube
          </button>
          <button
            className={`set-chip${brave ? " on" : ""}`}
            aria-pressed={brave}
            ref={hapticRef}
            data-haptic="light"
            onClick={() => pickVideo(true)}
          >
            Brave
          </button>
        </div>
      </section>

      <section className="set-section">
        <h2>About</h2>
        <p className="subtle">Ironpage {version}</p>
        <a className="set-link" href={REPO_URL} target="_blank" rel="noreferrer" ref={hapticRef} data-haptic="medium">
          Source code
        </a>
      </section>

      <ConfirmSheet
        open={pending !== null}
        title={`Replace with ${pending?.label ?? "this program"}?`}
        body={
          `Past workouts stay. ` +
          (droppedIds.size > 0
            ? `${droppedIds.size} current exercise${droppedIds.size === 1 ? " is" : "s are"} not in the new program; an exercise whose id changes starts with no history.`
            : "Exercises keep their history only where the id stays the same.")
        }
        confirmLabel="Replace program"
        onConfirm={replace}
        onClose={() => setPending(null)}
      />
    </main>
  );
}
