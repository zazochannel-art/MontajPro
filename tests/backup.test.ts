/**
 * Testele copiilor de siguranță.
 *
 * Un backup care pare făcut dar nu există e mai rău decât niciunul: omul se
 * bazează pe el exact în ziua în care nu mai are altceva. Deci verificăm că
 * ce scrie în listă chiar se poate citi înapoi, și că lista nu crește la
 * nesfârșit pe un telefon cu memorie puțină.
 *
 *   node --test tests/backup.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { store } from "../src/lib/db/store.ts";
import { metaSet } from "../src/lib/db/idb.ts";
import {
  KEEP_SNAPSHOTS,
  REMIND_AFTER_DAYS,
  backupStatus,
  markDownloaded,
  restoreSnapshot,
  snapshots,
  snoozeReminder,
  takeSnapshot,
} from "../src/lib/backup.ts";

const USER = "44444444-4444-4444-8444-444444444444";

/** `getTable` întoarce și rândurile șterse logic; aici ne interesează cele vii. */
function live<K extends "clients" | "jobs">(table: K) {
  return store.getTable(table).filter((row) => !row.deleted_at);
}

/** O clipă de acum N zile, în ISO. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
  await metaSet("backup:index", []);
  await metaSet("backup:downloaded_at", null);
  await metaSet("backup:snooze_until", null);
});

test("un cont gol nu produce copii", async () => {
  assert.equal(await takeSnapshot(), null);
  assert.deepEqual(await snapshots(), []);
});

test("prima copie se ia, a doua în aceeași zi nu", async () => {
  await store.insert("clients", { name: "Ion Popa" });

  const first = await takeSnapshot();
  assert.ok(first);
  assert.equal((await snapshots()).length, 1);

  assert.equal(await takeSnapshot(), null);
  assert.equal((await snapshots()).length, 1);
});

test("copiile forțate nu se calcă una pe alta", async () => {
  await store.insert("clients", { name: "Ion Popa" });

  const a = await takeSnapshot(true);
  const b = await takeSnapshot(true);
  assert.ok(a && b);
  assert.notEqual(a.at, b.at);
  assert.equal((await snapshots()).length, 2);
});

test("se păstrează doar ultimele copii", async () => {
  await store.insert("clients", { name: "Ion Popa" });
  for (let index = 0; index < KEEP_SNAPSHOTS + 2; index++) {
    await takeSnapshot(true);
  }

  const list = await snapshots();
  assert.equal(list.length, KEEP_SNAPSHOTS);
  // Cele rămase sunt cele mai noi, în ordine descrescătoare.
  assert.deepEqual([...list].sort((a, b) => b.at.localeCompare(a.at)), list);
});

test("o copie ștearsă din listă nu mai poate fi citită", async () => {
  await store.insert("clients", { name: "Ion Popa" });
  const oldest = await takeSnapshot(true);
  assert.ok(oldest);
  for (let index = 0; index < KEEP_SNAPSHOTS; index++) {
    await takeSnapshot(true);
  }

  await assert.rejects(() => restoreSnapshot(oldest.at));
});

test("copia aduce înapoi ce s-a șters între timp", async () => {
  const client = await store.insert("clients", { name: "Ion Popa" });
  const job = await store.insert("jobs", { title: "Scară stejar", type: "stairs" });
  const copy = await takeSnapshot();
  assert.ok(copy);

  await store.removeMany([
    { table: "clients", id: client.id },
    { table: "jobs", id: job.id },
  ]);
  assert.equal(live("clients").length, 0);

  const restored = await restoreSnapshot(copy.at);
  assert.ok(restored >= 2);
  assert.equal(live("clients").length, 1);
  assert.equal(live("jobs")[0]?.title, "Scară stejar");
});

test("mementoul tace pe un cont gol și vorbește pe unul cu date", async () => {
  assert.equal((await backupStatus()).due, false);

  await store.insert("clients", { name: "Ion Popa" });
  const fresh = await backupStatus();
  assert.equal(fresh.due, true);
  assert.equal(fresh.days, null);
});

test("un backup proaspăt oprește mementoul, unul vechi îl pornește", async () => {
  await store.insert("clients", { name: "Ion Popa" });

  await markDownloaded();
  assert.equal((await backupStatus()).due, false);

  await markDownloaded(daysAgo(REMIND_AFTER_DAYS + 1));
  const stale = await backupStatus();
  assert.equal(stale.due, true);
  assert.equal(stale.days, REMIND_AFTER_DAYS + 1);
});

test("„mai târziu” amână, nu anulează", async () => {
  await store.insert("clients", { name: "Ion Popa" });
  await snoozeReminder(3);
  assert.equal((await backupStatus()).due, false);

  await snoozeReminder(-1);
  assert.equal((await backupStatus()).due, true);
});
