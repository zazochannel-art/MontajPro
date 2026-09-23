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

/*
 * Lucrarea de mai multe zile, mutată.
 *
 * Verificarea primea lucrarea nemutată și îi schimba doar ziua de început,
 * lăsându-i sfârșitul vechi — în urmă, deci se socotea ca o zi singură și
 * toate orele cădeau pe ziua nouă. O scară de trei zile dădea „24 de ore”
 * pe o zi care avea să aibă opt, și tocmai pentru lucrările lungi, singurele
 * unde socoteala chiar contează.
 */
test("lucrarea de trei zile aduce în ziua nouă doar partea ei", () => {
  const moving = job("scara", {
    scheduled_date: "2026-09-10",
    scheduled_end_date: "2026-09-12",
    estimated_hours: 24,
  });

  const check = checkDay("2026-10-05", [moving], [], moving);

  assert.equal(check.adding, 8, "24 de ore pe trei zile fac 8 pe zi");
  assert.equal(check.full, false, "opt ore într-o zi goală nu o umplu");
});

test("mutată peste o zi care are deja ceva, se adună doar partea", () => {
  const moving = job("scara", {
    scheduled_date: "2026-09-10",
    scheduled_end_date: "2026-09-12",
    estimated_hours: 24,
  });
  const there = job("parchet", {
    scheduled_date: "2026-10-05",
    estimated_hours: 3,
  });

  const check = checkDay("2026-10-05", [moving, there], [], moving);

  assert.equal(check.hours, 3);
  assert.equal(check.adding, 8);
  assert.equal(check.full, true, "3 + 8 trece de o zi de lucru");
});

test("lucrarea de o zi aduce tot ce are", () => {
  const moving = job("plinta", {
    scheduled_date: "2026-09-10",
    estimated_hours: 6,
  });

  const check = checkDay("2026-10-05", [moving], [], moving);
  assert.equal(check.adding, 6);
});

test("mutarea pe o zi din propriul interval nu se numără de două ori", () => {
  const moving = job("scara", {
    scheduled_date: "2026-09-10",
    scheduled_end_date: "2026-09-12",
    estimated_hours: 24,
  });

  const check = checkDay("2026-09-11", [moving], [], moving);
  assert.equal(check.hours, 0, "lucrarea care se mută nu se numără ca fiind deja acolo");
  assert.equal(check.adding, 8);
});
