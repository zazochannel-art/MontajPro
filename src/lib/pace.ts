/**
 * Cât durează, din munca ta, nu din burtă.
 *
 * Orele estimate se scriau de mână la fiecare lucrare. Dar aplicația are deja
 * cronometrul și măsurătorile: din ele reiese câți metri pătrați de parchet
 * pui într-o oră. Nu dintr-un tabel de normare, ci din lucrările tale.
 *
 * Ritmul se ia ca mediană, nu ca medie: o singură zi în care ai stat blocat cu
 * o șapă strâmbă ar trage media în jos pentru totdeauna, iar mediana nu se
 * clatină de la un caz.
 */
import { num } from "./utils";
import type { JobMeasurement, JobType, Job, WorkSession } from "./types";
import type {
  ParquetMeasurement,
  PlinthMeasurement,
  StairsMeasurement,
} from "./types";

/** Unitatea în care se măsoară ritmul, pe fiecare tip de lucrare. */
export const PACE_UNITS: Record<JobType, string> = {
  stairs: "trepte",
  parquet: "m²",
  plinth: "m",
  other: "",
};

/**
 * Cât „mare” e o lucrare, într-o singură cifră comparabilă.
 *
 * Pentru scări numărăm treptele, pentru parchet metrii pătrați, pentru plinte
 * metrii liniari. La „altceva” nu există o unitate comună, deci nu se poate
 * învăța nimic — și spunem asta pe față, în loc să inventăm o cifră.
 */
export function measurementSize(
  kind: JobType,
  data: unknown,
): number {
  if (kind === "stairs") return num((data as StairsMeasurement)?.steps);
  if (kind === "parquet") return num((data as ParquetMeasurement)?.area);
  if (kind === "plinth") return num((data as PlinthMeasurement)?.linear_meters);
  return 0;
}

export interface Pace {
  /** Unități pe oră: m²/h, trepte/h, m/h. */
  perHour: number;
  /** Pe câte lucrări se bazează. Sub trei, cifra e mai mult o părere. */
  samples: number;
  unit: string;
}

/** Câte lucrări trebuie să fi făcut ca să merite să-ți propunem ceva. */
export const MIN_SAMPLES = 2;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Ritmul tău pe un tip de lucrare.
 *
 * Intră în socoteală doar lucrările care au și măsurătoare, și timp cronometrat
 * — restul n-au ce spune. Întoarce `null` când n-ai încă destule.
 */
export function paceFor(
  kind: JobType,
  jobs: Job[],
  measurements: JobMeasurement[],
  sessions: WorkSession[],
): Pace | null {
  const unit = PACE_UNITS[kind];
  if (!unit) return null;

  // Minutele lucrate, adunate pe lucrare.
  const minutesByJob = new Map<string, number>();
  for (const session of sessions) {
    if (session.deleted_at || !session.duration_minutes) continue;
    minutesByJob.set(
      session.job_id,
      (minutesByJob.get(session.job_id) ?? 0) + session.duration_minutes,
    );
  }

  // Mărimea lucrării, adunată din măsurătorile ei de același tip.
  const sizeByJob = new Map<string, number>();
  for (const row of measurements) {
    if (row.deleted_at || !row.job_id || row.kind !== kind) continue;
    const size = measurementSize(kind, row.data);
    if (size > 0) sizeByJob.set(row.job_id, (sizeByJob.get(row.job_id) ?? 0) + size);
  }

  const rates: number[] = [];
  for (const job of jobs) {
    if (job.deleted_at || job.type !== kind) continue;
    const minutes = minutesByJob.get(job.id);
    const size = sizeByJob.get(job.id);
    if (!minutes || !size) continue;
    // Sub un sfert de oră nu e o lucrare, e o probă a cronometrului.
    if (minutes < 15) continue;
    rates.push(size / (minutes / 60));
  }

  if (rates.length < MIN_SAMPLES) return null;
  const perHour = median(rates);
  if (!Number.isFinite(perHour) || perHour <= 0) return null;

  return { perHour: Math.round(perHour * 100) / 100, samples: rates.length, unit };
}

export interface PaceEstimate {
  hours: number;
  pace: Pace;
  /** „68 m² → ~6 h 10 min, după ultimele 6 lucrări de parchet ale tale.” */
  text: string;
}

/** Cât ți-ar lua o lucrare de mărimea asta, la ritmul tău. */
export function estimateHours(size: number, pace: Pace | null): PaceEstimate | null {
  const quantity = num(size);
  if (!pace || quantity <= 0) return null;

  const hours = quantity / pace.perHour;
  if (!Number.isFinite(hours) || hours <= 0) return null;

  const rounded = Math.round(hours * 4) / 4; // sferturi de oră
  return {
    hours: rounded,
    pace,
    text: `${quantity} ${pace.unit} → ~${formatHours(rounded)}, după ultimele ${pace.samples} lucrări ale tale.`,
  };
}

function formatHours(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (!whole) return `${minutes} min`;
  if (!minutes) return `${whole} h`;
  return `${whole} h ${minutes} min`;
}
