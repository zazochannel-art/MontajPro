/**
 * Aclimatizarea materialului.
 *
 * Parchetul adus de la depozit e altfel decât camera în care intră: altă
 * umiditate, altă temperatură. Montat imediat, lucrează în podea luni de zile
 * și se umflă — cea mai scumpă reclamație din meserie, și aproape mereu de la
 * asta vine.
 *
 * Lista de bifat avea de mult „verificat umiditatea șapei”. Asta e cealaltă
 * jumătate: nu o bifă, ci un ceas care spune de când se poate.
 */
import type { Job } from "./types";

export interface Acclimatization {
  /** Când s-a adus materialul. */
  startedAt: Date;
  /** De când se poate monta. */
  readyAt: Date;
  /** Câte ore mai sunt. 0 când e gata. */
  hoursLeft: number;
  ready: boolean;
}

/** Cât stă materialul, când nimeni n-a schimbat nimic în setări. */
export const DEFAULT_HOURS = 48;

export function acclimatizationFor(
  job: Pick<Job, "material_delivered_at">,
  hours: number = DEFAULT_HOURS,
  now: Date = new Date(),
): Acclimatization | null {
  if (!job.material_delivered_at) return null;

  const startedAt = new Date(job.material_delivered_at);
  if (Number.isNaN(startedAt.getTime())) return null;

  // Ore negative ar face „gata” să fie în trecut; zero înseamnă „fără așteptare”.
  const wait = Math.max(0, hours);
  const readyAt = new Date(startedAt.getTime() + wait * 3_600_000);
  const msLeft = readyAt.getTime() - now.getTime();

  return {
    startedAt,
    readyAt,
    hoursLeft: msLeft <= 0 ? 0 : Math.ceil(msLeft / 3_600_000),
    ready: msLeft <= 0,
  };
}

/**
 * Lucrările care așteaptă materialul să se aclimatizeze.
 *
 * Doar cele nefinalizate: pe una gata predată, ceasul nu mai interesează pe
 * nimeni.
 */
export function waitingJobs(
  jobs: Job[],
  hours: number = DEFAULT_HOURS,
  now: Date = new Date(),
): { job: Job; state: Acclimatization }[] {
  const out: { job: Job; state: Acclimatization }[] = [];
  for (const job of jobs) {
    if (job.deleted_at || job.status === "done") continue;
    const state = acclimatizationFor(job, hours, now);
    if (state && !state.ready) out.push({ job, state });
  }
  return out.sort(
    (a, b) => a.state.readyAt.getTime() - b.state.readyAt.getTime(),
  );
}
