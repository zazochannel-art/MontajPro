/**
 * Testele întârzierii la client.
 *
 *   node --test tests/lateness.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lateness } from "../src/lib/lateness.ts";
import type { Job, WorkSession } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

function job(id: string, date: string | null, time: string | null): Job {
  return {
    ...BASE,
    id,
    client_id: null,
    project_id: null,
    title: id,
    type: "parquet",
    status: "confirmed",
    address: null,
    scheduled_date: date,
    scheduled_end_date: null,
    scheduled_time: time,
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
    assigned_member_id: null,
  };
}

let n = 0;
/** Ora se dă locală, fiindcă „ora 9” e locală și pe ceasul clientului. */
function session(jobId: string, day: string, hour: number, minute: number): WorkSession {
  n += 1;
  const started = new Date(`${day}T00:00:00`);
  started.setHours(hour, minute, 0, 0);
  return {
    ...BASE,
    id: `s${n}`,
    job_id: jobId,
    by_member_id: null,
    started_at: started.toISOString(),
    ended_at: null,
    note: null,
  } as WorkSession;
}

test("ajuns la fix înseamnă la timp", () => {
  const result = lateness([job("a", "2026-09-22", "09:00")], [session("a", "2026-09-22", 9, 0)]);
  assert.equal(result?.average, 0);
  assert.equal(result?.onTime, 1);
});

test("întârzierea se dă în minute", () => {
  const result = lateness([job("a", "2026-09-22", "09:00")], [session("a", "2026-09-22", 9, 40)]);
  assert.equal(result?.average, 40);
  assert.equal(result?.worst, 40);
  assert.equal(result?.onTime, 0);
});

test("ajuns mai devreme dă minute negative", () => {
  const result = lateness([job("a", "2026-09-22", "09:00")], [session("a", "2026-09-22", 8, 45)]);
  assert.equal(result?.average, -15);
  assert.equal(result?.onTime, 1);
});

test("media se face peste toate lucrările cu oră promisă", () => {
  const result = lateness(
    [job("a", "2026-09-22", "09:00"), job("b", "2026-09-23", "08:00")],
    [session("a", "2026-09-22", 9, 30), session("b", "2026-09-23", 8, 10)],
  );
  assert.equal(result?.jobs, 2);
  assert.equal(result?.average, 20);
  assert.equal(result?.worst, 30);
});

test("a doua pornire din zi e o reluare după pauză, nu o sosire", () => {
  const result = lateness(
    [job("a", "2026-09-22", "09:00")],
    [session("a", "2026-09-22", 13, 0), session("a", "2026-09-22", 9, 10)],
  );
  assert.equal(result?.average, 10, "se ia prima, oricum ar fi scrise");
});

test("sesiunea din altă zi nu spune nimic despre oră", () => {
  const result = lateness(
    [job("a", "2026-09-22", "09:00")],
    [session("a", "2026-09-25", 9, 0)],
  );
  assert.equal(result, null, "atunci ziua a fost problema, nu ora");
});

test("lucrarea fără oră promisă nu intră la socoteală", () => {
  assert.equal(lateness([job("a", "2026-09-22", null)], [session("a", "2026-09-22", 9, 0)]), null);
});

test("lucrarea fără sesiune nu intră la socoteală", () => {
  assert.equal(lateness([job("a", "2026-09-22", "09:00")], []), null);
});

test("sesiunea ștearsă nu se numără", () => {
  const dead = { ...session("a", "2026-09-22", 9, 40), deleted_at: "2026-09-23" };
  assert.equal(lateness([job("a", "2026-09-22", "09:00")], [dead]), null);
});

test("o oră scrisă aiurea nu dărâmă socoteala", () => {
  assert.equal(lateness([job("a", "2026-09-22", "25:99")], [session("a", "2026-09-22", 9, 0)]), null);
});

test("fără nicio lucrare potrivită, nu se inventează o cifră", () => {
  assert.equal(lateness([], []), null);
});
