"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types";
import { isStale, lastActivityAt, msUntilAbandon } from "@/lib/defaults";
import { locallyFinished, readLocal, syncSession } from "@/lib/localsync";
import { useUpdateHold } from "@/components/UpdateCheck";
import { hapticRef } from "@/lib/haptics";
import { sessionHref } from "@/lib/page-data";

export function ResumeBanner({ active }: { active: Session }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useUpdateHold(busy);
  /**
   * What this banner describes: the server's copy until the device speaks up.
   *
   * `null` hides the banner entirely — the workout was finished here and the
   * write has not landed (or the whole page came from the service worker
   * cache). Offering to resume it is the offline face of the
   * came-back-as-Resume bug.
   *
   * Otherwise the device copy wins when it has one: a set ticked or a pause
   * taken with no signal is real activity the server render has never seen, and
   * every line below (paused-or-started, staleness, the countdown) should read
   * from it. Resolved after mount because it touches localStorage and the clock,
   * neither of which exists in the server render.
   */
  const [view, setView] = useState<Session | null>(active);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setView(locallyFinished(active.id) ? null : readLocal(active.id) ?? active);
  }, [active]);

  // Bound to a const so the narrowing survives into `discard` below.
  const session = view;
  if (!session) return null;

  const at = new Date(session.pausedAt ?? session.startedAt);
  const when = at.toLocaleDateString(undefined, { weekday: "short" });
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  // Measured from the last activity: a session started 25h ago but lifted in an
  // hour ago is still live, not "left unfinished".
  const stale = mounted && isStale(session);
  // Whole days, rounded up and floored at one, so the line never reads
  // "closes itself in 0 days" while the session is still resumable.
  const daysLeft = Math.max(1, Math.ceil(msUntilAbandon(session) / 86_400_000));

  const discard = async () => {
    if (busy) return;
    setBusy(true);
    // Close it out rather than delete: what you logged is kept, and the date is
    // the last activity so a session closed today is not credited to today.
    // syncSession (not a raw fetch): keepalive, ordered behind any in-flight
    // write for this session, and queued for retry when offline.
    await syncSession({
      ...session,
      finishedAt: lastActivityAt(session),
      sessionFeel: null,
      pausedAt: null,
    });
    router.refresh();
  };

  return (
    <div className="resume">
      <div className="txt">
        <div className="l">Resume {session.dayName}</div>
        <div className="s">
          {session.pausedAt ? "paused" : "started"} {when} {time}
          {stale ? ` · closes itself in ${daysLeft} day${daysLeft > 1 ? "s" : ""}` : ""}
        </div>
        {stale && (
          <button className="discard" ref={hapticRef} data-haptic="warning" onClick={discard} disabled={busy}>
            close it out — keeps what you logged
          </button>
        )}
      </div>
      <button className="go" ref={hapticRef} data-haptic="medium" onClick={() => router.push(sessionHref(session.id))}>
        Resume →
      </button>
    </div>
  );
}
