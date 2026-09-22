/**
 * Testele capacității pe săptămână.
 *
 *   node --test tests/capacity.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { weekLoad, weekStart } from "../src/lib/capacity.ts";
import type { DayBlock, Job } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

function job(id: string, date: string | null, hours: number, patch: Partial<Job> = {}): Job {
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
    scheduled_time: null,
    estimated_hours: hours,
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

function block(day: string, reason: string | null = null): DayBlock {
  return { ...BASE, id: `b-${day}`, day, reason };
}

// Marți, 22 septembrie 2026. Săptămâna începe luni, pe 21.
const TUESDAY = new Date(2026, 8, 22, 10, 0, 0);

test("săptămâna începe luni, nu duminică", () => {
  assert.equal(weekStart(TUESDAY).getDate(), 21);
  assert.equal(weekStart(new Date(2026, 8, 27)).getDate(), 21, "și duminica ține de săptămâna care trece");
});

test("orele programate se adună pe toată săptămâna", () => {
  const load = weekLoad(
    [job("a", "2026-09-22", 6), job("b", "2026-09-23", 8)],
    [],
    TUESDAY,
  );
  assert.equal(load.hours, 14);
  assert.equal(load.available, 40);
  assert.equal(load.free, 26);
});

test("ziua blocată scade din cât ai de lucru, nu din cât ai promis", () => {
  const load = weekLoad([job("a", "2026-09-22", 6)], [block("2026-09-23", "Nuntă")], TUESDAY);
  assert.equal(load.hours, 6);
  assert.equal(load.available, 32, "o zi mai puțin din cinci");
  assert.equal(load.free, 26);
  assert.ok(load.days.find((d) => d.day === "2026-09-23")?.blocked);
  assert.equal(load.days.find((d) => d.day === "2026-09-23")?.blockReason, "Nuntă");
});

test("zilele libere sunt cele fără lucrări și neblocate", () => {
  const load = weekLoad(
    [job("a", "2026-09-21", 8), job("b", "2026-09-22", 8)],
    [block("2026-09-23")],
    TUESDAY,
  );
  assert.deepEqual(load.freeDays, ["2026-09-24", "2026-09-25"]);
});

test("promis peste ce ai: rămâne negativ, ca să se vadă", () => {
  const load = weekLoad(
    [job("a", "2026-09-21", 20), job("b", "2026-09-22", 30)],
    [],
    TUESDAY,
  );
  assert.equal(load.free, -10);
});

test("lucrarea finalizată sau arhivată nu mai ocupă ziua", () => {
  const load = weekLoad(
    [
      job("a", "2026-09-22", 8, { status: "done" }),
      job("b", "2026-09-22", 8, { archived_at: "2026-09-01T00:00:00.000Z" }),
    ],
    [],
    TUESDAY,
  );
  assert.equal(load.hours, 0);
  assert.ok(load.freeDays.includes("2026-09-22"));
});

test("sâmbăta se poate lucra, dacă spui că lucrezi șase zile", () => {
  const load = weekLoad([job("a", "2026-09-26", 8)], [], TUESDAY, 8, 6);
  assert.equal(load.available, 48);
  assert.equal(load.hours, 8);
});
