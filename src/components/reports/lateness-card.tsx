"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { lateness } from "@/lib/lateness";

/**
 * Cu cât întârzii de fapt.
 *
 * Ora promisă și ora la care ai ajuns erau amândouă în bază de la început;
 * nu le punea nimeni una lângă alta. Cifra nu e o mustrare: dacă ajungi de
 * obicei cu patruzeci de minute mai târziu, atunci ora pe care o promiți e
 * greșită, nu tu.
 */
export function LatenessCard({ from }: { from?: string }) {
  const jobs = useAllJobs();
  const sessions = useTable("work_sessions");

  const stats = useMemo(() => {
    const inRange = from
      ? jobs.filter((job) => (job.scheduled_date ?? "") >= from)
      : jobs;
    return lateness(inRange, sessions);
  }, [jobs, sessions, from]);

  if (!stats) return null;

  const late = stats.average > 0;
  const tone = stats.average > 15 ? "text-amber-300" : "text-emerald-300";

  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="size-4 text-primary" /> Ora promisă
      </h2>

      <div className="space-y-1.5 rounded-2xl surface p-4">
        <p className={`text-lg font-bold tabular-nums ${tone}`}>
          {stats.average === 0
            ? "fix la ora spusă"
            : late
              ? `cu ${stats.average} min mai târziu`
              : `cu ${Math.abs(stats.average)} min mai devreme`}
        </p>
        <p className="text-xs text-muted-foreground">
          În medie, peste {stats.jobs}{" "}
          {stats.jobs === 1 ? "lucrare cu oră promisă" : "lucrări cu oră promisă"}.
          Ai ajuns la timp de {stats.onTime}{" "}
          {stats.onTime === 1 ? "dată" : "ori"}
          {stats.worst > 0 && `, iar cel mai mult ai întârziat ${stats.worst} minute`}.
        </p>
        {stats.average > 15 && (
          <p className="text-xs text-muted-foreground">
            Poate nu tu întârzii, ci ora pe care o promiți e prea devreme.
          </p>
        )}
      </div>
    </section>
  );
}
