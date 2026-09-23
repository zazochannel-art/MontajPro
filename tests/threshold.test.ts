/**
 * Testele pragului zilei.
 *
 *   node --test tests/threshold.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayThreshold, workDaysOf } from "../src/lib/threshold.ts";
import type { DayBlock, FixedCost } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-01-01T08:00:00.000Z",
  updated_at: "2026-01-01T08:00:00.000Z",
  deleted_at: null,
};

function cost(id: string, amount: number, patch: Partial<FixedCost> = {}): FixedCost {
  return {
    ...BASE,
    id,
    name: id,
    amount,
    started_at: "2026-01-01",
    ended_at: null,
    notes: null,
    ...patch,
  } as FixedCost;
}

function block(day: string): DayBlock {
  return { ...BASE, id: `b-${day}`, day, reason: null } as DayBlock;
}

test("septembrie 2026 are 22 de zile lucrătoare", () => {
  assert.equal(workDaysOf("2026-09").length, 22);
});

test("weekendurile nu intră", () => {
  const days = workDaysOf("2026-09");
  // 5 și 6 septembrie 2026 sunt sâmbătă și duminică.
  assert.ok(!days.includes("2026-09-05"));
  assert.ok(!days.includes("2026-09-06"));
  assert.ok(days.includes("2026-09-07"));
});

test("luna care începe în weekend nu pierde nicio zi", () => {
  // 1 august 2026 e sâmbătă; luna are 31 de zile și 21 lucrătoare.
  assert.equal(workDaysOf("2026-08").length, 21);
  assert.equal(workDaysOf("2026-02").length, 20, "februarie fără an bisect");
});

test("pragul împarte fixul la zilele lucrătoare", () => {
  const result = dayThreshold([cost("chirie", 4400)], [], "2026-09");
  assert.ok(result);
  assert.equal(result.days, 22);
  assert.equal(result.perDay, 200);
});

test("zilele blocate urcă pragul", () => {
  const blocks = [block("2026-09-07"), block("2026-09-08")];
  const result = dayThreshold([cost("chirie", 4400)], blocks, "2026-09");
  assert.ok(result);
  assert.equal(result.blocked, 2);
  assert.equal(result.days, 20);
  assert.equal(result.perDay, 220, "aceeași chirie, două zile mai puține");
});

test("blocajul pe weekend nu schimbă nimic", () => {
  const result = dayThreshold([cost("chirie", 4400)], [block("2026-09-05")], "2026-09");
  assert.ok(result);
  assert.equal(result.blocked, 0);
  assert.equal(result.perDay, 200);
});

test("blocajul șters nu mai contează", () => {
  const dead = { ...block("2026-09-07"), deleted_at: "2026-09-06T00:00:00.000Z" };
  const result = dayThreshold([cost("chirie", 4400)], [dead], "2026-09");
  assert.equal(result?.days, 22);
});

test("fără cheltuieli fixe nu există prag", () => {
  assert.equal(dayThreshold([], [], "2026-09"), null);
});

test("cheltuiala încheiată nu mai intră în prag", () => {
  const vechi = cost("leasing", 3000, { ended_at: "2026-06-30" });
  assert.equal(dayThreshold([vechi], [], "2026-09"), null);
});

test("o lună blocată în întregime pune tot pe o zi", () => {
  const blocks = workDaysOf("2026-09").map(block);
  const result = dayThreshold([cost("chirie", 4400)], blocks, "2026-09");
  assert.equal(result?.days, 1);
  assert.equal(result?.perDay, 4400);
});

test("mai multe cheltuieli se adună", () => {
  const result = dayThreshold(
    [cost("chirie", 3300), cost("telefon", 1100)],
    [],
    "2026-09",
  );
  assert.equal(result?.fixed, 4400);
  assert.equal(result?.perDay, 200);
});
