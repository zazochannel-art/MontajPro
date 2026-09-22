/**
 * Testele ajutorului plătit.
 *
 * Cifra asta corectează profitul, deci greșită ar strica exact lucrul pe care
 * ar trebui să-l repare.
 *
 *   node --test tests/crew.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { crewCostForJob, crewLedger, totalOwed } from "../src/lib/crew.ts";
import { jobMoney } from "../src/lib/calc.ts";
import type { Expense, WorkSession } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

function session(patch: Partial<WorkSession> & { id: string }): WorkSession {
  return {
    ...BASE,
    job_id: "j1",
    started_at: "2026-09-01T08:00:00.000Z",
    ended_at: "2026-09-01T16:00:00.000Z",
    duration_minutes: 480,
    note: null,
    by_member_id: null,
    by_member_name: null,
    ...patch,
  };
}

function expense(patch: Partial<Expense> & { id: string }): Expense {
  return {
    ...BASE,
    job_id: null,
    member_id: null,
    category: "other",
    amount: 0,
    spent_at: "2026-09-02",
    note: null,
    receipt_path: null,
    receipt_local_key: null,
    ...patch,
  } as Expense;
}

test("orele ajutorului se transformă în bani, la tariful lui", () => {
  const lines = crewLedger(
    [session({ id: "s1", by_member_id: "vasile", by_member_name: "Vasile", duration_minutes: 480 })],
    [],
    { vasile: 50 },
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].name, "Vasile");
  assert.equal(lines[0].minutes, 480);
  assert.equal(lines[0].earned, 400);
  assert.equal(lines[0].owed, 400);
});

test("munca ta nu se plătește: sesiunile fără om din echipă nu intră", () => {
  const lines = crewLedger([session({ id: "s1" })], [], { vasile: 50 });
  assert.deepEqual(lines, []);
});

test("ce i-ai dat deja scade din ce mai ai de dat", () => {
  const lines = crewLedger(
    [session({ id: "s1", by_member_id: "vasile", duration_minutes: 480 })],
    [expense({ id: "e1", member_id: "vasile", amount: 300 })],
    { vasile: 50 },
  );
  assert.equal(lines[0].earned, 400);
  assert.equal(lines[0].paid, 300);
  assert.equal(lines[0].owed, 100);
});

test("omul fără tarif pus costă zero, nu o cifră ghicită", () => {
  const lines = crewLedger(
    [session({ id: "s1", by_member_id: "necunoscut", duration_minutes: 480 })],
    [],
    {},
  );
  assert.equal(lines[0].earned, 0);
  assert.equal(lines[0].rate, 0);
});

test("banii dați cuiva care n-a pontat nu dispar din socoteală", () => {
  const lines = crewLedger([], [expense({ id: "e1", member_id: "ion", amount: 500 })], {});
  assert.equal(lines.length, 1);
  assert.equal(lines[0].paid, 500);
  assert.equal(lines[0].owed, -500, "i-ai dat în avans");
});

test("cel căruia îi datorezi cel mai mult stă primul", () => {
  const lines = crewLedger(
    [
      session({ id: "s1", by_member_id: "a", duration_minutes: 120 }),
      session({ id: "s2", by_member_id: "b", duration_minutes: 600 }),
    ],
    [],
    { a: 50, b: 50 },
  );
  assert.deepEqual(lines.map((l) => l.member_id), ["b", "a"]);
});

test("totalul neplătit nu scade din cauza unui avans dat altcuiva", () => {
  const lines = crewLedger(
    [session({ id: "s1", by_member_id: "a", duration_minutes: 600 })],
    [expense({ id: "e1", member_id: "b", amount: 1000 })],
    { a: 50 },
  );
  // A are de primit 500; lui B i-ai dat 1000 în avans. Datoria rămâne 500.
  assert.equal(totalOwed(lines), 500);
});

test("costul echipei se numără pe lucrarea la care s-a muncit", () => {
  const sessions = [
    session({ id: "s1", job_id: "j1", by_member_id: "a", duration_minutes: 480 }),
    session({ id: "s2", job_id: "j2", by_member_id: "a", duration_minutes: 480 }),
  ];
  assert.equal(crewCostForJob(sessions, { a: 50 }, "j1"), 400);
  assert.equal(crewCostForJob(sessions, { a: 50 }, "j3"), 0);
});

test("costul echipei intră în profit, manopera ta nu", () => {
  const fara = jobMoney({
    price: 10000,
    payments: [],
    materials: [],
    expenses: [],
    workedMinutes: 600,
  });
  const cu = jobMoney({
    price: 10000,
    payments: [],
    materials: [],
    expenses: [],
    workedMinutes: 600,
    crewCost: 400,
  });
  assert.equal(fara.profit, 10000, "orele tale nu se scad");
  assert.equal(cu.profit, 9600, "orele ajutorului se scad");
  assert.equal(cu.crewCost, 400);
});

test("drumul se scade și el, odată ce știi câți kilometri ai făcut", () => {
  const money = jobMoney({
    price: 5000,
    payments: [],
    materials: [],
    expenses: [],
    travelCost: 250,
  });
  assert.equal(money.profit, 4750);
  assert.equal(money.travelCost, 250);
});
