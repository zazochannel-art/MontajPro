/**
 * Testele ritmului propriu.
 *
 * Cifra asta ajunge într-un câmp pe care omul îl folosește ca să promită o
 * dată clientului, deci contează mai mult să fie prudentă decât precisă.
 *
 *   node --test tests/pace.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_SAMPLES, estimateHours, measurementSize, paceFor } from "../src/lib/pace.ts";
import type { Job, JobMeasurement, WorkSession } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-01-10T08:00:00.000Z",
  updated_at: "2026-01-10T08:00:00.000Z",
  deleted_at: null,
};

function job(id: string, patch: Partial<Job> = {}): Job {
  return {
    ...BASE,
    id,
    client_id: null,
    project_id: null,
    title: `Lucrare ${id}`,
    type: "parquet",
    status: "done",
    address: null,
    scheduled_date: null,
    scheduled_time: null,
    estimated_hours: null,
    price_total: 0,
    material_cost: null,
    start_date: null,
    end_date: null,
    notes: null,
    archived_at: null,
    in_portfolio: false,
    portfolio_description: null,
    warranty_of_job_id: null,
    material_delivered_at: null,
    travel_km: null,
    public_token: null,
    ...patch,
  };
}

function measurement(jobId: string, area: number): JobMeasurement {
  return {
    ...BASE,
    id: `m-${jobId}`,
    job_id: jobId,
    client_id: null,
    kind: "parquet",
    label: null,
    data: { area },
    notes: null,
  } as JobMeasurement;
}

function session(jobId: string, minutes: number): WorkSession {
  return {
    ...BASE,
    id: `s-${jobId}-${minutes}`,
    job_id: jobId,
    started_at: "2026-01-10T08:00:00.000Z",
    ended_at: "2026-01-10T12:00:00.000Z",
    duration_minutes: minutes,
    note: null,
    by_member_id: null,
    by_member_name: null,
  };
}

test("ritmul iese din lucrările tale, nu dintr-un tabel", () => {
  // 60 m² în 6 h = 10 m²/h; 40 m² în 4 h = 10 m²/h.
  const pace = paceFor(
    "parquet",
    [job("a"), job("b")],
    [measurement("a", 60), measurement("b", 40)],
    [session("a", 360), session("b", 240)],
  );
  assert.equal(pace?.perHour, 10);
  assert.equal(pace?.samples, 2);
  assert.equal(pace?.unit, "m²");
});

test("o zi proastă nu strică ritmul pentru totdeauna", () => {
  // Trei lucrări bune la 10 m²/h și una blocată la 2 m²/h. Mediana ține.
  const jobs = [job("a"), job("b"), job("c"), job("d")];
  const measurements = [
    measurement("a", 60),
    measurement("b", 50),
    measurement("c", 40),
    measurement("d", 12),
  ];
  const sessions = [
    session("a", 360),
    session("b", 300),
    session("c", 240),
    session("d", 360),
  ];
  const pace = paceFor("parquet", jobs, measurements, sessions);
  assert.equal(pace?.samples, 4);
  // Media ar fi ~8,0; mediana rămâne la 10.
  assert.equal(pace?.perHour, 10);
});

test("sub două lucrări nu se pronunță", () => {
  const pace = paceFor(
    "parquet",
    [job("a")],
    [measurement("a", 60)],
    [session("a", 360)],
  );
  assert.equal(pace, null);
  assert.equal(MIN_SAMPLES, 2);
});

test("lucrarea fără cronometru sau fără măsurătoare nu intră în socoteală", () => {
  const pace = paceFor(
    "parquet",
    [job("a"), job("b"), job("c")],
    [measurement("a", 60), measurement("b", 40)],
    [session("a", 360)],
  );
  assert.equal(pace, null, "a rămas o singură lucrare completă");
});

test("o probă de cronometru de câteva minute nu e o lucrare", () => {
  const pace = paceFor(
    "parquet",
    [job("a"), job("b")],
    [measurement("a", 60), measurement("b", 3)],
    [session("a", 360), session("b", 4)],
  );
  assert.equal(pace, null, "sesiunea de 4 minute trebuia ignorată");
});

test("minutele mai multor sesiuni pe aceeași lucrare se adună", () => {
  const pace = paceFor(
    "parquet",
    [job("a"), job("b")],
    [measurement("a", 60), measurement("b", 60)],
    [session("a", 180), session("a", 180), session("b", 360)],
  );
  assert.equal(pace?.perHour, 10);
});

test("„altceva” n-are unitate comună, deci n-are ritm", () => {
  assert.equal(paceFor("other", [], [], []), null);
  assert.equal(measurementSize("other", { quantity: 5 }), 0);
});

test("estimarea spune pe ce se bazează, ca să știi cât să te încrezi", () => {
  const pace = { perHour: 11, samples: 6, unit: "m²" };
  const estimate = estimateHours(68, pace);
  assert.equal(estimate?.hours, 6.25);
  assert.ok(estimate?.text.includes("68 m²"));
  assert.ok(estimate?.text.includes("6 h 15 min"));
  assert.ok(estimate?.text.includes("ultimele 6 lucrări"));
});

test("fără ritm sau fără cantitate nu se propune nimic", () => {
  assert.equal(estimateHours(68, null), null);
  assert.equal(estimateHours(0, { perHour: 11, samples: 6, unit: "m²" }), null);
});
