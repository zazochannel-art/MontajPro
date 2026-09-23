/**
 * Restanțele, pe vechime.
 *
 * „Plată restantă” se aprinde în ziua în care marchezi lucrarea finalizată și
 * nu se mai stinge niciodată (`notifications/engine.tsx`), iar în Finanțe
 * restul de încasat e un singur număr. Dar 2.000 de lei de acum trei zile și
 * 2.000 de acum patru luni sunt două lucruri diferite: primul e cum merge
 * treaba, al doilea e un om pe care trebuie să-l suni azi.
 *
 * Vechimea se numără de la ziua lucrării, nu de la o scadență: nu toate au
 * factură cu termen, dar toate au o zi în care s-au terminat.
 */
import { num } from "./utils";
import { jobDate } from "./reports";
import type { Job, Payment } from "./types";

/** Pragurile, în zile. Peste ultimul e coada de listă. */
export const AGE_BANDS = [30, 60] as const;

export type AgeBand = "proaspat" | "intarziat" | "vechi";

export const AGE_LABELS: Record<AgeBand, string> = {
  proaspat: "Sub 30 de zile",
  intarziat: "30–60 de zile",
  vechi: "Peste 60 de zile",
};

export interface Receivable {
  job: Job;
  /** Cât a rămas de încasat. */
  rest: number;
  /** De câte zile stă. */
  days: number;
  band: AgeBand;
}

export interface Aging {
  rows: Receivable[];
  /** Totalul pe fiecare prag, în ordinea din `AgeBand`. */
  byBand: Record<AgeBand, number>;
  total: number;
  /** Cea mai veche restanță, în zile. Zero dacă nu e nimic de încasat. */
  oldest: number;
}

function bandOf(days: number): AgeBand {
  if (days > AGE_BANDS[1]) return "vechi";
  if (days > AGE_BANDS[0]) return "intarziat";
  return "proaspat";
}

/** Zilele întregi dintre două chei de zi. Negativ nu există: viitorul e zero. */
function daysBetween(from: string, today: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Ce ai de încasat, împărțit pe vechime.
 *
 * Intră doar lucrările finalizate: pe una în lucru, banii nu sunt restanți,
 * sunt încă de făcut. Cele arhivate sau șterse nu se numără — arhivarea le
 * sare tocmai pe cele cu rest (vezi `archiveOldJobs`), deci ce ajunge acolo a
 * fost închis dinadins.
 *
 * Sub 50 de bani nu e o datorie, e o rotunjire.
 */
export function aging(jobs: Job[], payments: Payment[], today: string): Aging {
  const paidByJob = new Map<string, number>();
  for (const payment of payments) {
    if (payment.deleted_at || !payment.job_id) continue;
    paidByJob.set(
      payment.job_id,
      (paidByJob.get(payment.job_id) ?? 0) + num(payment.amount),
    );
  }

  const rows: Receivable[] = [];
  for (const job of jobs) {
    if (job.deleted_at || job.archived_at) continue;
    if (job.status !== "done") continue;

    const rest = num(job.price_total) - (paidByJob.get(job.id) ?? 0);
    if (rest <= 0.5) continue;

    const days = daysBetween(jobDate(job), today);
    rows.push({
      job,
      rest: Math.round(rest * 100) / 100,
      days,
      band: bandOf(days),
    });
  }

  rows.sort((a, b) => b.days - a.days || b.rest - a.rest);

  const byBand: Record<AgeBand, number> = {
    proaspat: 0,
    intarziat: 0,
    vechi: 0,
  };
  for (const row of rows) byBand[row.band] += row.rest;
  for (const key of Object.keys(byBand) as AgeBand[]) {
    byBand[key] = Math.round(byBand[key] * 100) / 100;
  }

  return {
    rows,
    byBand,
    total: Math.round(rows.reduce((acc, row) => acc + row.rest, 0) * 100) / 100,
    oldest: rows[0]?.days ?? 0,
  };
}
