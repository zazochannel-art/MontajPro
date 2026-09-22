/**
 * Cât ai liber săptămâna viitoare.
 *
 * Clientul întreabă „când puteți veni?”, iar răspunsul se dădea din memorie,
 * derulând calendarul. Acum orele estimate se și calculează singure din ritmul
 * tău, deci adunarea are pe ce sta.
 */
import { num } from "./utils";
import type { DayBlock, Job } from "./types";

export interface DayLoad {
  /** ISO date (YYYY-MM-DD). */
  day: string;
  jobs: number;
  hours: number;
  blocked: boolean;
  blockReason: string | null;
}

export interface WeekLoad {
  days: DayLoad[];
  /** Ore programate în toată săptămâna. */
  hours: number;
  /** Ore disponibile, după ce scazi zilele blocate. */
  available: number;
  /** Cât a mai rămas. Negativ înseamnă că ai promis mai mult decât ai. */
  free: number;
  /** Zilele fără nimic programat și neblocate. */
  freeDays: string[];
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Luni, ca început de săptămână — nu duminică. */
export function weekStart(from: Date): Date {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return date;
}

/**
 * Încărcarea unei săptămâni.
 *
 * `hoursPerDay` e cât lucrezi tu într-o zi obișnuită, iar `days` câte zile pe
 * săptămână — șase pentru cine lucrează și sâmbăta. Lucrarea fără durată
 * estimată se numără ca lucrare, dar aduce zero ore: mai bine o socoteală
 * incompletă decât una inventată.
 */
export function weekLoad(
  jobs: Job[],
  blocks: DayBlock[],
  from: Date,
  hoursPerDay = 8,
  workDays = 5,
): WeekLoad {
  const start = weekStart(from);
  const keys: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    keys.push(toKey(day));
  }

  const blockByDay = new Map<string, DayBlock>();
  for (const block of blocks) {
    if (block.deleted_at) continue;
    blockByDay.set(block.day, block);
  }

  const days: DayLoad[] = keys.map((day) => {
    const onDay = jobs.filter(
      (job) =>
        !job.deleted_at &&
        !job.archived_at &&
        job.status !== "done" &&
        job.scheduled_date === day,
    );
    const block = blockByDay.get(day);
    return {
      day,
      jobs: onDay.length,
      hours: onDay.reduce((acc, job) => acc + num(job.estimated_hours), 0),
      blocked: !!block,
      blockReason: block?.reason ?? null,
    };
  });

  const hours = days.reduce((acc, day) => acc + day.hours, 0);
  // Zilele lucrătoare din săptămână, minus cele blocate dintre ele.
  const blockedWorkDays = days
    .slice(0, workDays)
    .filter((day) => day.blocked).length;
  const available = Math.max(0, (workDays - blockedWorkDays) * hoursPerDay);

  return {
    days,
    hours: Math.round(hours * 100) / 100,
    available,
    free: Math.round((available - hours) * 100) / 100,
    freeDays: days
      .slice(0, workDays)
      .filter((day) => !day.blocked && day.jobs === 0)
      .map((day) => day.day),
  };
}
