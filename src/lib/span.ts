/**
 * Lucrarea care ține mai multe zile.
 *
 * Până acum o lucrare avea o singură zi. O scară de trei zile punea toate
 * cele 24 de ore pe prima: săptămâna ieșea suprarezervată luni și liberă
 * marți-miercuri. Adică tocmai cifra „cât ai liber” mințea pentru fiecare
 * lucrare mai lungă de o zi — exact cele care contează.
 *
 * Orele se împart egal pe zilele lucrării. Nu fiindcă așa se lucrează, ci
 * fiindcă orice altă împărțire ar fi o presupunere: nimeni nu ține minte că
 * miercuri a fost mai ușor.
 */
import { num } from "./utils";
import type { Job } from "./types";

const DAY = 24 * 60 * 60 * 1000;

function parse(day: string | null): number | null {
  if (!day) return null;
  const value = Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(value) ? null : value;
}

function key(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Zilele pe care se întinde lucrarea, prima inclusiv.
 *
 * Fără dată de început nu e nimic de întins. O dată de sfârșit dinaintea
 * începutului e o greșeală de tastat, nu o lucrare în trecut: se ia ca zi
 * singură, ca socoteala să nu iasă negativă.
 */
export function jobDays(
  job: Pick<Job, "scheduled_date" | "scheduled_end_date">,
): string[] {
  const start = parse(job.scheduled_date);
  if (start === null) return [];

  const end = parse(job.scheduled_end_date);
  if (end === null || end <= start) return [key(start)];

  const days: string[] = [];
  // Plafon la 90 de zile: o dată tastată greșit („2036” în loc de „2026”)
  // n-are voie să umple memoria cu treizeci de mii de zile.
  for (let time = start; time <= end && days.length < 90; time += DAY) {
    days.push(key(time));
  }
  return days;
}

/** Câte zile ține lucrarea. */
export function jobDayCount(
  job: Pick<Job, "scheduled_date" | "scheduled_end_date">,
): number {
  return jobDays(job).length;
}

/** Orele care cad într-o anumită zi din lucrare. */
export function hoursOnDay(
  job: Pick<Job, "scheduled_date" | "scheduled_end_date" | "estimated_hours">,
  day: string,
): number {
  const days = jobDays(job);
  if (!days.includes(day)) return 0;
  const hours = num(job.estimated_hours);
  if (!hours) return 0;
  return Math.round((hours / days.length) * 100) / 100;
}

/** Lucrarea atinge ziua asta? */
export function runsOn(
  job: Pick<Job, "scheduled_date" | "scheduled_end_date">,
  day: string,
): boolean {
  return jobDays(job).includes(day);
}
