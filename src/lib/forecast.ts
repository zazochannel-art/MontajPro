/**
 * Prognoza banilor pe următoarele săptămâni.
 *
 * Rapoartele se uită în urmă: ce a adus bani și cine. Întrebarea de care
 * atârnă însă lunile grele e alta — *îmi ajung banii până la sfârșitul lunii?*
 *
 * Aici nu se inventează nimic. Intră doar bani cu termen: tranșele neîncasate
 * din scadențar și restul lucrărilor care au o zi anume. Ies doar cheltuieli
 * cunoscute: cheltuielile fixe lunare, în ziua în care se plătesc de obicei,
 * și materialele necumpărate ale lucrărilor pornite. O ofertă netrimisă sau o
 * lucrare fără dată nu apar nicăieri: banii pe care „poate" îi iei sunt exact
 * banii pe care nu trebuie să te bazezi.
 */
import { addDaysToKey, formatDateShort, todayKey } from "./format";
import type {
  FixedCost,
  Installment,
  Job,
  JobMaterial,
  Payment,
} from "./types";

/** Statusurile în care o lucrare are bani de încasat cu adevărat. */
const REAL_JOB_STATUSES = new Set(["confirmed", "materials", "in_progress", "done"]);
/** Statusurile în care materialele chiar urmează să fie cumpărate. */
const BUYING_STATUSES = new Set(["confirmed", "materials", "in_progress"]);

export type ForecastKind = "installment" | "job_rest" | "fixed_cost" | "material";

export interface ForecastEntry {
  id: string;
  kind: ForecastKind;
  label: string;
  /** Pozitiv întotdeauna; semnul îl dă lista în care stă. */
  amount: number;
  /** Ziua în care se așteaptă banii (ISO date). */
  date: string;
  job_id: string | null;
  /** Termenul a trecut deja — banii trebuiau să fie aici. */
  overdue: boolean;
}

export interface ForecastWeek {
  start: string;
  end: string;
  /** „22–28 sep” */
  label: string;
  incoming: ForecastEntry[];
  outgoing: ForecastEntry[];
  income: number;
  expense: number;
  net: number;
  /** Cât s-a adunat de la începutul prognozei până la capătul săptămânii. */
  cumulative: number;
}

export interface Forecast {
  weeks: ForecastWeek[];
  income: number;
  expense: number;
  net: number;
  /** Bani care trebuiau să intre deja și n-au intrat. */
  overdue: number;
  from: string;
  to: string;
}

export interface ForecastInput {
  jobs: Job[];
  payments: Payment[];
  installments: Installment[];
  fixedCosts: FixedCost[];
  materials: JobMaterial[];
  /** Implicit azi; parametrul există ca testele să nu depindă de ceas. */
  today?: string;
  /** Câte săptămâni în față. Implicit patru. */
  weeks?: number;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Ziua din lună în care se plătește o cheltuială fixă. */
function payDay(cost: FixedCost): number {
  const day = Number(cost.started_at?.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= 28 ? day : 1;
}

/** Zilele în care cade o cheltuială fixă între două date. */
function fixedCostDates(cost: FixedCost, from: string, to: string): string[] {
  const dates: string[] = [];
  const day = String(payDay(cost)).padStart(2, "0");
  let cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const limit = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);

  while (cursor <= limit) {
    const month = cursor.toISOString().slice(0, 7);
    const date = `${month}-${day}`;
    const started = (cost.started_at ?? "").slice(0, 10);
    const ended = cost.ended_at ? cost.ended_at.slice(0, 10) : null;
    const running = (!started || date >= started) && (!ended || date <= ended);
    if (running && date >= from && date <= to) dates.push(date);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return dates;
}

export function buildForecast(input: ForecastInput): Forecast {
  const today = input.today ?? todayKey();
  const weekCount = input.weeks ?? 4;
  const to = addDaysToKey(today, weekCount * 7 - 1);

  const jobs = input.jobs.filter((job) => !job.deleted_at);
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const paid = new Map<string, number>();
  for (const payment of input.payments) {
    if (payment.deleted_at || !payment.job_id) continue;
    paid.set(payment.job_id, (paid.get(payment.job_id) ?? 0) + num(payment.amount));
  }

  const incoming: ForecastEntry[] = [];
  const outgoing: ForecastEntry[] = [];

  /* ---------------------------- tranșe ----------------------------- */
  // Tranșa neîncasată e singurul „bani care intră” cu un termen pus de om.
  const withInstallments = new Map<string, number>();
  for (const item of input.installments) {
    if (item.deleted_at || item.payment_id || !item.due_date) continue;
    const job = jobById.get(item.job_id);
    if (!job || job.archived_at) continue;

    const date = item.due_date.slice(0, 10);
    withInstallments.set(item.job_id, (withInstallments.get(item.job_id) ?? 0) + num(item.amount));
    if (date > to) continue;

    incoming.push({
      id: item.id,
      kind: "installment",
      label: `${item.label || "Tranșă"} — ${job.title}`,
      amount: num(item.amount),
      date: date < today ? today : date,
      job_id: job.id,
      overdue: date < today,
    });
  }

  /* --------------------------- rest lucrare ------------------------ */
  // Restul intră doar pe lucrările fără scadențar: altfel aceiași bani ar fi
  // numărați de două ori, o dată ca tranșă și o dată ca rest.
  for (const job of jobs) {
    if (job.archived_at || !REAL_JOB_STATUSES.has(job.status)) continue;
    if (withInstallments.has(job.id)) continue;

    const rest = num(job.price_total) - (paid.get(job.id) ?? 0);
    if (rest <= 0.5) continue;

    const date = (job.end_date || job.scheduled_date || "").slice(0, 10);
    // Fără o zi anume nu e o prognoză, e o dorință.
    if (!date || date > to) continue;

    incoming.push({
      id: `rest:${job.id}`,
      kind: "job_rest",
      label: `Rest — ${job.title}`,
      amount: rest,
      date: date < today ? today : date,
      job_id: job.id,
      overdue: date < today,
    });
  }

  /* ------------------------ cheltuieli fixe ------------------------ */
  for (const cost of input.fixedCosts) {
    if (cost.deleted_at) continue;
    for (const date of fixedCostDates(cost, today, to)) {
      outgoing.push({
        id: `fix:${cost.id}:${date}`,
        kind: "fixed_cost",
        label: cost.name || "Cheltuială fixă",
        amount: num(cost.amount),
        date,
        job_id: null,
        overdue: false,
      });
    }
  }

  /* --------------------------- materiale --------------------------- */
  const byJob = new Map<string, number>();
  for (const material of input.materials) {
    if (material.deleted_at || material.purchased) continue;
    const job = jobById.get(material.job_id);
    if (!job || job.archived_at || !BUYING_STATUSES.has(job.status)) continue;
    const cost = num(material.quantity) * num(material.unit_price);
    if (cost <= 0) continue;
    byJob.set(material.job_id, (byJob.get(material.job_id) ?? 0) + cost);
  }
  for (const [jobId, cost] of byJob) {
    const job = jobById.get(jobId);
    if (!job) continue;
    // Materialele se cumpără înainte de lucrare; dacă ziua a trecut sau
    // lucrarea a pornit deja, banii ies acum.
    const scheduled = (job.scheduled_date || "").slice(0, 10);
    const date = !scheduled || scheduled < today ? today : scheduled;
    if (date > to) continue;
    outgoing.push({
      id: `mat:${jobId}`,
      kind: "material",
      label: `Materiale — ${job.title}`,
      amount: cost,
      date,
      job_id: jobId,
      overdue: false,
    });
  }

  /* --------------------------- săptămâni --------------------------- */
  const weeks: ForecastWeek[] = [];
  let cumulative = 0;

  for (let index = 0; index < weekCount; index++) {
    const start = addDaysToKey(today, index * 7);
    const end = addDaysToKey(start, 6);
    const inWindow = (entry: ForecastEntry) => entry.date >= start && entry.date <= end;

    const weekIn = incoming.filter(inWindow).sort((a, b) => a.date.localeCompare(b.date));
    const weekOut = outgoing.filter(inWindow).sort((a, b) => a.date.localeCompare(b.date));
    const income = weekIn.reduce((acc, entry) => acc + entry.amount, 0);
    const expense = weekOut.reduce((acc, entry) => acc + entry.amount, 0);
    cumulative += income - expense;

    weeks.push({
      start,
      end,
      label: `${formatDateShort(start)} – ${formatDateShort(end)}`,
      incoming: weekIn,
      outgoing: weekOut,
      income,
      expense,
      net: income - expense,
      cumulative,
    });
  }

  const income = weeks.reduce((acc, week) => acc + week.income, 0);
  const expense = weeks.reduce((acc, week) => acc + week.expense, 0);

  return {
    weeks,
    income,
    expense,
    net: income - expense,
    overdue: incoming
      .filter((entry) => entry.overdue)
      .reduce((acc, entry) => acc + entry.amount, 0),
    from: today,
    to,
  };
}
