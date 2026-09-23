/**
 * Testele listei de încărcat și ale datoriei furnizorului.
 *
 *   node --test tests/loading.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadingList, supplierDebt } from "../src/lib/loading.ts";
import type { Job, JobMaterial, Material } from "../src/lib/types.ts";

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

let n = 0;
function line(jobId: string, patch: Partial<JobMaterial> = {}): JobMaterial {
  n += 1;
  return {
    ...BASE,
    id: `m${n}`,
    job_id: jobId,
    returned_quantity: 0,
    supplier_return_quantity: 0,
    taken_quantity: null,
    material_id: "parchet",
    name: "Parchet stejar",
    quantity: 10,
    unit: "pachet",
    unit_price: 50,
    purchased: false,
    taken_from_stock: false,
    ...patch,
  };
}

function stock(patch: Partial<Material> = {}): Material {
  return {
    ...BASE,
    id: "parchet",
    name: "Parchet stejar",
    category: null,
    quantity: 20,
    unit: "pachet",
    price: 50,
    supplier: "Supraten",
    notes: null,
    pack_size: null,
    ...patch,
  };
}

const TOMORROW = "2026-09-23";

test("materialul din depozit pentru mâine ajunge pe listă", () => {
  const list = loadingList(
    [job("a", { scheduled_date: TOMORROW })],
    [line("a")],
    [stock()],
    [TOMORROW],
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].available, 20);
  assert.equal(list[0].short, false);
});

test("materialul unei lucrări din altă zi nu se încarcă azi", () => {
  const list = loadingList(
    [job("a", { scheduled_date: "2026-10-01" })],
    [line("a")],
    [stock()],
    [TOMORROW],
  );
  assert.deepEqual(list, []);
});

test("lucrarea de mai multe zile intră dacă atinge ziua", () => {
  const list = loadingList(
    [job("a", { scheduled_date: "2026-09-21", scheduled_end_date: "2026-09-24" })],
    [line("a")],
    [stock()],
    [TOMORROW],
  );
  assert.equal(list.length, 1);
});

test("ce ai cumpărat de la furnizor nu se ia de pe raft", () => {
  const list = loadingList(
    [job("a", { scheduled_date: TOMORROW })],
    [line("a", { purchased: true })],
    [stock()],
    [TOMORROW],
  );
  assert.deepEqual(list, []);
});

test("ce ai scos deja e în mașină, nu pe raft", () => {
  const list = loadingList(
    [job("a", { scheduled_date: TOMORROW })],
    [line("a", { taken_from_stock: true })],
    [stock()],
    [TOMORROW],
  );
  assert.deepEqual(list, []);
});

test("materialul scris de mână n-are de unde ști că e la tine", () => {
  const list = loadingList(
    [job("a", { scheduled_date: TOMORROW })],
    [line("a", { material_id: null })],
    [stock()],
    [TOMORROW],
  );
  assert.deepEqual(list, []);
});

test("ce nu e deloc pe raft ține de lista de cumpărături", () => {
  const list = loadingList(
    [job("a", { scheduled_date: TOMORROW })],
    [line("a")],
    [stock({ quantity: 0 })],
    [TOMORROW],
  );
  assert.deepEqual(list, []);
});

test("raftul care n-are destul se semnalează, dar tot se încarcă", () => {
  const list = loadingList(
    [job("a", { scheduled_date: TOMORROW })],
    [line("a", { quantity: 30 })],
    [stock({ quantity: 12 })],
    [TOMORROW],
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].short, true, "iei ce e, dar știi că lipsește");
});

test("lucrarea în așteptare nu cere să încarci nimic", () => {
  const list = loadingList(
    [job("a", { scheduled_date: TOMORROW, status: "on_hold" })],
    [line("a")],
    [stock()],
    [TOMORROW],
  );
  assert.deepEqual(list, []);
});

test("lista se citește pe zile, cele mai apropiate întâi", () => {
  const list = loadingList(
    [job("tarziu", { scheduled_date: "2026-09-24" }), job("maine", { scheduled_date: TOMORROW })],
    [line("tarziu"), line("maine")],
    [stock()],
    [TOMORROW, "2026-09-24"],
  );
  assert.deepEqual(list.map((row) => row.job.id), ["maine", "tarziu"]);
});

/* ------------------------ datoria furnizorului --------------------- */

test("materialul dus înapoi la furnizor devine bani de recuperat", () => {
  const debt = supplierDebt([line("a", { supplier_return_quantity: 3, unit_price: 50 })]);
  assert.equal(debt.total, 150);
  assert.equal(debt.lines.length, 1);
});

test("fără preț nu e o datorie, e o cantitate", () => {
  const debt = supplierDebt([line("a", { supplier_return_quantity: 3, unit_price: 0 })]);
  assert.deepEqual(debt.lines, []);
  assert.equal(debt.total, 0);
});

test("ce s-a pus înapoi în depozitul tău nu e datoria nimănui", () => {
  const debt = supplierDebt([line("a", { returned_quantity: 5 })]);
  assert.equal(debt.total, 0);
});

test("datoriile se adună și se citesc de la cea mai mare", () => {
  const debt = supplierDebt([
    line("a", { supplier_return_quantity: 1, unit_price: 50 }),
    line("b", { supplier_return_quantity: 4, unit_price: 50 }),
  ]);
  assert.equal(debt.total, 250);
  assert.equal(debt.lines[0].value, 200);
});

test("linia ștearsă nu se mai cere înapoi", () => {
  const debt = supplierDebt([
    line("a", { supplier_return_quantity: 3, deleted_at: "2026-09-10" }),
  ]);
  assert.equal(debt.total, 0);
});
