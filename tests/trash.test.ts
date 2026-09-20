/**
 * Testele coșului de gunoi.
 *
 * Restaurarea se bazează pe faptul că tot ce se șterge împreună poartă exact
 * aceeași clipă. Dacă asta se strică, o lucrare restaurată se întoarce fără
 * măsurători și fără plăți — și nimeni nu observă până nu are nevoie de ele.
 *
 *   node --test tests/trash.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { store } from "../src/lib/db/store.ts";
import { trashItems } from "../src/lib/trash.ts";

const USER = "22222222-2222-4222-8222-222222222222";

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
});

test("tot ce se șterge împreună poartă aceeași clipă", async () => {
  const job = await store.insert("jobs", { title: "Scară stejar", type: "stairs" });
  const m1 = await store.insert("job_measurements", { job_id: job.id, kind: "stairs" });
  const p1 = await store.insert("payments", { job_id: job.id, amount: 1000 });

  await store.removeMany([
    { table: "jobs", id: job.id },
    { table: "job_measurements", id: m1.id },
    { table: "payments", id: p1.id },
  ]);

  const stamps = new Set([
    store.getTable("jobs").find((r) => r.id === job.id)?.deleted_at,
    store.getTable("job_measurements").find((r) => r.id === m1.id)?.deleted_at,
    store.getTable("payments").find((r) => r.id === p1.id)?.deleted_at,
  ]);
  assert.equal(stamps.size, 1, "o singură clipă pentru tot grupul");
});

test("coșul arată un singur rând pentru lucrarea cu tot cu copii", async () => {
  const job = await store.insert("jobs", { title: "Parchet living", type: "parquet" });
  const measurement = await store.insert("job_measurements", {
    job_id: job.id,
    kind: "parquet",
  });
  await store.removeMany([
    { table: "jobs", id: job.id },
    { table: "job_measurements", id: measurement.id },
  ]);

  const items = trashItems(30);
  assert.equal(items.length, 1);
  assert.equal(items[0].table, "jobs");
  assert.equal(items[0].title, "Parchet living");
  // Numărul spune câte rânduri se întorc odată cu ea.
  assert.equal(items[0].count, 2);
});

test("restaurarea readuce și copiii, nu doar capul", async () => {
  const job = await store.insert("jobs", { title: "Plinte hol", type: "plinth" });
  const measurement = await store.insert("job_measurements", {
    job_id: job.id,
    kind: "plinth",
  });
  await store.removeMany([
    { table: "jobs", id: job.id },
    { table: "job_measurements", id: measurement.id },
  ]);

  const [item] = trashItems(30);
  const restored = await store.restoreBatch(item.at);

  assert.equal(restored, 2);
  assert.equal(store.getTable("jobs").find((r) => r.id === job.id)?.deleted_at, null);
  assert.equal(
    store.getTable("job_measurements").find((r) => r.id === measurement.id)
      ?.deleted_at,
    null,
  );
  assert.equal(trashItems(30).length, 0);
});

test("o ștergere separată nu se lipește de alt grup", async () => {
  const a = await store.insert("clients", { name: "Ion" });
  const b = await store.insert("clients", { name: "Vasile" });
  await store.remove("clients", a.id);
  await store.remove("clients", b.id);

  const items = trashItems(30);
  assert.equal(items.length, 2, "două ștergeri, două grupuri");

  await store.restoreBatch(items[0].at);
  assert.equal(trashItems(30).length, 1, "restaurarea uneia n-o atinge pe cealaltă");
});

test("ce e mai vechi decât fereastra nu mai apare", async () => {
  const client = await store.insert("clients", { name: "Gheorghe" });
  const old = new Date(Date.now() - 45 * 86_400_000).toISOString();
  await store.update("clients", client.id, { deleted_at: old });

  assert.equal(trashItems(30).length, 0);
  assert.equal(trashItems(60).length, 1);
});
