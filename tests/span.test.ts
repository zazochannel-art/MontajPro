/**
 * Testele lucrării care ține mai multe zile.
 *
 *   node --test tests/span.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hoursOnDay, jobDayCount, jobDays, movedTo, runsOn } from "../src/lib/span.ts";
import type { Job } from "../src/lib/types.ts";

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

test("fără dată de început nu e nimic de întins", () => {
  assert.deepEqual(jobDays(job("a")), []);
});

test("fără dată de sfârșit e o lucrare de o zi", () => {
  assert.deepEqual(jobDays(job("a", { scheduled_date: "2026-09-22" })), ["2026-09-22"]);
});

test("trei zile înseamnă trei zile, capetele incluse", () => {
  const days = jobDays(
    job("a", { scheduled_date: "2026-09-22", scheduled_end_date: "2026-09-24" }),
  );
  assert.deepEqual(days, ["2026-09-22", "2026-09-23", "2026-09-24"]);
  assert.equal(jobDayCount(job("a", { scheduled_date: "2026-09-22", scheduled_end_date: "2026-09-24" })), 3);
});

test("lucrarea trece peste capătul lunii fără să se piardă", () => {
  const days = jobDays(
    job("a", { scheduled_date: "2026-09-29", scheduled_end_date: "2026-10-02" }),
  );
  assert.deepEqual(days, ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
});

test("sfârșitul dinaintea începutului e o greșeală de tastat, nu o lucrare negativă", () => {
  const days = jobDays(
    job("a", { scheduled_date: "2026-09-22", scheduled_end_date: "2026-09-10" }),
  );
  assert.deepEqual(days, ["2026-09-22"]);
});

test("o dată tastată aiurea nu umple memoria", () => {
  const days = jobDays(
    job("a", { scheduled_date: "2026-09-22", scheduled_end_date: "2036-09-22" }),
  );
  assert.equal(days.length, 90, "se plafonează, nu se întinde zece ani");
});

test("orele se împart egal pe zilele lucrării", () => {
  const long = job("a", {
    scheduled_date: "2026-09-22",
    scheduled_end_date: "2026-09-24",
    estimated_hours: 24,
  });
  assert.equal(hoursOnDay(long, "2026-09-22"), 8);
  assert.equal(hoursOnDay(long, "2026-09-23"), 8);
  assert.equal(hoursOnDay(long, "2026-09-24"), 8);
});

test("o zi din afara lucrării nu primește ore", () => {
  const long = job("a", {
    scheduled_date: "2026-09-22",
    scheduled_end_date: "2026-09-24",
    estimated_hours: 24,
  });
  assert.equal(hoursOnDay(long, "2026-09-25"), 0);
});

test("lucrarea fără ore estimate nu inventează ore", () => {
  const long = job("a", {
    scheduled_date: "2026-09-22",
    scheduled_end_date: "2026-09-24",
  });
  assert.equal(hoursOnDay(long, "2026-09-23"), 0);
});

test("împărțirea care nu iese rotund se rotunjește, nu se pierde", () => {
  const long = job("a", {
    scheduled_date: "2026-09-22",
    scheduled_end_date: "2026-09-24",
    estimated_hours: 10,
  });
  assert.equal(hoursOnDay(long, "2026-09-22"), 3.33);
});

test("runsOn spune dacă lucrarea atinge ziua", () => {
  const long = job("a", {
    scheduled_date: "2026-09-22",
    scheduled_end_date: "2026-09-24",
  });
  assert.equal(runsOn(long, "2026-09-23"), true);
  assert.equal(runsOn(long, "2026-09-21"), false);
});

test("mutarea duce durata cu ea", () => {
  const trei = { scheduled_date: "2026-09-10", scheduled_end_date: "2026-09-12" };
  assert.deepEqual(movedTo(trei, "2026-10-05"), {
    scheduled_date: "2026-10-05",
    scheduled_end_date: "2026-10-07",
  });
});

test("lucrarea de o zi rămâne fără sfârșit", () => {
  const una = { scheduled_date: "2026-09-10", scheduled_end_date: null };
  assert.deepEqual(movedTo(una, "2026-10-05"), {
    scheduled_date: "2026-10-05",
    scheduled_end_date: null,
  });
});

test("mutarea peste o lună păstrează numărul de zile", () => {
  const cinci = { scheduled_date: "2026-09-10", scheduled_end_date: "2026-09-14" };
  const mutata = movedTo(cinci, "2026-12-30");
  assert.equal(jobDayCount({ ...cinci, ...mutata }), 5);
  assert.equal(mutata.scheduled_end_date, "2027-01-03", "trece și peste anul nou");
});
