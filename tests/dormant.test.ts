/**
 * Testele materialului care doarme pe raft.
 *
 *   node --test tests/dormant.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dormantStock } from "../src/lib/dormant.ts";
import type { Job, JobMaterial, Material } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2025-01-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

const TODAY = "2026-09-23";

function stock(id: string, patch: Partial<Material> = {}): Material {
  return {
    ...BASE,
    id,
    name: id,
    category: null,
    quantity: 10,
    unit: "m²",
    price: 100,
    supplier: null,
    notes: null,
    pack_size: null,
    ...patch,
  } as Material;
}

function job(id: string, endDate: string): Job {
  return {
    ...BASE,
    id,
    client_id: null,
    project_id: null,
    title: id,
    type: "parquet",
    status: "done",
    address: null,
    scheduled_date: null,
    scheduled_end_date: null,
    scheduled_time: null,
    estimated_hours: null,
    price_total: 0,
    material_cost: null,
    start_date: null,
    end_date: endDate,
    notes: null,
    archived_at: null,
    in_portfolio: false,
    portfolio_description: null,
    warranty_of_job_id: null,
    material_delivered_at: null,
    travel_km: null,
    public_token: null,
    assigned_member_id: null,
  } as Job;
}

function used(jobId: string, materialId: string | null): JobMaterial {
  return {
    ...BASE,
    id: `${jobId}-${materialId}`,
    job_id: jobId,
    material_id: materialId,
    name: materialId ?? "fără",
    quantity: 1,
    unit: "m²",
    unit_price: 100,
    purchased: false,
    taken_from_stock: true,
    taken_quantity: 1,
    returned_quantity: 0,
    supplier_return_quantity: 0,
  } as JobMaterial;
}

test("materialul folosit luna trecută nu doarme", () => {
  const result = dormantStock(
    [stock("parchet")],
    [used("j1", "parchet")],
    [job("j1", "2026-08-20")],
    TODAY,
  );
  assert.equal(result.lines.length, 0);
});

test("materialul neatins de opt luni doarme", () => {
  const result = dormantStock(
    [stock("parchet")],
    [used("j1", "parchet")],
    [job("j1", "2026-01-20")],
    TODAY,
  );
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].value, 1000, "10 × 100");
  assert.equal(result.lines[0].lastUsed, "2026-01-20");
  assert.equal(result.lines[0].never, false);
});

test("materialul niciodată folosit se numără de când a fost adăugat", () => {
  const result = dormantStock([stock("plinta")], [], [], TODAY);
  assert.equal(result.lines[0].never, true);
  assert.equal(result.lines[0].lastUsed, null);
});

test("cea mai recentă folosire câștigă", () => {
  const result = dormantStock(
    [stock("parchet")],
    [used("vechi", "parchet"), used("nou", "parchet")],
    [job("vechi", "2025-06-01"), job("nou", "2026-09-01")],
    TODAY,
  );
  assert.equal(result.lines.length, 0, "a fost folosit luna asta");
});

test("raftul gol nu doarme, e gol", () => {
  const result = dormantStock([stock("parchet", { quantity: 0 })], [], [], TODAY);
  assert.equal(result.lines.length, 0);
});

test("fără preț nu se poate socoti cât stă", () => {
  const result = dormantStock([stock("parchet", { price: 0 })], [], [], TODAY);
  assert.equal(result.lines.length, 0);
});

test("lista începe cu banii cei mai mulți", () => {
  const result = dormantStock(
    [
      stock("ieftin", { quantity: 2, price: 50 }),
      stock("scump", { quantity: 20, price: 300 }),
    ],
    [],
    [],
    TODAY,
  );
  assert.equal(result.lines[0].material.id, "scump");
  assert.equal(result.total, 6100);
});

test("materialul șters nu mai e pe raft", () => {
  const sters = stock("parchet", { deleted_at: "2026-02-01T00:00:00.000Z" });
  assert.equal(dormantStock([sters], [], [], TODAY).lines.length, 0);
});

test("linia de pe o lucrare ștearsă nu ține materialul treaz", () => {
  const dead = { ...job("j1", "2026-09-01"), deleted_at: "2026-09-02T00:00:00.000Z" };
  const result = dormantStock([stock("parchet")], [used("j1", "parchet")], [dead], TODAY);
  assert.equal(result.lines.length, 1, "ultima folosire adevărată nu există");
});

test("pragul de luni se poate schimba", () => {
  const stock12 = dormantStock(
    [stock("parchet")],
    [used("j1", "parchet")],
    [job("j1", "2026-01-20")],
    TODAY,
    12,
  );
  assert.equal(stock12.lines.length, 0, "la 12 luni, opt nu e destul");
});
