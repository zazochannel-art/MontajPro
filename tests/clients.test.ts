/**
 * Testele clientului dublat.
 *
 * Unirea mută tot ce ține de un om pe o singură fișă. Dacă greșește, plățile
 * ajung la cineva care nu le-a făcut — deci e verificată pe fiecare tabel
 * care poartă un client, nu doar pe lucrări.
 *
 *   node --test tests/clients.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { store } from "../src/lib/db/store.ts";
import { mergeClients, saveClient } from "../src/lib/db/actions.ts";
import { findDuplicates, nameKey, phoneKey } from "../src/lib/clients.ts";
import type { Client } from "../src/lib/types.ts";

const USER = "66666666-6666-4666-8666-666666666666";

function client(patch: Partial<Client> & { id: string }): Client {
  return {
    user_id: "u",
    created_at: "2026-01-10T08:00:00.000Z",
    updated_at: "2026-01-10T08:00:00.000Z",
    deleted_at: null,
    name: "Ion Popescu",
    phone: null,
    email: null,
    address: null,
    notes: null,
    ...patch,
  } as Client;
}

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
});

test("același număr scris altfel e același număr", () => {
  assert.equal(phoneKey("+373 69 123 456"), phoneKey("069123456"));
  assert.equal(phoneKey("00373 69123456"), phoneKey("69-123-456"));
  assert.equal(phoneKey("123"), "");
  assert.equal(phoneKey(null), "");
});

test("numele se compară fără diacritice și fără spații", () => {
  assert.equal(nameKey("Ion Popescu"), nameKey("ion  popescu"));
  assert.equal(nameKey("Ștefan Ciobanu"), nameKey("stefan ciobanu"));
});

test("telefonul e dovadă, numele doar un semn", () => {
  const list = [
    client({ id: "a", name: "Ion Popescu", phone: "069123456" }),
    client({ id: "b", name: "Ion Popescu", phone: "069999999" }),
  ];

  const byPhone = findDuplicates(list, { name: "Altcineva", phone: "+373 69 123 456" });
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].client.id, "a");
  assert.equal(byPhone[0].by, "phone");

  const byName = findDuplicates(list, { name: "ion popescu", phone: "" });
  assert.equal(byName.length, 2);
  assert.ok(byName.every((match) => match.by === "name"));
});

test("clientul nu se potrivește cu el însuși", () => {
  const list = [client({ id: "a", name: "Ion Popescu", phone: "069123456" })];
  assert.equal(
    findDuplicates(list, { name: "Ion Popescu", phone: "069123456", excludeId: "a" }).length,
    0,
  );
});

test("un nume prea scurt nu declanșează nimic", () => {
  const list = [client({ id: "a", name: "Ion" })];
  assert.equal(findDuplicates(list, { name: "Ion" }).length, 0);
});

test("unirea mută tot ce ține de om și păstrează ce e completat", async () => {
  const keep = await saveClient({ name: "Ion Popescu", phone: "069123456" });
  const dupe = await saveClient({
    name: "Ion Popescu",
    phone: "069123456",
    address: "str. Ismail 45",
    notes: "Are câine",
  });
  assert.ok(keep && dupe);

  const job = await store.insert("jobs", {
    title: "Scară",
    type: "stairs",
    client_id: dupe.id,
    price_total: 10000,
  });
  await store.insert("payments", { job_id: job.id, client_id: dupe.id, amount: 4000 });
  await store.insert("quotes", { client_id: dupe.id, title: "Ofertă", number: 1 });
  await store.insert("projects", { name: "Bloc", client_id: dupe.id });

  const moved = await mergeClients(dupe.id, keep.id);
  assert.equal(moved, 4);

  const owner = (table: "jobs" | "payments" | "quotes" | "projects") =>
    store.getTable(table).map((row) => (row as { client_id?: string | null }).client_id);
  assert.deepEqual(owner("jobs"), [keep.id]);
  assert.deepEqual(owner("payments"), [keep.id]);
  assert.deepEqual(owner("quotes"), [keep.id]);
  assert.deepEqual(owner("projects"), [keep.id]);

  const merged = store.getTable("clients").find((row) => row.id === keep.id);
  // Adresa scrisă o singură dată, pe dublură, n-are de ce să dispară.
  assert.equal(merged?.address, "str. Ismail 45");
  assert.equal(merged?.notes, "Are câine");

  // Dublura pleacă în coș, deci unirea greșită are drum înapoi.
  const gone = store.getTable("clients").find((row) => row.id === dupe.id);
  assert.ok(gone?.deleted_at);
});

test("unirea cu sine nu mișcă nimic", async () => {
  const one = await saveClient({ name: "Ion Popescu" });
  assert.ok(one);
  assert.equal(await mergeClients(one.id, one.id), 0);
  assert.equal(
    store.getTable("clients").filter((row) => !row.deleted_at).length,
    1,
  );
});
