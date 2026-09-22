/**
 * Testele avertismentelor de zi.
 *
 *   node --test tests/day-guard.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDay, jobsBlockedBy } from "../src/lib/day-guard.ts";
import type { DayBlock, Job } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
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
    scheduled_end_date: null,
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
    assigned_member_id: null,
    ...patch,
  };
}

function block(day: string, reason: string | null = null): DayBlock {
  return { ...BASE, id: `b-${day}`, day, reason };
}

const DAY = "2026-09-22";

test("ziua liberă nu are nimic de semnalat", () => {
  const check = checkDay(DAY, [], [], null);
  assert.equal(check.blocked, false);
  assert.equal(check.jobs.length, 0);
  assert.equal(check.full, false);
});

test("ziua blocată o spune, cu motiv cu tot", () => {
  const check = checkDay(DAY, [], [block(DAY, "Nuntă")], null);
  assert.equal(check.blocked, true);
  assert.equal(check.blockReason, "Nuntă");
});

test("blocajul altei zile nu se amestecă", () => {
  assert.equal(checkDay(DAY, [], [block("2026-09-23")], null).blocked, false);
});

test("blocajul șters nu mai blochează", () => {
  const stale = { ...block(DAY), deleted_at: "2026-09-21" };
  assert.equal(checkDay(DAY, [], [stale], null).blocked, false);
});

test("orele deja programate se adună", () => {
  const check = checkDay(
    DAY,
    [
      job("a", { scheduled_date: DAY, estimated_hours: 4 }),
      job("b", { scheduled_date: DAY, estimated_hours: 3 }),
    ],
    [],
    null,
  );
  assert.equal(check.hours, 7);
  assert.equal(check.jobs.length, 2);
});

test("lucrarea de trei zile aduce doar partea ei de ore în ziua asta", () => {
  const check = checkDay(
    DAY,
    [
      job("lung", {
        scheduled_date: DAY,
        scheduled_end_date: "2026-09-24",
        estimated_hours: 24,
      }),
    ],
    [],
    null,
  );
  assert.equal(check.hours, 8, "nu 24, cum ieșea înainte");
  assert.equal(check.full, false);
});

test("ziua se umple abia cu lucrarea care vine", () => {
  const jobs = [job("a", { scheduled_date: DAY, estimated_hours: 6 })];
  const incoming = job("nou", { estimated_hours: 4 });
  assert.equal(checkDay(DAY, jobs, [], null).full, false);
  assert.equal(checkDay(DAY, jobs, [], incoming).full, true);
});

test("lucrarea care se mută pe aceeași zi nu se numără de două ori", () => {
  const moving = job("a", { scheduled_date: DAY, estimated_hours: 6 });
  const check = checkDay(DAY, [moving], [], moving);
  assert.equal(check.hours, 0, "ea însăși nu e „deja acolo”");
  assert.equal(check.full, false);
});

test("lucrarea terminată nu mai ocupă ziua", () => {
  const check = checkDay(
    DAY,
    [job("a", { scheduled_date: DAY, estimated_hours: 8, status: "done" })],
    [],
    null,
  );
  assert.equal(check.hours, 0);
});

test("lucrarea în așteptare nu mănâncă din zi", () => {
  const check = checkDay(
    DAY,
    [job("a", { scheduled_date: DAY, estimated_hours: 8, status: "on_hold" })],
    [],
    null,
  );
  assert.equal(check.hours, 0, "nu se lucrează la ea, deci nu ocupă ziua");
});

test("lucrarea arhivată nu mai ocupă ziua", () => {
  const check = checkDay(
    DAY,
    [job("a", { scheduled_date: DAY, estimated_hours: 8, archived_at: "2026-09-10" })],
    [],
    null,
  );
  assert.equal(check.hours, 0);
});

test("blocând o zi, se văd lucrările peste care dai", () => {
  const found = jobsBlockedBy(DAY, [
    job("a", { scheduled_date: DAY }),
    job("lung", { scheduled_date: "2026-09-20", scheduled_end_date: "2026-09-23" }),
    job("alta", { scheduled_date: "2026-09-30" }),
  ]);
  assert.deepEqual(
    found.map((row) => row.id).sort(),
    ["a", "lung"],
    "și cea de mai multe zile care trece prin ziua asta",
  );
});
