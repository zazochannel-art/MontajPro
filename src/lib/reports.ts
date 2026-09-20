import { num } from "./utils";
import { totalWorkedMinutes } from "./calc";
import type {
  Expense,
  Job,
  JobMaterial,
  JobMeasurement,
  JobType,
  MeasurementData,
  ParquetMeasurement,
  PlinthMeasurement,
  StairsMeasurement,
  WorkSession,
} from "./types";

/**
 * Rapoarte: ce aduce bani și cine.
 *
 * Se uită numai la lucrările **finalizate** — o lucrare în curs n-are încă
 * toate cheltuielile, iar o ofertă nu s-a întâmplat. Profitul e calculat la
 * fel ca pe pagina lucrării: preț minus materiale minus cheltuieli, fără să
 * scadă manopera proprie.
 */

export const UNIT_LABELS: Record<JobType, string> = {
  stairs: "treaptă",
  parquet: "m²",
  plinth: "m",
  other: "",
};

/** Cantitatea după care se judecă prețul, luată din măsurători. */
export function measurementUnits(
  kind: JobType,
  data: MeasurementData,
): number | null {
  if (kind === "stairs") return num((data as StairsMeasurement).steps) || null;
  if (kind === "parquet") return num((data as ParquetMeasurement).area) || null;
  if (kind === "plinth")
    return num((data as PlinthMeasurement).linear_meters) || null;
  return null;
}

export interface JobReportRow {
  job: Job;
  price: number;
  cost: number;
  profit: number;
  hours: number;
  units: number;
}

/** Ziua după care se așază lucrarea pe calendarul raportului. */
export function jobDate(job: Job): string {
  return job.end_date ?? job.start_date ?? job.scheduled_date ?? job.created_at;
}

export function buildJobRows(input: {
  jobs: Job[];
  materials: JobMaterial[];
  expenses: Expense[];
  sessions: WorkSession[];
  measurements: JobMeasurement[];
  now?: number;
}): JobReportRow[] {
  const now = input.now ?? 0;
  return input.jobs
    .filter((job) => job.status === "done")
    .map((job) => {
      const materialsCost =
        input.materials
          .filter((row) => row.job_id === job.id)
          .reduce((acc, row) => acc + num(row.quantity) * num(row.unit_price), 0) +
        num(job.material_cost);
      const expensesCost = input.expenses
        .filter((row) => row.job_id === job.id)
        .reduce((acc, row) => acc + num(row.amount), 0);
      const minutes = totalWorkedMinutes(
        input.sessions.filter((row) => row.job_id === job.id),
        now,
      );
      const units = input.measurements
        .filter((row) => row.job_id === job.id && row.kind === job.type)
        .reduce((acc, row) => acc + (measurementUnits(row.kind, row.data) ?? 0), 0);

      const price = num(job.price_total);
      const cost = materialsCost + expensesCost;
      return { job, price, cost, profit: price - cost, hours: minutes / 60, units };
    });
}

export interface TypeReport {
  kind: JobType;
  jobs: number;
  price: number;
  profit: number;
  margin: number;
  hours: number;
  perHour: number | null;
  units: number;
  pricePerUnit: number | null;
}

export function byType(rows: JobReportRow[]): TypeReport[] {
  const groups = new Map<JobType, JobReportRow[]>();
  for (const row of rows) {
    groups.set(row.job.type, [...(groups.get(row.job.type) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([kind, items]) => {
      const price = items.reduce((acc, row) => acc + row.price, 0);
      const profit = items.reduce((acc, row) => acc + row.profit, 0);
      const hours = items.reduce((acc, row) => acc + row.hours, 0);
      // Doar lucrările cu măsurători intră în media pe unitate; altfel
      // prețul unei lucrări nemăsurate ar trage media în jos degeaba.
      const measured = items.filter((row) => row.units > 0);
      const units = measured.reduce((acc, row) => acc + row.units, 0);
      const measuredPrice = measured.reduce((acc, row) => acc + row.price, 0);

      return {
        kind,
        jobs: items.length,
        price,
        profit,
        margin: price > 0 ? (profit / price) * 100 : 0,
        hours,
        perHour: hours >= 0.25 ? profit / hours : null,
        units,
        pricePerUnit: units > 0 ? measuredPrice / units : null,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

export interface ClientReport {
  clientId: string | null;
  jobs: number;
  price: number;
  profit: number;
}

export function byClient(rows: JobReportRow[]): ClientReport[] {
  const groups = new Map<string | null, JobReportRow[]>();
  for (const row of rows) {
    const key = row.job.client_id ?? null;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([clientId, items]) => ({
      clientId,
      jobs: items.length,
      price: items.reduce((acc, row) => acc + row.price, 0),
      profit: items.reduce((acc, row) => acc + row.profit, 0),
    }))
    .sort((a, b) => b.price - a.price);
}

export interface ReportTotals {
  jobs: number;
  price: number;
  profit: number;
  hours: number;
  perHour: number | null;
}

export function totals(rows: JobReportRow[]): ReportTotals {
  const price = rows.reduce((acc, row) => acc + row.price, 0);
  const profit = rows.reduce((acc, row) => acc + row.profit, 0);
  const hours = rows.reduce((acc, row) => acc + row.hours, 0);
  return {
    jobs: rows.length,
    price,
    profit,
    hours,
    perHour: hours >= 0.25 ? profit / hours : null,
  };
}
