/**
 * Ziua de lucru: drumul și încărcarea.
 *
 * Trei lucrări într-o zi, împrăștiate prin oraș, sunt trei adrese și o
 * întrebare — în ce ordine? Calendarul le arată pe ore, dar nimeni nu le vede
 * ca pe un drum. Și nimic nu spune că ai promis două lucrări în aceeași
 * dimineață sau că ți-ai pus paisprezece ore într-o zi.
 */
import type { Job } from "./types";

/** Peste atâtea ore într-o zi, promisiunea e făcută pe datorie. */
export const LONG_DAY_HOURS = 10;

/** Minutele de la miezul nopții, dintr-un „HH:mm”. */
function minutesOf(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export interface DayOverlap {
  a: Job;
  b: Job;
}

export interface DayLoad {
  jobs: Job[];
  /** Orele estimate, adunate. Lucrările fără estimare nu adaugă nimic. */
  hours: number;
  /** Ziua e prea plină? */
  long: boolean;
  /** Perechile care se calcă una pe alta. */
  overlaps: DayOverlap[];
  /** Adresele, în ordinea orei. */
  stops: { job: Job; address: string }[];
}

/**
 * Ce se întâmplă într-o zi.
 *
 * Suprapunerea se judecă doar între lucrările cu oră pusă: două lucrări fără
 * oră sunt „cândva azi", iar asta nu e un conflict, e o zi normală.
 */
export function dayLoad(jobs: Job[]): DayLoad {
  const live = jobs.filter((job) => !job.deleted_at && job.status !== "done");
  const sorted = [...live].sort((a, b) =>
    (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"),
  );

  const hours = sorted.reduce((acc, job) => acc + (Number(job.estimated_hours) || 0), 0);

  const overlaps: DayOverlap[] = [];
  const timed = sorted.filter((job) => minutesOf(job.scheduled_time) !== null);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const startA = minutesOf(timed[i].scheduled_time)!;
      const startB = minutesOf(timed[j].scheduled_time)!;
      // Fără durată, lucrarea e un punct pe ceas: se ciocnește doar cu una
      // care începe fix atunci.
      const endA = startA + (Number(timed[i].estimated_hours) || 0) * 60;
      const endB = startB + (Number(timed[j].estimated_hours) || 0) * 60;
      if (startA < endB && startB < endA) overlaps.push({ a: timed[i], b: timed[j] });
      else if (startA === startB) overlaps.push({ a: timed[i], b: timed[j] });
    }
  }

  const stops = sorted
    .filter((job) => (job.address ?? "").trim())
    .map((job) => ({ job, address: (job.address ?? "").trim() }));

  return { jobs: sorted, hours, long: hours > LONG_DAY_HOURS, overlaps, stops };
}

/**
 * Linkul care deschide tot drumul într-o hartă.
 *
 * Prima adresă e plecarea, ultima e sosirea, restul sunt opriri pe drum.
 * Pentru o singură adresă n-are rost o rută — e o căutare.
 */
export function routeHref(addresses: string[]): string | null {
  const stops = addresses.map((value) => value.trim()).filter(Boolean);
  if (!stops.length) return null;

  const encode = encodeURIComponent;
  if (stops.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encode(stops[0])}`;
  }

  const origin = encode(stops[0]);
  const destination = encode(stops[stops.length - 1]);
  const middle = stops.slice(1, -1).map(encode).join("|");
  const waypoints = middle ? `&waypoints=${middle}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}`;
}
