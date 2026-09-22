/**
 * Testele ceasului de aclimatizare.
 *
 *   node --test tests/acclimatization.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_HOURS,
  acclimatizationFor,
  waitingJobs,
} from "../src/lib/acclimatization.ts";
import type { Job } from "../src/lib/types.ts";

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
    title: id,
    type: "parquet",
    status: "confirmed",
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
    scheduled_end_date: null,
    public_token: null,
    assigned_member_id: null,
    ...patch,
  };
}

test("ceasul pornește de la livrare și se oprește după orele cerute", () => {
  const state = acclimatizationFor(
    { material_delivered_at: "2026-09-21T10:00:00.000Z" },
    48,
    new Date("2026-09-22T10:00:00.000Z"),
  );
  assert.equal(state?.readyAt.toISOString(), "2026-09-23T10:00:00.000Z");
  assert.equal(state?.hoursLeft, 24);
  assert.equal(state?.ready, false);
});

test("după trecerea orelor, se poate monta", () => {
  const state = acclimatizationFor(
    { material_delivered_at: "2026-09-21T10:00:00.000Z" },
    48,
    new Date("2026-09-23T11:00:00.000Z"),
  );
  assert.equal(state?.ready, true);
  assert.equal(state?.hoursLeft, 0);
});

test("fără livrare notată nu există niciun ceas", () => {
  assert.equal(acclimatizationFor({ material_delivered_at: null }), null);
  assert.equal(acclimatizationFor({ material_delivered_at: "nu e o dată" }), null);
});

test("zero ore înseamnă „fără așteptare”, nu o dată în trecut", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");
  const state = acclimatizationFor(
    { material_delivered_at: "2026-09-21T10:00:00.000Z" },
    0,
    now,
  );
  assert.equal(state?.ready, true);
  assert.equal(state?.readyAt.toISOString(), "2026-09-21T10:00:00.000Z");
});

test("ore negative din setări nu întorc ceasul înapoi", () => {
  const state = acclimatizationFor(
    { material_delivered_at: "2026-09-21T10:00:00.000Z" },
    -20,
    new Date("2026-09-21T10:30:00.000Z"),
  );
  assert.equal(state?.readyAt.toISOString(), "2026-09-21T10:00:00.000Z");
});

test("lucrarea finalizată nu mai așteaptă nimic", () => {
  const rows = waitingJobs(
    [
      job("a", { material_delivered_at: "2026-09-21T10:00:00.000Z" }),
      job("b", { material_delivered_at: "2026-09-21T10:00:00.000Z", status: "done" }),
    ],
    48,
    new Date("2026-09-22T10:00:00.000Z"),
  );
  assert.deepEqual(rows.map((r) => r.job.id), ["a"]);
});

test("cea care se eliberează prima stă în capul listei", () => {
  const rows = waitingJobs(
    [
      job("tarziu", { material_delivered_at: "2026-09-22T10:00:00.000Z" }),
      job("devreme", { material_delivered_at: "2026-09-21T10:00:00.000Z" }),
    ],
    48,
    new Date("2026-09-22T12:00:00.000Z"),
  );
  assert.deepEqual(rows.map((r) => r.job.id), ["devreme", "tarziu"]);
});

test("valoarea implicită e cea obișnuită pentru parchet", () => {
  assert.equal(DEFAULT_HOURS, 48);
});
