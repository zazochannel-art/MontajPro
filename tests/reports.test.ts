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
import {
  buildJobRows,
  byClient,
  byType,
  measurementUnits,
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
