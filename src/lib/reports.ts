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
  /** Câte lucrări au stat la baza mediei pe unitate. */
  measuredJobs: number;
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
        measuredJobs: measured.length,
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

/**
 * Media pe unitate din lucrările finalizate, pe tip.
 *
 * Rapoartele o calculau deja, dar o vedeai o dată pe lună, dacă intrai
 * acolo. Cifra asta e utilă exact într-o clipă: când scrii prețul. Numărul
 * minim de lucrări nu e un moft — o medie din două scări nu e o medie, e o
 * coincidență.
 */
export function priceHistory(
  rows: JobReportRow[],
  kind: JobType,
  minJobs = 3,
): { perUnit: number; jobs: number; unit: string } | null {
  const report = byType(rows).find((entry) => entry.kind === kind);
  if (!report?.pricePerUnit || report.measuredJobs < minJobs) return null;
  return {
    perUnit: report.pricePerUnit,
    jobs: report.measuredJobs,
    unit: UNIT_LABELS[kind] || "unitate",
  };
}

/* ------------------------------------------------------------------ */
/* Consumul real față de estimat                                       */
/* ------------------------------------------------------------------ */

/**
 * Măsurătoarea spune cât ar trebui. Materialele spun cât a intrat.
 *
 * Diferența dintre ele sunt bani care se pierd tăcut: parchetul tăiat greșit,
 * plinta prinsă scurt, treapta crăpată la montaj. Nimeni nu-i vede, fiindcă
 * fiecare lucrare în parte pare în regulă — abia adunate pe un an arată cât
 * costă de fapt „mai luăm doi metri, să fie".
 */

/** Unitatea în care se măsoară consumul, pe tip de lucrare. */
const CONSUMPTION_UNITS: Record<JobType, string | null> = {
  stairs: "buc",
  parquet: "m²",
  plinth: "m",
  // „Altceva” n-are o unitate fixă, deci n-are cu ce fi comparat.
  other: null,
};

/** „M2”, „m 2”, „mp” și „m²” sunt același lucru scris de mâini diferite. */
export function normalizeUnit(unit: string | null | undefined): string {
  const value = (unit ?? "").toLowerCase().replace(/\s+/g, "");
  if (value === "m2" || value === "mp") return "m²";
  if (value === "m3") return "m³";
  if (value === "bucati" || value === "bucăți" || value === "buc.") return "buc";
  if (value === "ml") return "m";
  return value;
}

/** Cât ar fi trebuit să intre, după măsurătoare — cu pierderea prevăzută. */
export function plannedUnits(kind: JobType, data: MeasurementData): number {
  if (kind === "parquet") {
    const parquet = data as ParquetMeasurement;
    const area = num(parquet.area);
    if (!area) return 0;
    const waste = num(parquet.waste_percent);
    // Rotunjim la trei zecimale: altfel 100 m² cu 10% pierdere ies
    // 110.00000000000001, iar comparațiile de mai jos moștenesc coada.
    return Math.round(area * (1 + waste / 100) * 1000) / 1000;
  }
  return measurementUnits(kind, data) ?? 0;
}

export interface ConsumptionRow {
  job: Job;
  unit: string;
  planned: number;
  used: number;
  extra: number;
  /** Cu cât s-a depășit, în procente. `null` când n-are sens împărțirea. */
  extraPercent: number | null;
}

export function buildConsumption(input: {
  jobs: Job[];
  materials: JobMaterial[];
  measurements: JobMeasurement[];
}): ConsumptionRow[] {
  const rows: ConsumptionRow[] = [];

  for (const job of input.jobs) {
    if (job.deleted_at) continue;
    const unit = CONSUMPTION_UNITS[job.type];
    if (!unit) continue;

    const planned = input.measurements
      .filter((row) => !row.deleted_at && row.job_id === job.id && row.kind === job.type)
      .reduce((acc, row) => acc + plannedUnits(row.kind, row.data), 0);

    const used = input.materials
      .filter(
        (row) =>
          !row.deleted_at &&
          row.job_id === job.id &&
          normalizeUnit(row.unit) === unit,
      )
      .reduce((acc, row) => acc + num(row.quantity), 0);

    // Fără ambele jumătăți nu e o comparație, e o jumătate de poveste.
    if (planned <= 0 || used <= 0) continue;

    const extra = used - planned;
    rows.push({
      job,
      unit,
      planned,
      used,
      extra,
      extraPercent: (extra / planned) * 100,
    });
  }

  return rows.sort((a, b) => (b.extraPercent ?? 0) - (a.extraPercent ?? 0));
}

export interface ConsumptionReport {
  kind: JobType;
  unit: string;
  jobs: number;
  planned: number;
  used: number;
  extra: number;
  extraPercent: number | null;
}

export function consumptionByType(rows: ConsumptionRow[]): ConsumptionReport[] {
  const groups = new Map<JobType, ConsumptionRow[]>();
  for (const row of rows) {
    groups.set(row.job.type, [...(groups.get(row.job.type) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([kind, items]) => {
      const planned = items.reduce((acc, row) => acc + row.planned, 0);
      const used = items.reduce((acc, row) => acc + row.used, 0);
      return {
        kind,
        unit: items[0].unit,
        jobs: items.length,
        planned,
        used,
        extra: used - planned,
        extraPercent: planned > 0 ? ((used - planned) / planned) * 100 : null,
      };
    })
    .sort((a, b) => (b.extraPercent ?? 0) - (a.extraPercent ?? 0));
}
