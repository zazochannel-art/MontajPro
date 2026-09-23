/**
 * Cu cât întârzii de fapt.
 *
 * Ora promisă clientului stă în `scheduled_time`, ora la care ai ajuns în
 * `work_sessions.started_at`. Nimeni nu le punea una lângă alta, deși
 * amândouă erau acolo de la început.
 *
 * Cifra nu e o mustrare: dacă ajungi de obicei cu patruzeci de minute mai
 * târziu, atunci ora pe care o promiți e greșită, nu tu. Spune-i omului ora
 * la care chiar vii.
 */
import type { Job, WorkSession } from "./types";

export interface Lateness {
  /** Câte lucrări au și oră promisă, și oră de sosire. */
  jobs: number;
  /** Media întârzierii, în minute. Negativ înseamnă că ajungi mai devreme. */
  average: number;
  /** Cea mai mare întârziere, în minute. */
  worst: number;
  /** De câte ori ai ajuns la timp sau mai devreme. */
  onTime: number;
}

function minutesOf(time: string | null): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Ora locală de start a sesiunii, în minute de la miezul nopții. */
function startMinutes(session: WorkSession): number | null {
  const started = new Date(session.started_at);
  if (Number.isNaN(started.getTime())) return null;
  return started.getHours() * 60 + started.getMinutes();
}

/**
 * Cât întârzii, peste lucrările cu oră promisă.
 *
 * Se ia prima sesiune a zilei programate: a doua pornire e o reluare după
 * pauza de prânz, nu o sosire. O sesiune dintr-o altă zi decât cea promisă
 * nu spune nimic despre punctualitate — atunci nu ora a fost problema, ci
 * ziua.
 */
export function lateness(jobs: Job[], sessions: WorkSession[]): Lateness | null {
  const live = sessions.filter((session) => !session.deleted_at);
  const delays: number[] = [];

  for (const job of jobs) {
    if (job.deleted_at) continue;
    const promised = minutesOf(job.scheduled_time);
    if (promised === null || !job.scheduled_date) continue;

    const sameDay = live
      .filter(
        (session) =>
          session.job_id === job.id &&
          session.started_at.slice(0, 10) === job.scheduled_date,
      )
      .sort((a, b) => a.started_at.localeCompare(b.started_at));

    const first = sameDay[0];
    if (!first) continue;
    const arrived = startMinutes(first);
    if (arrived === null) continue;

    delays.push(arrived - promised);
  }

  if (!delays.length) return null;

  const total = delays.reduce((acc, value) => acc + value, 0);
  return {
    jobs: delays.length,
    average: Math.round(total / delays.length),
    worst: Math.max(...delays),
    onTime: delays.filter((value) => value <= 0).length,
  };
}
