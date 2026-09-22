/**
 * Testele întrebării „de unde vine treaba?”.
 *
 *   node --test tests/sources.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { topReferrers, totalsBySource } from "../src/lib/sources.ts";
import type { Client, Job, Payment } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-01-10T08:00:00.000Z",
  updated_at: "2026-01-10T08:00:00.000Z",
  deleted_at: null,
};

function client(id: string, patch: Partial<Client> = {}): Client {
  return {
    ...BASE,
    id,
    name: `Client ${id}`,
    phone: null,
    email: null,
    address: null,
    notes: null,
    source: null,
    referred_by_client_id: null,
    price_adjust: 0,
    addresses: [],
    ...patch,
  };
}

function job(id: string, clientId: string | null): Job {
  return {
    ...BASE,
    id,
    client_id: clientId,
    project_id: null,
    title: id,
    type: "stairs",
    status: "done",
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
  };
}

function payment(id: string, patch: Partial<Payment>): Payment {
  return {
    ...BASE,
    id,
    job_id: null,
    client_id: null,
    amount: 0,
    kind: "final",
    method: "cash",
    paid_at: "2026-02-01",
    note: null,
    ...patch,
  };
}

test("banii se pun în dreptul canalului prin care a venit omul", () => {
  const clients = [
    client("c1", { source: "recommendation" }),
    client("c2", { source: "social" }),
  ];
  const jobs = [job("j1", "c1"), job("j2", "c2")];
  const payments = [
    payment("p1", { job_id: "j1", amount: 12000 }),
    payment("p2", { job_id: "j2", amount: 3000 }),
  ];

  const totals = totalsBySource(clients, jobs, payments);
  assert.equal(totals[0].source, "recommendation");
  assert.equal(totals[0].earned, 12000);
  assert.equal(totals[0].jobs, 1);
  assert.equal(totals[1].source, "social");
});

test("plata legată direct de client se numără la fel ca cea de pe lucrare", () => {
  const totals = totalsBySource(
    [client("c1", { source: "ad" })],
    [],
    [payment("p1", { client_id: "c1", amount: 500 })],
  );
  assert.equal(totals[0].earned, 500);
});

test("clientul fără sursă notată nu dispare, ci intră la „nu știu”", () => {
  const totals = totalsBySource(
    [client("c1")],
    [job("j1", "c1")],
    [payment("p1", { job_id: "j1", amount: 900 })],
  );
  assert.equal(totals[0].source, "unknown");
  assert.equal(totals[0].earned, 900);
});

test("cine recomandă e numărat după banii aduși de oamenii lui", () => {
  const clients = [
    client("gigi", { name: "Gigi" }),
    client("c1", { source: "recommendation", referred_by_client_id: "gigi" }),
    client("c2", { source: "recommendation", referred_by_client_id: "gigi" }),
  ];
  const jobs = [job("j1", "c1"), job("j2", "c2")];
  const payments = [
    payment("p1", { job_id: "j1", amount: 10000 }),
    payment("p2", { job_id: "j2", amount: 5000 }),
  ];

  const referrers = topReferrers(clients, jobs, payments);
  assert.equal(referrers.length, 1);
  assert.equal(referrers[0].name, "Gigi");
  assert.equal(referrers[0].sent, 2);
  // Banii lui Gigi sunt ce au plătit cei trimiși de el, nu ce a plătit el.
  assert.equal(referrers[0].earned, 15000);
});

test("recomandarea de la cineva șters din agendă nu se numără", () => {
  const referrers = topReferrers(
    [
      client("gigi", { deleted_at: "2026-05-01T00:00:00.000Z" }),
      client("c1", { source: "recommendation", referred_by_client_id: "gigi" }),
    ],
    [],
    [],
  );
  assert.deepEqual(referrers, []);
});
