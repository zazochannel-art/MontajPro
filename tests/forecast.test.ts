/**
 * Testele prognozei.
 *
 * O prognoză optimistă e mai periculoasă decât niciuna: pe baza ei omul se
 * apucă de o lucrare pe care n-o poate finanța. Deci verificăm mai ales ce
 * **nu** intră în ea — banii fără termen și banii numărați de două ori.
 *
 *   node --test tests/forecast.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildForecast } from "../src/lib/forecast.ts";
import type {
  FixedCost,
  Installment,
  Job,
  JobMaterial,
  Payment,
} from "../src/lib/types.ts";

const TODAY = "2026-03-02"; // o luni

function job(patch: Partial<Job> & { id: string }): Job {
  return {
    user_id: "u",
    created_at: `${TODAY}T08:00:00.000Z`,
    updated_at: `${TODAY}T08:00:00.000Z`,
    deleted_at: null,
    synced_at: null,
    client_id: null,
    title: "Lucrare",
    type: "stairs",
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
    ...patch,
  } as Job;
}

function payment(patch: Partial<Payment> & { id: string }): Payment {
  return {
    user_id: "u",
    created_at: `${TODAY}T08:00:00.000Z`,
    updated_at: `${TODAY}T08:00:00.000Z`,
    deleted_at: null,
    synced_at: null,
    job_id: null,
    client_id: null,
    amount: 0,
    kind: "partial",
    method: "cash",
    paid_at: TODAY,
    notes: null,
    ...patch,
  } as Payment;
}

function installment(patch: Partial<Installment> & { id: string }): Installment {
  return {
    user_id: "u",
    created_at: `${TODAY}T08:00:00.000Z`,
    updated_at: `${TODAY}T08:00:00.000Z`,
    deleted_at: null,
    synced_at: null,
    job_id: "j1",
    label: "Tranșă",
    amount: 0,
    due_date: null,
    payment_id: null,
    position: 0,
    ...patch,
  } as Installment;
}

function fixedCost(patch: Partial<FixedCost> & { id: string }): FixedCost {
  return {
    user_id: "u",
    created_at: `${TODAY}T08:00:00.000Z`,
    updated_at: `${TODAY}T08:00:00.000Z`,
    deleted_at: null,
    synced_at: null,
    name: "Chirie",
    amount: 0,
    started_at: "2025-01-05",
    ended_at: null,
    notes: null,
    ...patch,
  } as FixedCost;
}

function material(patch: Partial<JobMaterial> & { id: string }): JobMaterial {
  return {
    user_id: "u",
    created_at: `${TODAY}T08:00:00.000Z`,
    updated_at: `${TODAY}T08:00:00.000Z`,
    deleted_at: null,
    synced_at: null,
    job_id: "j1",
    material_id: null,
    name: "Parchet",
    quantity: 0,
    unit: "m²",
    unit_price: 0,
    purchased: false,
    taken_from_stock: false,
    ...patch,
  } as JobMaterial;
}

function build(input: Partial<Parameters<typeof buildForecast>[0]>) {
  return buildForecast({
    jobs: [],
    payments: [],
    installments: [],
    fixedCosts: [],
    materials: [],
    today: TODAY,
    ...input,
  });
}

test("o lucrare fără dată nu intră în prognoză", () => {
  const result = build({
    jobs: [job({ id: "j1", price_total: 10000, scheduled_date: null, end_date: null })],
  });
  assert.equal(result.income, 0);
});

test("restul unei lucrări intră în săptămâna zilei ei", () => {
  const result = build({
    jobs: [job({ id: "j1", price_total: 10000, scheduled_date: "2026-03-10" })],
    payments: [payment({ id: "p1", job_id: "j1", amount: 4000 })],
  });
  assert.equal(result.income, 6000);
  assert.equal(result.weeks[1].income, 6000);
  assert.equal(result.weeks[0].income, 0);
});

test("scadențarul înlocuiește restul, nu se adună la el", () => {
  const result = build({
    jobs: [job({ id: "j1", price_total: 10000, scheduled_date: "2026-03-10" })],
    installments: [
      installment({ id: "i1", job_id: "j1", amount: 3000, due_date: "2026-03-05" }),
      installment({ id: "i2", job_id: "j1", amount: 7000, due_date: "2026-03-20" }),
    ],
  });
  // 3000 în prima săptămână, 7000 în a treia — și niciun „rest” pe deasupra.
  assert.equal(result.income, 10000);
  assert.equal(result.weeks[0].income, 3000);
  assert.equal(result.weeks[2].income, 7000);
});

test("o tranșă deja încasată nu mai e așteptată", () => {
  const result = build({
    jobs: [job({ id: "j1", price_total: 10000 })],
    installments: [
      installment({ id: "i1", job_id: "j1", amount: 3000, due_date: "2026-03-05", payment_id: "p1" }),
    ],
  });
  assert.equal(result.income, 0);
});

test("o tranșă cu termen trecut e restanță, nu bani viitori", () => {
  const result = build({
    jobs: [job({ id: "j1", price_total: 10000 })],
    installments: [
      installment({ id: "i1", job_id: "j1", amount: 2500, due_date: "2026-02-10" }),
    ],
  });
  assert.equal(result.overdue, 2500);
  assert.equal(result.weeks[0].income, 2500);
  assert.equal(result.weeks[0].incoming[0].overdue, true);
});

test("oferta nu e bani", () => {
  const result = build({
    jobs: [
      job({ id: "j1", status: "quote", price_total: 50000, scheduled_date: "2026-03-10" }),
    ],
  });
  assert.equal(result.income, 0);
});

test("lucrarea arhivată nu mai cere bani", () => {
  const result = build({
    jobs: [
      job({
        id: "j1",
        price_total: 10000,
        scheduled_date: "2026-03-10",
        archived_at: `${TODAY}T08:00:00.000Z`,
      }),
    ],
  });
  assert.equal(result.income, 0);
});

test("cheltuiala fixă cade în fiecare lună, în ziua ei", () => {
  const result = build({
    fixedCosts: [fixedCost({ id: "f1", amount: 2000, started_at: "2025-01-05" })],
    weeks: 8,
  });
  const dates = result.weeks.flatMap((week) => week.outgoing.map((entry) => entry.date));
  assert.deepEqual(dates, ["2026-03-05", "2026-04-05"]);
  assert.equal(result.expense, 4000);
});

test("cheltuiala fixă încheiată nu mai apare", () => {
  const result = build({
    fixedCosts: [
      fixedCost({ id: "f1", amount: 2000, started_at: "2025-01-05", ended_at: "2025-12-31" }),
    ],
  });
  assert.equal(result.expense, 0);
});

test("materialele necumpărate ies din buzunar înainte de lucrare", () => {
  const result = build({
    jobs: [job({ id: "j1", status: "materials", scheduled_date: "2026-03-12" })],
    materials: [
      material({ id: "m1", job_id: "j1", quantity: 40, unit_price: 250 }),
      material({ id: "m2", job_id: "j1", quantity: 10, unit_price: 100, purchased: true }),
    ],
  });
  assert.equal(result.expense, 10000);
  assert.equal(result.weeks[1].outgoing[0].date, "2026-03-12");
});

test("soldul cumulat urmărește diferența, săptămână cu săptămână", () => {
  const result = build({
    jobs: [job({ id: "j1", price_total: 9000, scheduled_date: "2026-03-10" })],
    fixedCosts: [fixedCost({ id: "f1", amount: 2000, started_at: "2025-01-05" })],
  });
  assert.equal(result.weeks[0].cumulative, -2000);
  assert.equal(result.weeks[1].cumulative, 7000);
  assert.equal(result.weeks[3].cumulative, 7000);
  assert.equal(result.net, 7000);
});
