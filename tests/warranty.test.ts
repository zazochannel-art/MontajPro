/**
 * Testele garanției.
 *
 * Întrebarea la care răspunde codul ăsta — „merg pe banii mei sau pe ai lui?”
 * — se pune cu clientul la telefon, deci răspunsul trebuie să fie și corect,
 * și găsibil.
 *
 *   node --test tests/warranty.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeWarranties,
  searchWarranties,
  warrantyCost,
  warrantyRows,
} from "../src/lib/warranty.ts";
import type { Client, Handover, Job } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-01-10T08:00:00.000Z",
  updated_at: "2026-01-10T08:00:00.000Z",
  deleted_at: null,
};

/** Ziua din care privim, ca răspunsul să nu se schimbe de la o zi la alta. */
const NOW = new Date("2026-09-21T10:00:00.000Z");

function handover(patch: Partial<Handover> & { id: string; job_id: string }): Handover {
  return {
    ...BASE,
    client_id: null,
    number: 1,
    handed_at: "2026-01-10T08:00:00.000Z",
    client_name: null,
    client_address: null,
    client_phone: null,
    work_summary: null,
    warranty_months: 24,
    notes: null,
    signature: null,
    signer_name: null,
    signed_at: null,
    public_token: null,
    client_signature_image: null,
    signed_by_client_at: null,
    ...patch,
  };
}

function job(id: string, patch: Partial<Job> = {}): Job {
  return {
    ...BASE,
    id,
    client_id: null,
    project_id: null,
    title: `Lucrare ${id}`,
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
    ...patch,
  };
}

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
    ...patch,
  };
}

test("garanția se numără de la predare, nu de la începerea lucrării", () => {
  const rows = warrantyRows(
    [handover({ id: "h1", job_id: "j1", handed_at: "2026-03-14T09:00:00.000Z", warranty_months: 12 })],
    [job("j1", { title: "Scară stejar" })],
    [],
    NOW,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ends_on, "2027-03-14");
  assert.equal(rows[0].job_title, "Scară stejar");
  assert.equal(rows[0].state, "active");
});

test("ce expiră în mai puțin de o lună e semnalat separat", () => {
  const rows = warrantyRows(
    [handover({ id: "h1", job_id: "j1", handed_at: "2025-10-05T09:00:00.000Z", warranty_months: 12 })],
    [job("j1")],
    [],
    NOW,
  );
  assert.equal(rows[0].state, "expiring");
  assert.ok(rows[0].days_left >= 0 && rows[0].days_left <= 30);
});

test("garanția trecută rămâne în listă, dar marcată ca expirată", () => {
  const rows = warrantyRows(
    [handover({ id: "h1", job_id: "j1", handed_at: "2023-01-10T09:00:00.000Z", warranty_months: 12 })],
    [job("j1")],
    [],
    NOW,
  );
  assert.equal(rows[0].state, "expired");
  assert.ok(rows[0].days_left < 0);
  assert.equal(activeWarranties(rows).length, 0);
});

test("predarea fără termen de garanție nu apare deloc", () => {
  const rows = warrantyRows(
    [handover({ id: "h1", job_id: "j1", warranty_months: null })],
    [job("j1")],
    [],
    NOW,
  );
  assert.deepEqual(rows, []);
});

test("cea mai apropiată de expirare stă prima", () => {
  const rows = warrantyRows(
    [
      handover({ id: "h1", job_id: "j1", handed_at: "2026-08-01T09:00:00.000Z", warranty_months: 24 }),
      handover({ id: "h2", job_id: "j2", handed_at: "2025-01-05T09:00:00.000Z", warranty_months: 24 }),
    ],
    [job("j1"), job("j2")],
    [],
    NOW,
  );
  assert.deepEqual(rows.map((r) => r.handover_id), ["h2", "h1"]);
});

test("se caută după telefon oricum ar fi scris în agendă", () => {
  const rows = warrantyRows(
    [handover({ id: "h1", job_id: "j1", client_id: "c1" })],
    [job("j1")],
    [client("c1", { name: "Ion Popescu", phone: "+373 69 123 456" })],
    NOW,
  );
  assert.equal(searchWarranties(rows, "069123456").length, 1);
  assert.equal(searchWarranties(rows, "123456").length, 1);
  assert.equal(searchWarranties(rows, "popescu").length, 1);
  assert.equal(searchWarranties(rows, "vasile").length, 0);
});

test("numele din agendă bate numele copiat pe hârtie", () => {
  // Omul și-a schimbat numele în agendă după ce s-a semnat procesul-verbal.
  const rows = warrantyRows(
    [handover({ id: "h1", job_id: "j1", client_id: "c1", client_name: "Ion P." })],
    [job("j1")],
    [client("c1", { name: "Ion Popescu" })],
    NOW,
  );
  assert.equal(rows[0].client_name, "Ion Popescu");
});

test("cât te-au costat revenirile se citește din bani, nu dintr-un bifat", () => {
  const cost = warrantyCost([
    job("j1"),
    job("r1", { warranty_of_job_id: "j1", price_total: 0 }),
    job("r2", { warranty_of_job_id: "j1", price_total: 0 }),
    job("r3", { warranty_of_job_id: "j1", price_total: 800 }),
  ]);
  assert.equal(cost.visits, 3);
  assert.equal(cost.free, 2);
  assert.equal(cost.earned, 800);
});

test("o revenire ștearsă nu mai intră la socoteală", () => {
  const cost = warrantyCost([
    job("r1", { warranty_of_job_id: "j1", price_total: 0, deleted_at: "2026-09-01T00:00:00.000Z" }),
  ]);
  assert.equal(cost.visits, 0);
});
