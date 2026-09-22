/**
 * Testele istoricului de plată.
 *
 *   node --test tests/punctuality.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { punctuality } from "../src/lib/punctuality.ts";
import type { Installment, Payment } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-01-01T08:00:00.000Z",
  updated_at: "2026-01-01T08:00:00.000Z",
  deleted_at: null,
};

const TODAY = "2026-09-22";
const MINE = new Set(["job-1", "job-2"]);

let n = 0;
function plan(
  due: string | null,
  paymentId: string | null,
  amount = 1000,
  patch: Partial<Installment> = {},
): Installment {
  n += 1;
  return {
    ...BASE,
    id: `t${n}`,
    job_id: "job-1",
    label: `Tranșa ${n}`,
    amount,
    due_date: due,
    payment_id: paymentId,
    position: n,
    ...patch,
  };
}

function paid(id: string, at: string, patch: Partial<Payment> = {}): Payment {
  return {
    ...BASE,
    id,
    job_id: "job-1",
    client_id: "c1",
    amount: 1000,
    kind: "partial",
    method: "cash",
    paid_at: at,
    note: null,
    ...patch,
  };
}

test("plata în ziua scadenței e la timp, nu întârziată", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1")],
    [paid("p1", "2026-03-10T16:00:00.000Z")],
    MINE,
    TODAY,
  );
  assert.equal(result.onTime, 1);
  assert.equal(result.late, 0);
});

test("plata mai devreme e tot la timp", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1")],
    [paid("p1", "2026-03-02")],
    MINE,
    TODAY,
  );
  assert.equal(result.onTime, 1);
  assert.equal(result.worstDelay, 0);
});

test("întârzierea se numără în zile întregi", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1")],
    [paid("p1", "2026-03-21")],
    MINE,
    TODAY,
  );
  assert.equal(result.late, 1);
  assert.equal(result.averageDelay, 11);
  assert.equal(result.worstDelay, 11);
});

test("media se face doar peste tranșele întârziate", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1"), plan("2026-04-10", "p2"), plan("2026-05-10", "p3")],
    [
      paid("p1", "2026-03-10"),
      paid("p2", "2026-04-20"), // 10 zile
      paid("p3", "2026-05-30"), // 20 zile
    ],
    MINE,
    TODAY,
  );
  assert.equal(result.onTime, 1);
  assert.equal(result.late, 2);
  assert.equal(result.averageDelay, 15, "media întârzierilor, nu a tuturor tranșelor");
  assert.equal(result.worstDelay, 20);
});

test("tranșa scadentă și neplătită e restanță, nu întârziere", () => {
  const result = punctuality([plan("2026-08-01", null, 2500)], [], MINE, TODAY);
  assert.equal(result.overdue, 1);
  assert.equal(result.overdueAmount, 2500);
  assert.equal(result.late, 0, "n-a plătit încă; nu știm cu cât întârzie");
});

test("tranșa cu scadență în viitor nu e restanță", () => {
  const result = punctuality([plan("2026-12-01", null)], [], MINE, TODAY);
  assert.equal(result.overdue, 0);
});

test("tranșa fără scadență n-a întârziat niciodată", () => {
  const result = punctuality(
    [plan(null, "p1")],
    [paid("p1", "2026-03-21")],
    MINE,
    TODAY,
  );
  assert.equal(result.onTime, 0);
  assert.equal(result.late, 0);
});

test("tranșele altui client nu intră la socoteală", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1", 1000, { job_id: "job-strain" })],
    [paid("p1", "2026-04-30")],
    MINE,
    TODAY,
  );
  assert.equal(result.late, 0);
});

test("tranșa ștearsă nu se numără", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1", 1000, { deleted_at: "2026-03-11" })],
    [paid("p1", "2026-03-30")],
    MINE,
    TODAY,
  );
  assert.equal(result.late, 0);
});

test("plata ștearsă lasă tranșa neplătită", () => {
  const result = punctuality(
    [plan("2026-08-01", "p1", 800)],
    [paid("p1", "2026-08-02", { deleted_at: "2026-08-03" })],
    MINE,
    TODAY,
  );
  assert.equal(result.late, 0);
  assert.equal(result.overdue, 1, "banii n-au venit, deci scadența e depășită");
});

test("verdictul nu se dă din două tranșe", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1"), plan("2026-04-10", "p2")],
    [paid("p1", "2026-03-30"), paid("p2", "2026-04-30")],
    MINE,
    TODAY,
  );
  assert.equal(result.late, 2);
  assert.equal(result.verdict, "necunoscut", "două întârzieri pot fi o lună proastă");
});

test("trei tranșe la timp înseamnă un om bun de plată", () => {
  const result = punctuality(
    [plan("2026-03-10", "p1"), plan("2026-04-10", "p2"), plan("2026-05-10", "p3")],
    [paid("p1", "2026-03-09"), paid("p2", "2026-04-10"), paid("p3", "2026-05-08")],
    MINE,
    TODAY,
  );
  assert.equal(result.verdict, "bun");
});

test("mai mult de jumătate întârziate înseamnă om greu", () => {
  const result = punctuality(
    [
      plan("2026-03-10", "p1"),
      plan("2026-04-10", "p2"),
      plan("2026-05-10", "p3"),
      plan("2026-06-10", "p4"),
    ],
    [
      paid("p1", "2026-03-20"),
      paid("p2", "2026-04-25"),
      paid("p3", "2026-05-30"),
      paid("p4", "2026-06-10"),
    ],
    MINE,
    TODAY,
  );
  assert.equal(result.verdict, "greu");
});

test("clientul fără nicio tranșă nu primește verdict", () => {
  const result = punctuality([], [], MINE, TODAY);
  assert.equal(result.verdict, "necunoscut");
  assert.equal(result.onTime, 0);
});
