/**
 * Testele rapoartelor.
 *
 * Cifrele astea ajung în deciziile de preț ale unui om, deci merită verificate
 * pe cazuri scrise de mână, nu doar privite pe ecran.
 *
 *   node --test tests/reports.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixedCostsForMonth } from "../src/lib/calc.ts";
import {
  buildConsumption,
  buildJobRows,
  byClient,
  byType,
  consumptionByType,
  measurementUnits,
  normalizeUnit,
  plannedUnits,
  priceHistory,
  totals,
} from "../src/lib/reports.ts";
import type { Job, JobMaterial, JobMeasurement, WorkSession } from "../src/lib/types.ts";

function job(patch: Partial<Job> & { id: string }): Job {
  return {
    user_id: "u",
    created_at: "2026-01-10T08:00:00.000Z",
    updated_at: "2026-01-10T08:00:00.000Z",
    deleted_at: null,
    client_id: null,
    title: "Lucrare",
    type: "stairs",
    status: "done",
    address: null,
    scheduled_date: null,
    scheduled_time: null,
    estimated_hours: null,
    price_total: 0,
    material_cost: null,
    start_date: null,
    end_date: "2026-01-10",
    notes: null,
    in_portfolio: false,
    portfolio_description: null,
    ...patch,
  } as Job;
}

function material(jobId: string, quantity: number, price: number): JobMaterial {
  return {
    id: `${jobId}-m`,
    user_id: "u",
    created_at: "2026-01-10T08:00:00.000Z",
    updated_at: "2026-01-10T08:00:00.000Z",
    deleted_at: null,
    job_id: jobId,
    quantity,
    unit_price: price,
  } as unknown as JobMaterial;
}

function session(jobId: string, minutes: number): WorkSession {
  return {
    id: `${jobId}-s`,
    user_id: "u",
    created_at: "2026-01-10T08:00:00.000Z",
    updated_at: "2026-01-10T08:00:00.000Z",
    deleted_at: null,
    job_id: jobId,
    started_at: "2026-01-10T08:00:00.000Z",
    ended_at: "2026-01-10T12:00:00.000Z",
    duration_minutes: minutes,
  } as unknown as WorkSession;
}

function measurement(jobId: string, kind: Job["type"], data: object): JobMeasurement {
  return {
    id: `${jobId}-x`,
    user_id: "u",
    created_at: "2026-01-10T08:00:00.000Z",
    updated_at: "2026-01-10T08:00:00.000Z",
    deleted_at: null,
    job_id: jobId,
    client_id: null,
    kind,
    label: null,
    notes: null,
    data,
  } as unknown as JobMeasurement;
}

test("numără doar lucrările finalizate", () => {
  const rows = buildJobRows({
    jobs: [
      job({ id: "a", price_total: 1000 }),
      job({ id: "b", price_total: 9999, status: "in_progress" }),
      job({ id: "c", price_total: 5555, status: "quote" }),
    ],
    materials: [],
    expenses: [],
    sessions: [],
    measurements: [],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, 1000);
});

test("profitul scade materialele și cheltuielile, nu manopera", () => {
  const rows = buildJobRows({
    jobs: [job({ id: "a", price_total: 10_000, material_cost: 500 })],
    materials: [material("a", 2, 750)],
    expenses: [
      { id: "e", job_id: "a", amount: 300 } as never,
      { id: "e2", job_id: "zzz", amount: 9000 } as never,
    ],
    sessions: [session("a", 600)],
    measurements: [],
  });
  // 10.000 − (500 manual + 1.500 materiale) − 300 bon = 7.700
  assert.equal(rows[0].cost, 2300);
  assert.equal(rows[0].profit, 7700);
  // Zece ore lucrate nu se scad din profit, doar îl împart.
  assert.equal(rows[0].hours, 10);
});

test("media pe unitate iese doar din lucrările măsurate", () => {
  const rows = buildJobRows({
    jobs: [
      job({ id: "a", price_total: 6000 }),
      job({ id: "b", price_total: 4000 }),
    ],
    materials: [],
    expenses: [],
    sessions: [],
    // Doar prima lucrare are măsurătoare: 15 trepte.
    measurements: [measurement("a", "stairs", { steps: 15 })],
  });
  const [stairs] = byType(rows);
  assert.equal(stairs.jobs, 2);
  assert.equal(stairs.price, 10_000);
  // 6.000 / 15 = 400 pe treaptă; lucrarea nemăsurată nu trage media în jos.
  assert.equal(stairs.pricePerUnit, 400);
});

test("câștigul pe oră tace sub un sfert de oră", () => {
  const scurt = totals(
    buildJobRows({
      jobs: [job({ id: "a", price_total: 500 })],
      materials: [],
      expenses: [],
      sessions: [session("a", 5)],
      measurements: [],
    }),
  );
  assert.equal(scurt.perHour, null);

  const lung = totals(
    buildJobRows({
      jobs: [job({ id: "a", price_total: 500 })],
      materials: [],
      expenses: [],
      sessions: [session("a", 120)],
      measurements: [],
    }),
  );
  assert.equal(lung.perHour, 250);
});

test("clienții se adună și se ordonează după valoare", () => {
  const rows = buildJobRows({
    jobs: [
      job({ id: "a", client_id: "c1", price_total: 1000 }),
      job({ id: "b", client_id: "c1", price_total: 2000 }),
      job({ id: "c", client_id: "c2", price_total: 5000 }),
      job({ id: "d", client_id: null, price_total: 100 }),
    ],
    materials: [],
    expenses: [],
    sessions: [],
    measurements: [],
  });
  const list = byClient(rows);
  assert.equal(list[0].clientId, "c2");
  assert.equal(list[0].price, 5000);
  assert.equal(list[1].clientId, "c1");
  assert.equal(list[1].jobs, 2);
  assert.equal(list[1].price, 3000);
  assert.equal(list[2].clientId, null);
});

test("unitatea se citește după tipul măsurătorii", () => {
  assert.equal(measurementUnits("stairs", { steps: 14 }), 14);
  assert.equal(measurementUnits("parquet", { area: 82.5 }), 82.5);
  assert.equal(measurementUnits("plinth", { linear_meters: 61 }), 61);
  assert.equal(measurementUnits("other", { quantity: 3 }), null);
  assert.equal(measurementUnits("stairs", {}), null);
});

test("cheltuielile fixe se numără doar în lunile în care au curs", () => {
  const costs = [
    { amount: 2000, started_at: "2026-01-15", ended_at: null },
    { amount: 500, started_at: "2026-03-01", ended_at: "2026-04-20" },
    { amount: 900, started_at: "2026-09-01", ended_at: null },
  ];
  // Ianuarie: doar chiria începută pe 15 — data de început e în lună.
  assert.equal(fixedCostsForMonth(costs, "2026-01"), 2000);
  // Martie: chiria plus cea de-a doua, pornită de la întâi.
  assert.equal(fixedCostsForMonth(costs, "2026-03"), 2500);
  // Mai: a doua s-a încheiat în aprilie, deci iese din socoteală.
  assert.equal(fixedCostsForMonth(costs, "2026-05"), 2000);
  // Decembrie 2025: nimic nu începuse încă.
  assert.equal(fixedCostsForMonth(costs, "2025-12"), 0);
});

/* ------------------------------------------------------------------ */
/* Consumul real față de estimat                                       */
/* ------------------------------------------------------------------ */

/** Material cu unitate — cel de sus n-o are, iar aici unitatea e totul. */
function stock(
  jobId: string,
  quantity: number,
  unit: string,
  id = `${jobId}-${unit}-${quantity}`,
): JobMaterial {
  return {
    id,
    user_id: "u",
    created_at: "2026-01-10T08:00:00.000Z",
    updated_at: "2026-01-10T08:00:00.000Z",
    deleted_at: null,
    job_id: jobId,
    name: "Material",
    quantity,
    unit,
    unit_price: 0,
  } as unknown as JobMaterial;
}

test("unitățile scrise altfel sunt aceeași unitate", () => {
  assert.equal(normalizeUnit("M2"), "m²");
  assert.equal(normalizeUnit("mp"), "m²");
  assert.equal(normalizeUnit("m 2"), "m²");
  assert.equal(normalizeUnit("ML"), "m");
  assert.equal(normalizeUnit("Bucăți"), "buc");
  assert.equal(normalizeUnit(null), "");
});

test("estimatul la parchet include pierderea prevăzută", () => {
  assert.equal(plannedUnits("parquet", { area: 100, waste_percent: 10 }), 110);
  assert.equal(plannedUnits("parquet", { area: 100 }), 100);
  assert.equal(plannedUnits("stairs", { steps: 15 }), 15);
});

test("consumul peste estimat se vede în procente", () => {
  const rows = buildConsumption({
    jobs: [job({ id: "a", type: "parquet" })],
    measurements: [measurement("a", "parquet", { area: 100, waste_percent: 10 })],
    materials: [stock("a", 121, "m²")],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].planned, 110);
  assert.equal(rows[0].used, 121);
  assert.equal(Math.round(rows[0].extraPercent ?? 0), 10);
});

test("materialele în altă unitate nu intră în comparație", () => {
  const rows = buildConsumption({
    jobs: [job({ id: "a", type: "parquet" })],
    measurements: [measurement("a", "parquet", { area: 100 })],
    materials: [stock("a", 100, "m²"), stock("a", 40, "buc"), stock("a", 5, "l")],
  });

  assert.equal(rows[0].used, 100);
  assert.equal(rows[0].extra, 0);
});

test("fără măsurătoare sau fără materiale nu e o comparație", () => {
  assert.equal(
    buildConsumption({
      jobs: [job({ id: "a", type: "parquet" })],
      measurements: [],
      materials: [stock("a", 100, "m²")],
    }).length,
    0,
  );
  assert.equal(
    buildConsumption({
      jobs: [job({ id: "a", type: "parquet" })],
      measurements: [measurement("a", "parquet", { area: 100 })],
      materials: [],
    }).length,
    0,
  );
});

test("„altceva” n-are unitate fixă, deci nu se compară", () => {
  const rows = buildConsumption({
    jobs: [job({ id: "a", type: "other" })],
    measurements: [measurement("a", "other", { quantity: 10, unit: "buc" })],
    materials: [stock("a", 12, "buc")],
  });
  assert.equal(rows.length, 0);
});

test("pierderea se adună pe tip de lucrare", () => {
  const rows = buildConsumption({
    jobs: [
      job({ id: "a", type: "parquet" }),
      job({ id: "b", type: "parquet" }),
      job({ id: "c", type: "plinth" }),
    ],
    measurements: [
      measurement("a", "parquet", { area: 100 }),
      measurement("b", "parquet", { area: 100 }),
      measurement("c", "plinth", { linear_meters: 50 }),
    ],
    materials: [
      stock("a", 110, "m²"),
      stock("b", 130, "m²"),
      stock("c", 52, "m"),
    ],
  });

  const report = consumptionByType(rows);
  const parquet = report.find((entry) => entry.kind === "parquet");
  assert.ok(parquet);
  assert.equal(parquet.jobs, 2);
  assert.equal(parquet.planned, 200);
  assert.equal(parquet.used, 240);
  assert.equal(parquet.extraPercent, 20);
  assert.equal(parquet.unit, "m²");

  const plinth = report.find((entry) => entry.kind === "plinth");
  assert.equal(plinth?.extraPercent, 4);
  // Cea mai costisitoare pierdere stă prima.
  assert.equal(report[0].kind, "parquet");
});

test("media pe unitate apare doar când e o medie, nu o coincidență", () => {
  const rows = buildJobRows({
    jobs: [
      job({ id: "a", type: "parquet", price_total: 10000 }),
      job({ id: "b", type: "parquet", price_total: 12000 }),
    ],
    materials: [],
    expenses: [],
    sessions: [],
    measurements: [
      measurement("a", "parquet", { area: 100 }),
      measurement("b", "parquet", { area: 100 }),
    ],
  });

  // Două lucrări nu fac o medie.
  assert.equal(priceHistory(rows, "parquet"), null);
  assert.equal(priceHistory(rows, "parquet", 2)?.perUnit, 110);
  assert.equal(priceHistory(rows, "parquet", 2)?.jobs, 2);
  assert.equal(priceHistory(rows, "parquet", 2)?.unit, "m²");
  // Un tip fără lucrări măsurate n-are ce medie să dea.
  assert.equal(priceHistory(rows, "stairs", 1), null);
});
