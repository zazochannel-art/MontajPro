/**
 * Testele părții de echipă.
 *
 * E codul cel mai greu de verificat cu mâna — îți trebuie două conturi și
 * modul avion — și cel în care o greșeală costă cel mai mult: orele lucrate
 * de un om pe șantier. Serverul e un ciot: ce se verifică aici e logica de pe
 * telefon, adică exact partea pe care am scris-o.
 *
 *   node --test tests/team.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setSupabaseClient } from "../src/lib/supabase/client.ts";
import { idbClearAll } from "../src/lib/db/idb.ts";
import {
  cachedJobs,
  cachedTasks,
  flushQueue,
  markTask,
  queueLength,
  refreshJobs,
  refreshTasks,
  startedAt,
  startTimer,
  stopTimer,
} from "../src/lib/team.ts";

const JOB = "33333333-3333-4333-8333-333333333333";
const TASK = "44444444-4444-4444-8444-444444444444";

/** Ce a cerut aplicația de la server, în ordine. */
let calls: { fn: string; args: unknown }[] = [];
/** Ce răspunde ciotul: `null` înseamnă „a mers”. */
let failWith: string | null = null;

function stubClient() {
  return {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (failWith) return Promise.resolve({ data: null, error: { message: failWith } });
      if (fn === "shared_jobs") {
        return Promise.resolve({
          data: [{ id: JOB, owner_id: "o", title: "Scară", type: "stairs", status: "in_progress", address: null, scheduled_date: null, scheduled_time: null, notes: null, client_name: null, client_phone: null }],
          error: null,
        });
      }
      if (fn === "shared_tasks") {
        return Promise.resolve({
          data: [{ id: TASK, title: "Montat trepte", done: false, position: 0 }],
          error: null,
        });
      }
      return Promise.resolve({ data: true, error: null });
    },
  } as unknown as SupabaseClient;
}

function online(value: boolean) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: value },
    configurable: true,
    writable: true,
  });
}

beforeEach(async () => {
  await idbClearAll();
  calls = [];
  failWith = null;
  setSupabaseClient(stubClient());
  online(true);
});

test("ce s-a citit rămâne pe telefon", async () => {
  assert.deepEqual(await cachedJobs(), []);
  await refreshJobs();
  const cached = await cachedJobs();
  assert.equal(cached.length, 1);
  assert.equal(cached[0].title, "Scară");

  // Fără server, lista rămâne cea știută: ăsta e tot rostul cache-ului.
  setSupabaseClient(null);
  assert.equal((await cachedJobs())[0].title, "Scară");
  assert.equal(await refreshJobs(), null);
});

test("bifa fără semnal intră la coadă, dar se vede imediat", async () => {
  await refreshTasks(JOB);
  online(false);

  const result = await markTask(JOB, TASK, true);
  assert.equal(result, "queued");
  assert.equal(await queueLength(), 1);
  // Ecranul n-are voie să mintă: pasul apare bifat.
  assert.equal((await cachedTasks(JOB))[0].done, true);
});

test("bifa pusă și scoasă de mai multe ori lasă o singură intrare", async () => {
  await refreshTasks(JOB);
  online(false);

  await markTask(JOB, TASK, true);
  await markTask(JOB, TASK, false);
  await markTask(JOB, TASK, true);

  assert.equal(await queueLength(), 1, "contează ultima stare, nu drumul");

  online(true);
  calls = [];
  const sent = await flushQueue();
  assert.equal(sent, 1);
  assert.deepEqual(calls[0], {
    fn: "shared_task_set",
    args: { task: TASK, value: true },
  });
  assert.equal(await queueLength(), 0);
});

test("ce serverul refuză rămâne la coadă, nu se pierde", async () => {
  online(false);
  await refreshTasks(JOB);
  await markTask(JOB, TASK, true);

  online(true);
  failWith = "refuzat";
  assert.equal(await flushQueue(), 0);
  assert.equal(await queueLength(), 1, "rămâne pentru încercarea următoare");

  failWith = null;
  assert.equal(await flushQueue(), 1);
  assert.equal(await queueLength(), 0);
});

test("cronometrul pornește local, fără server", async () => {
  setSupabaseClient(null);
  online(false);

  const at = await startTimer(JOB);
  assert.equal(await startedAt(JOB), at);
  assert.equal(calls.length, 0, "pornirea nu cere internet");
});

test("orele se scriu cu ceasul lor, nu cu cel de la trimitere", async () => {
  online(false);
  await startTimer(JOB);
  const started = (await startedAt(JOB))!;

  const result = await stopTimer(JOB);
  assert.equal(result, "queued");
  assert.equal(await startedAt(JOB), null, "cronometrul se oprește oricum");

  online(true);
  calls = [];
  assert.equal(await flushQueue(), 1);

  const sent = calls[0].args as { job: string; started: string; ended: string };
  assert.equal(calls[0].fn, "shared_session_log");
  assert.equal(sent.job, JOB);
  // Ora de început e cea de la pornire, nu cea de la golirea cozii.
  assert.equal(sent.started, started);
  assert.ok(sent.ended >= started);
});

test("cu semnal, oprirea pleacă pe loc", async () => {
  online(true);
  await startTimer(JOB);
  calls = [];

  assert.equal(await stopTimer(JOB), "sent");
  assert.equal(calls[0].fn, "shared_session_log");
  assert.equal(await queueLength(), 0);
});

test("oprirea fără pornire nu inventează o sesiune", async () => {
  assert.equal(await stopTimer(JOB), "none");
  assert.equal(await queueLength(), 0);
  assert.equal(calls.length, 0);
});
