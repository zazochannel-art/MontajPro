/**
 * Testele motorului de sincronizare.
 *
 * Aici se verifică exact partea pe care testul de fum n-o atinge: aplicația
 * vorbind cu un backend. Clientul Supabase este cel adevărat — doar serverul
 * este fals (`fake-postgrest.mjs`), iar IndexedDB vine din `fake-indexeddb`.
 *
 *   node --test tests/sync.test.ts
 */
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFakeBackend } from "./fake-postgrest.mjs";
import { setSupabaseClient } from "../src/lib/supabase/client.ts";
import { store } from "../src/lib/db/store.ts";
import { syncNow } from "../src/lib/db/sync.ts";

const USER = "11111111-1111-4111-8111-111111111111";

let backend: ReturnType<typeof createFakeBackend>;
let client: SupabaseClient;

before(async () => {
  backend = createFakeBackend();
  const url = await backend.listen();
  client = createClient(url, "cheie-de-test", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  setSupabaseClient(client);
});

after(async () => {
  setSupabaseClient(null);
  await backend.close();
});

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
  for (const table of backend.tables.keys()) backend.tables.get(table)?.clear();
  backend.allow("jobs");
});

test("ce scriu local ajunge pe server", async () => {
  await store.insert("clients", {
    name: "Ion Popescu",
    phone: "+37369000000",
    email: null,
    address: null,
    notes: null,
  });

  await syncNow();

  const remote = backend.rows("clients");
  assert.equal(remote.length, 1);
  assert.equal(remote[0].name, "Ion Popescu");
  assert.equal(remote[0].user_id, USER);
  // Outbox-ul s-a golit, deci nu retrimitem la infinit.
  assert.equal(store.outboxSize(), 0);
});

test("ce apare pe server ajunge local", async () => {
  backend.seed("clients", {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: USER,
    name: "Maria Rusu",
    phone: null,
    email: null,
    address: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  });

  await syncNow();

  const local = store.getTable("clients");
  assert.equal(local.length, 1);
  assert.equal(local[0].name, "Maria Rusu");
});

test("cursorul avansează: a doua sincronizare nu mai aduce nimic", async () => {
  backend.seed("clients", {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: USER,
    name: "Client vechi",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  });

  await syncNow();
  const firstPass = store.getTable("clients")[0].updated_at;

  // Modificăm local, fără să atingem serverul.
  await store.update("clients", "33333333-3333-4333-8333-333333333333", {
    name: "Client redenumit",
  });
  await syncNow();

  const local = store.getTable("clients");
  assert.equal(local.length, 1);
  assert.equal(local[0].name, "Client redenumit");
  assert.notEqual(local[0].updated_at, firstPass);
  assert.equal(backend.rows("clients")[0].name, "Client redenumit");
});

test("un tabel refuzat nu blochează restul sincronizării", async () => {
  backend.reject("jobs");

  const client_ = await store.insert("clients", {
    name: "Client bun",
    phone: null,
    email: null,
    address: null,
    notes: null,
  });
  await store.insert("jobs", {
    client_id: client_.id,
    title: "Lucrare care nu poate fi scrisă",
    type: "stairs",
    status: "quote",
    price_total: 100,
    in_portfolio: false,
  });

  // Ceva venit de pe alt dispozitiv, care trebuie să intre oricum.
  backend.seed("materials", {
    id: "44444444-4444-4444-8444-444444444444",
    user_id: USER,
    name: "Parchet stejar",
    quantity: 10,
    unit: "m²",
    price: 500,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  });

  await syncNow();

  // Clientul a plecat, deși lucrarea a fost refuzată.
  assert.equal(backend.rows("clients").length, 1);
  assert.equal(backend.rows("jobs").length, 0);
  // Lucrarea rămâne în outbox, ca să fie reîncercată.
  assert.equal(store.outboxSize(), 1);
  // Pull-ul a rulat oricum.
  assert.equal(store.getTable("materials").length, 1);
  // Iar starea spune ce anume n-a mers.
  const state = store.getSyncState();
  assert.equal(state.status, "error");
  assert.match(state.error ?? "", /jobs/);

  // După ce serverul acceptă din nou, lucrarea pleacă la următoarea rundă.
  backend.allow("jobs");
  await syncNow();
  assert.equal(backend.rows("jobs").length, 1);
  assert.equal(store.outboxSize(), 0);
  assert.equal(store.getSyncState().status, "idle");
});

test("două rânduri de setări rămân unul singur, cel mai vechi", async () => {
  const older = await store.insert("settings", {
    currency: "MDL",
    units: "metric",
    created_at: "2026-01-01T00:00:00.000Z",
  });
  const newer = await store.insert("settings", {
    currency: "EUR",
    units: "metric",
    created_at: "2026-06-01T00:00:00.000Z",
  });

  await syncNow();

  const alive = store.getTable("settings").filter((row) => !row.deleted_at);
  assert.equal(alive.length, 1);
  assert.equal(alive[0].id, older.id);
  assert.equal(alive[0].currency, "MDL");

  const removed = store.getTable("settings").find((row) => row.id === newer.id);
  assert.ok(removed?.deleted_at, "rândul în plus este șters logic");
});

test("pozele rămase locale se urcă la sincronizare", async () => {
  const job = await store.insert("jobs", {
    client_id: null,
    title: "Lucrare cu poză",
    type: "parquet",
    status: "in_progress",
    price_total: 0,
    in_portfolio: false,
  });
  const photo = await store.insert("job_photos", {
    job_id: job.id,
    measurement_id: null,
    stage: "before",
    storage_path: null,
    local_key: "cheie-locala",
    caption: null,
  });

  // Blobul pe care l-ar fi salvat camera.
  const { blobPut } = await import("../src/lib/db/idb.ts");
  await blobPut("cheie-locala", new Blob(["poza"], { type: "image/jpeg" }));

  await syncNow();

  const stored = store.getTable("job_photos").find((row) => row.id === photo.id);
  assert.ok(stored?.storage_path, "poza a primit o cale în Storage");
  assert.match(stored!.storage_path!, new RegExp(`^${USER}/jobs/${job.id}/`));
  assert.equal(backend.uploads.length, 1);
});

test("ștergerea logică ajunge pe server", async () => {
  const row = await store.insert("clients", {
    name: "De șters",
    phone: null,
    email: null,
    address: null,
    notes: null,
  });
  await syncNow();

  await store.remove("clients", row.id);
  await syncNow();

  const remote = backend.rows("clients");
  assert.equal(remote.length, 1);
  assert.ok(remote[0].deleted_at, "rândul are marcaj de ștergere");
  // Selectorii nu-l mai văd.
  assert.equal(store.getTable("clients").filter((r) => !r.deleted_at).length, 0);
});

test("un tabel care refuză citirea nu le oprește pe celelalte", async () => {
  // Pull-ul cere tabelele în valuri paralele; un tabel supărat n-are voie să
  // ia cu el valul întreg.
  backend.seed("materials", {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: USER,
    name: "Parchet stejar",
    quantity: 10,
    unit: "m²",
    price: 300,
  });
  backend.seed("clients", {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    user_id: USER,
    name: "Ion Popescu",
  });
  backend.rejectReads("clients");

  await syncNow();

  // Materialul a venit, deși clienții au picat.
  assert.equal(store.getTable("materials").length, 1);
  assert.equal(store.getTable("clients").length, 0);

  const state = store.getSyncState();
  assert.equal(state.status, "error");
  assert.match(state.error ?? "", /clients/);

  backend.allowReads("clients");
  await syncNow();
  assert.equal(store.getTable("clients").length, 1);
  assert.equal(store.getSyncState().status, "idle");
});
