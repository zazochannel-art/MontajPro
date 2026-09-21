/**
 * Testele jurnalului de ciocniri.
 *
 * Regula „ce e netrimis câștigă" rămâne neatinsă — asta verificăm întâi.
 * Restul testelor apără promisiunea nouă: versiunea care pierde nu dispare.
 *
 *   node --test tests/conflicts.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { store } from "../src/lib/db/store.ts";
import {
  applyConflict,
  conflictsSettled,
  clearConflicts,
  dismissConflict,
  listConflicts,
  recordConflict,
} from "../src/lib/conflicts.ts";
import type { Client } from "../src/lib/types.ts";

const USER = "77777777-7777-4777-8777-777777777777";

function jobRow(id: string, patch: Record<string, unknown>) {
  return {
    id,
    user_id: USER,
    created_at: "2026-03-01T08:00:00.000Z",
    updated_at: "2026-03-01T08:00:00.000Z",
    deleted_at: null,
    title: "Scară",
    type: "stairs",
    status: "confirmed",
    price_total: 0,
    ...patch,
  } as never;
}

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
  await clearConflicts();
  store.onRemoteDiscarded = (table, remote, local) => {
    void recordConflict(table, remote, local);
  };
});

test("rândul netrimis nu se șterge de la distanță", async () => {
  const job = await store.insert("jobs", { title: "Scară", type: "stairs", price_total: 100 });

  await store.applyRemote("jobs", [
    jobRow(job.id, { price_total: 999, updated_at: "2030-01-01T00:00:00.000Z" }),
  ]);

  const live = store.getTable("jobs").find((row) => row.id === job.id);
  assert.equal(live?.price_total, 100);
});

test("versiunea de pe server ajunge în jurnal, nu la gunoi", async () => {
  const job = await store.insert("jobs", { title: "Scară", type: "stairs", price_total: 100 });

  await store.applyRemote("jobs", [
    jobRow(job.id, { price_total: 999, updated_at: "2030-01-01T00:00:00.000Z" }),
  ]);

  await conflictsSettled();
  const conflicts = await listConflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].table, "jobs");
  assert.equal(conflicts[0].id, job.id);
  assert.ok(conflicts[0].fields.includes("price_total"));
});

test("un rând identic nu e o ciocnire", async () => {
  const job = await store.insert("jobs", { title: "Scară", type: "stairs", price_total: 100 });
  const same = store.getTable("jobs").find((row) => row.id === job.id);
  assert.ok(same);

  await store.applyRemote("jobs", [same]);
  await conflictsSettled();
  assert.deepEqual(await listConflicts(), []);
});

test("versiunea de pe celălalt telefon se poate lua înapoi", async () => {
  const job = await store.insert("jobs", { title: "Scară", type: "stairs", price_total: 100 });

  await store.applyRemote("jobs", [
    jobRow(job.id, {
      price_total: 999,
      title: "Scară stejar",
      updated_at: "2030-01-01T00:00:00.000Z",
    }),
  ]);

  await conflictsSettled();
  assert.equal(await applyConflict("jobs", job.id), true);

  const live = store.getTable("jobs").find((row) => row.id === job.id);
  assert.equal(live?.price_total, 999);
  assert.equal(live?.title, "Scară stejar");
  // Ciocnirea rezolvată iese din listă.
  await conflictsSettled();
  assert.deepEqual(await listConflicts(), []);
});

test("luarea nu strică cronologia rândului local", async () => {
  const job = await store.insert("jobs", { title: "Scară", type: "stairs" });
  const before = store.getTable("jobs").find((row) => row.id === job.id)?.created_at;

  await store.applyRemote("jobs", [
    jobRow(job.id, {
      title: "Altceva",
      created_at: "1999-01-01T00:00:00.000Z",
      updated_at: "2030-01-01T00:00:00.000Z",
    }),
  ]);
  await conflictsSettled();
  await applyConflict("jobs", job.id);

  const live = store.getTable("jobs").find((row) => row.id === job.id);
  assert.equal(live?.created_at, before);
  assert.ok(live && live.updated_at > "2026-01-01");
});

test("o ciocnire ignorată dispare din listă", async () => {
  const job = await store.insert("jobs", { title: "Scară", type: "stairs", price_total: 1 });
  await store.applyRemote("jobs", [
    jobRow(job.id, { price_total: 7, updated_at: "2030-01-01T00:00:00.000Z" }),
  ]);

  await conflictsSettled();
  await dismissConflict("jobs", job.id);
  await conflictsSettled();
  assert.deepEqual(await listConflicts(), []);

  // Rândul local rămâne cum era: a ignora nu înseamnă a schimba.
  const live = store.getTable("jobs").find((row) => row.id === job.id);
  assert.equal(live?.price_total, 1);
});

test("a doua ciocnire pe același rând o înlocuiește pe prima", async () => {
  const client: Partial<Client> = { name: "Ion" };
  const row = await store.insert("clients", client as never);

  for (const name of ["Ion P.", "Ion Popescu"]) {
    await store.applyRemote("clients", [
      {
        id: row.id,
        user_id: USER,
        created_at: "2026-03-01T08:00:00.000Z",
        updated_at: "2030-01-01T00:00:00.000Z",
        deleted_at: null,
        name,
      } as never,
    ]);
  }

  await conflictsSettled();
  const conflicts = await listConflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].remote.name, "Ion Popescu");
});
