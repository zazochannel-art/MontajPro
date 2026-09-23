/**
 * Testele restanțelor pe vechime.
 *
 * Cifra asta se citește ca să hotărăști pe cine suni azi, deci pragurile
 * trebuie să cadă exact unde scrie, nu pe-aproape.
 *
 *   node --test tests/aging.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aging } from "../src/lib/aging.ts";
import type { Job, Payment } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-01-01T08:00:00.000Z",
  updated_at: "2026-01-01T08:00:00.000Z",
  deleted_at: null,
};

const TODAY = "2026-09-23";

function job(id: string, patch: Partial<Job> = {}): Job {
  return {
    ...BASE,
    id,
    client_id: null,
    project_id: null,
    title: id,
    type: "parquet",
    status: "done",
    address: null,
    scheduled_date: null,
    scheduled_end_date: null,
    scheduled_time: null,
    estimated_hours: null,
    price_total: 1000,
    material_cost: null,
    start_date: null,
    end_date: "2026-09-20",
    notes: null,
    archived_at: null,
    in_portfolio: false,
    portfolio_description: null,
    warranty_of_job_id: null,
    material_delivered_at: null,
    travel_km: null,
    public_token: null,
    assigned_member_id: null,
    ...patch,
  } as Job;
}

function payment(jobId: string, amount: number): Payment {
  return {
    ...BASE,
    id: `p-${jobId}-${amount}`,
    job_id: jobId,
    client_id: null,
    amount,
    kind: "final",
    method: "cash",
    paid_at: "2026-09-21",
    note: null,
  } as Payment;
}

test("lucrarea plătită integral nu apare", () => {
  const result = aging([job("a")], [payment("a", 1000)], TODAY);
  assert.equal(result.rows.length, 0);
  assert.equal(result.total, 0);
});

test("restul se numără de la ziua lucrării", () => {
  const result = aging([job("a", { end_date: "2026-09-13" })], [], TODAY);
  assert.equal(result.rows[0].days, 10);
  assert.equal(result.rows[0].rest, 1000);
});

test("pragurile cad unde scrie", () => {
  const rows = aging(
    [
      job("proaspat", { end_date: "2026-09-13" }), // 10 zile
      job("granita30", { end_date: "2026-08-24" }), // 30 de zile fix
      job("intarziat", { end_date: "2026-08-23" }), // 31
      job("granita60", { end_date: "2026-07-25" }), // 60 fix
      job("vechi", { end_date: "2026-07-24" }), // 61
    ],
    [],
    TODAY,
  ).rows;

  const bandOf = (id: string) => rows.find((row) => row.job.id === id)?.band;
  assert.equal(bandOf("proaspat"), "proaspat");
  assert.equal(bandOf("granita30"), "proaspat", "30 de zile fix încă e proaspăt");
  assert.equal(bandOf("intarziat"), "intarziat");
  assert.equal(bandOf("granita60"), "intarziat", "60 fix încă nu e vechi");
  assert.equal(bandOf("vechi"), "vechi");
});

test("totalurile pe praguri se adună separat", () => {
  const result = aging(
    [
      job("a", { end_date: "2026-09-20", price_total: 500 }),
      job("b", { end_date: "2026-07-01", price_total: 300 }),
      job("c", { end_date: "2026-06-01", price_total: 200 }),
    ],
    [],
    TODAY,
  );
  assert.equal(result.byBand.proaspat, 500);
  assert.equal(result.byBand.vechi, 500, "300 + 200");
  assert.equal(result.total, 1000);
});

test("cea mai veche restanță conduce lista", () => {
  const result = aging(
    [
      job("noua", { end_date: "2026-09-20" }),
      job("veche", { end_date: "2026-05-01" }),
    ],
    [],
    TODAY,
  );
  assert.equal(result.rows[0].job.id, "veche");
  assert.equal(result.oldest, result.rows[0].days);
});

test("plata parțială lasă doar restul", () => {
  const result = aging([job("a")], [payment("a", 750)], TODAY);
  assert.equal(result.rows[0].rest, 250);
});

test("lucrarea neterminată nu e o restanță", () => {
  const result = aging([job("a", { status: "in_progress" })], [], TODAY);
  assert.equal(result.rows.length, 0);
});

test("arhivata și cea ștearsă rămân afară", () => {
  const result = aging(
    [
      job("arhivata", { archived_at: "2026-09-01T00:00:00.000Z" }),
      job("stearsa", { deleted_at: "2026-09-01T00:00:00.000Z" }),
    ],
    [],
    TODAY,
  );
  assert.equal(result.rows.length, 0);
});

test("rotunjirea de sub 50 de bani nu e o datorie", () => {
  const result = aging([job("a")], [payment("a", 999.6)], TODAY);
  assert.equal(result.rows.length, 0);
});

test("plata ștearsă nu mai scade din rest", () => {
  const paid = { ...payment("a", 1000), deleted_at: "2026-09-22T00:00:00.000Z" };
  const result = aging([job("a")], [paid], TODAY);
  assert.equal(result.rows[0].rest, 1000);
});

test("fără dată de sfârșit se cade pe ce există", () => {
  const result = aging(
    [job("a", { end_date: null, start_date: null, scheduled_date: "2026-09-10" })],
    [],
    TODAY,
  );
  assert.equal(result.rows[0].days, 13);
});
