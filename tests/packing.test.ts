/**
 * Testele listei de scule.
 *
 *   node --test tests/packing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jobTypesOf, packList } from "../src/lib/packing.ts";
import type { Job, JobType, Tool } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

function tool(name: string, types: JobType[], patch: Partial<Tool> = {}): Tool {
  return {
    ...BASE,
    id: name,
    job_types: types,
    name,
    brand: null,
    model: null,
    price: null,
    purchased_at: null,
    warranty_months: null,
    notes: null,
    photo_path: null,
    photo_local_key: null,
    ...patch,
  };
}

function job(id: string, type: JobType, patch: Partial<Job> = {}): Job {
  return {
    ...BASE,
    id,
    client_id: null,
    project_id: null,
    title: id,
    type,
    status: "confirmed",
    address: null,
    scheduled_date: "2026-09-22",
    scheduled_time: null,
    estimated_hours: 4,
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

test("tipurile zilei se strâng o singură dată", () => {
  const types = jobTypesOf([
    job("a", "parquet"),
    job("b", "parquet"),
    job("c", "stairs"),
  ]);
  assert.deepEqual([...types].sort(), ["parquet", "stairs"]);
});

test("lucrarea ștearsă nu cere scule", () => {
  assert.deepEqual(jobTypesOf([job("a", "stairs", { deleted_at: "2026-09-02" })]), []);
});

test("intră doar sculele legate de ce ai azi", () => {
  const list = packList(
    [
      tool("Freză", ["stairs"]),
      tool("Ferăstrău", ["parquet", "plinth"]),
      tool("Polizor", ["other"]),
    ],
    [job("a", "parquet")],
  );
  assert.deepEqual(
    list.tools.map((item) => item.name),
    ["Ferăstrău"],
  );
});

test("o sculă bună la două lucrări se ia o singură dată", () => {
  const list = packList(
    [tool("Ferăstrău", ["parquet", "plinth"])],
    [job("a", "parquet"), job("b", "plinth")],
  );
  assert.equal(list.tools.length, 1);
});

test("sculele fără tip nu se listează, dar se numără", () => {
  const list = packList(
    [tool("Freză", ["stairs"]), tool("Nivelă", [])],
    [job("a", "stairs")],
  );
  assert.deepEqual(
    list.tools.map((item) => item.name),
    ["Freză"],
  );
  assert.equal(list.untagged, 1, "ca să știi că mai ai ce eticheta");
});

test("scula ștearsă nu se ia și nu se numără", () => {
  const list = packList(
    [tool("Freză", ["stairs"], { deleted_at: "2026-09-02" }), tool("Nivelă", [], { deleted_at: "2026-09-02" })],
    [job("a", "stairs")],
  );
  assert.equal(list.tools.length, 0);
  assert.equal(list.untagged, 0);
});

test("lista se citește alfabetic, cu diacritice la locul lor", () => {
  const list = packList(
    [tool("Șpaclu", ["parquet"]), tool("Aspirator", ["parquet"]), tool("Nivelă", ["parquet"])],
    [job("a", "parquet")],
  );
  assert.deepEqual(
    list.tools.map((item) => item.name),
    ["Aspirator", "Nivelă", "Șpaclu"],
  );
});

test("ziua fără lucrări nu cere nimic", () => {
  const list = packList([tool("Freză", ["stairs"])], []);
  assert.deepEqual(list.tools, []);
  assert.deepEqual(list.types, []);
});
