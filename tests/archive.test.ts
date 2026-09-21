/**
 * Testele arhivei.
 *
 * Arhivarea automată atinge singură zeci de lucrări deodată, așa că regula ei
 * trebuie să fie strictă: o lucrare cu rest de încasat nu are voie să dispară
 * din listă, altfel banii aceia nu-i mai cere nimeni niciodată.
 *
 *   node --test tests/archive.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { store } from "../src/lib/db/store.ts";
import { archiveJob, archiveOldJobs, unarchiveJob } from "../src/lib/db/actions.ts";

const USER = "33333333-3333-4333-8333-333333333333";

/** Lucrarea, citită direct din store. */
function jobById(id: string) {
  const row = store.getTable("jobs").find((job) => job.id === id);
  assert.ok(row, "lucrarea ar trebui să existe");
  return row;
}

/** O dată de acum N luni, în formatul zilelor din baza locală. */
function monthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
}

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
});

test("arhivarea și întoarcerea din arhivă", async () => {
  const job = await store.insert("jobs", { title: "Scară frasin", type: "stairs" });
  assert.ok(!jobById(job.id).archived_at);

  await archiveJob(job.id);
  assert.ok(jobById(job.id).archived_at);

  await unarchiveJob(job.id);
  assert.ok(!jobById(job.id).archived_at);
});

test("automat se arhivează doar ce e terminat, vechi și plătit", async () => {
  const old = monthsAgo(18);
  const recent = monthsAgo(2);

  const paid = await store.insert("jobs", {
    title: "Plătită și veche",
    type: "stairs",
    status: "done",
    end_date: old,
    price_total: 10000,
  });
  await store.insert("payments", { job_id: paid.id, amount: 10000 });

  const owing = await store.insert("jobs", {
    title: "Veche dar neîncasată",
    type: "stairs",
    status: "done",
    end_date: old,
    price_total: 10000,
  });
  await store.insert("payments", { job_id: owing.id, amount: 4000 });

  const fresh = await store.insert("jobs", {
    title: "Terminată luna trecută",
    type: "parquet",
    status: "done",
    end_date: recent,
    price_total: 5000,
  });
  await store.insert("payments", { job_id: fresh.id, amount: 5000 });

  const running = await store.insert("jobs", {
    title: "În lucru de mult",
    type: "parquet",
    status: "in_progress",
    end_date: old,
    price_total: 5000,
  });

  const count = await archiveOldJobs(12);

  assert.equal(count, 1);
  assert.ok(jobById(paid.id).archived_at);
  assert.ok(!jobById(owing.id).archived_at);
  assert.ok(!jobById(fresh.id).archived_at);
  assert.ok(!jobById(running.id).archived_at);
});

test("un rest de câțiva bani nu ține lucrarea afară din arhivă", async () => {
  const job = await store.insert("jobs", {
    title: "Rest de rotunjire",
    type: "stairs",
    status: "done",
    end_date: monthsAgo(18),
    price_total: 10000,
  });
  await store.insert("payments", { job_id: job.id, amount: 9999.7 });

  assert.equal(await archiveOldJobs(12), 1);
  assert.ok(jobById(job.id).archived_at);
});

test("a doua rulare nu mai are ce arhiva", async () => {
  const job = await store.insert("jobs", {
    title: "Gata de arhivă",
    type: "stairs",
    status: "done",
    end_date: monthsAgo(24),
    price_total: 1000,
  });
  await store.insert("payments", { job_id: job.id, amount: 1000 });

  assert.equal(await archiveOldJobs(12), 1);
  assert.equal(await archiveOldJobs(12), 0);
  assert.equal(store.getTable("jobs").filter((row) => row.archived_at).length, 1);
  assert.equal(jobById(job.id).title, "Gata de arhivă");
});
