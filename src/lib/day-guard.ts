/**
 * Ce se lovește de ce, când miști ziua unei lucrări.
 *
 * Blocai vineri pentru o nuntă, iar cele două lucrări programate acolo
 * rămâneau acolo, tăcute. Mutai o lucrare pe o zi deja blocată și aplicația
 * spunea „Mutată pe...”, atât.
 *
 * Nimic de aici nu oprește nimic: sunt avertismente. Omul știe lucruri pe
 * care aplicația nu le știe — poate chiar lucrează în ziua aia.
 */

import { hoursOnDay, runsOn } from "./span";
import type { DayBlock, Job } from "./types";

/** Cât se lucrează într-o zi obișnuită; peste asta, ziua e plină. */
export const FULL_DAY_HOURS = 8;

export interface DayCheck {
  /** Ziua e blocată, și de ce. */
  blocked: boolean;
  blockReason: string | null;
  /** Lucrările care ating deja ziua asta. */
  jobs: Job[];
  /** Orele deja programate în ziua asta. */
  hours: number;
  /** Cu lucrarea care vine, ziua trece de o zi de lucru. */
  full: boolean;
}

/** Lucrările vii care ating ziua. */
function jobsOn(jobs: Job[], day: string, exceptId?: string | null): Job[] {
  return jobs.filter(
    (job) =>
      job.id !== exceptId &&
      !job.deleted_at &&
      !job.archived_at &&
      job.status !== "done" &&
      job.status !== "on_hold" &&
      runsOn(job, day),
  );
}

/**
 * Cum stă ziua înainte să pui ceva pe ea.
 *
 * `incoming` e lucrarea care urmează să ajungă acolo; orele ei se adaugă la
 * socoteală, dar lucrarea însăși nu se numără de două ori dacă e deja acolo.
 */
export function checkDay(
  day: string,
  jobs: Job[],
  blocks: DayBlock[],
  incoming?: Job | null,
): DayCheck {
  const block = blocks.find((row) => !row.deleted_at && row.day === day) ?? null;
  const onDay = jobsOn(jobs, day, incoming?.id);

  // O lucrare de trei zile aduce în ziua asta doar partea ei de ore.
  const existing = onDay.reduce((acc, job) => acc + hoursOnDay(job, day), 0);
  const adding = incoming ? hoursOnDay({ ...incoming, scheduled_date: day, scheduled_end_date: incoming.scheduled_end_date }, day) : 0;

  return {
    blocked: !!block,
    blockReason: block?.reason ?? null,
    jobs: onDay,
    hours: Math.round(existing * 100) / 100,
    full: existing + adding > FULL_DAY_HOURS,
  };
}

/**
 * Lucrările care cad peste o zi pe care vrei s-o blochezi.
 *
 * Blocarea nu le mută singură — mutarea e o hotărâre, nu o consecință.
 */
export function jobsBlockedBy(day: string, jobs: Job[]): Job[] {
  return jobsOn(jobs, day);
}
