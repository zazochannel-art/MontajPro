/**
 * Testele listei de pași nebifați.
 *
 *   node --test tests/todo.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openCount, openTasks } from "../src/lib/todo.ts";
import type { Job, JobStatus, JobTask } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

function job(
  id: string,
  date: string | null,
  status: JobStatus = "in_progress",
  patch: Partial<Job> = {},
): Job {
  return {
    ...BASE,
    id,
    client_id: null,
    project_id: null,
    title: id,
    type: "parquet",
    status,
    address: null,
    scheduled_date: date,
    scheduled_time: null,
    estimated_hours: 0,
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
    scheduled_end_date: null,
    public_token: null,
    assigned_member_id: null,
    ...patch,
  };
}

let n = 0;
function task(
  jobId: string,
  title: string,
  done = false,
  patch: Partial<JobTask> = {},
): JobTask {
  n += 1;
  return {
    ...BASE,
    id: `t${n}`,
    job_id: jobId,
    title,
    done,
    done_at: done ? "2026-09-10T08:00:00.000Z" : null,
    position: n,
    ...patch,
  };
}

test("pașii nebifați se strâng pe lucrare", () => {
  const todos = openTasks(
    [task("a", "Curăță stratul"), task("a", "Pune folia", true), task("a", "Montează")],
    [job("a", "2026-09-22")],
  );
  assert.equal(todos.length, 1);
  assert.deepEqual(
    todos[0].tasks.map((item) => item.title),
    ["Curăță stratul", "Montează"],
  );
  assert.equal(todos[0].total, 3, "se vede și din cât");
});

test("lucrarea cu toți pașii bifați nu mai apare", () => {
  const todos = openTasks([task("a", "Gata", true)], [job("a", "2026-09-22")]);
  assert.deepEqual(todos, []);
});

test("lucrarea terminată nu mai cere nimic", () => {
  const todos = openTasks([task("a", "Rămas nebifat")], [job("a", "2026-09-01", "done")]);
  assert.deepEqual(todos, []);
});

test("lucrarea arhivată nu mai cere nimic", () => {
  const todos = openTasks(
    [task("a", "Rămas nebifat")],
    [job("a", "2026-09-01", "in_progress", { archived_at: "2026-09-05" })],
  );
  assert.deepEqual(todos, []);
});

test("lucrarea ștearsă nu mai cere nimic", () => {
  const todos = openTasks(
    [task("a", "Rămas nebifat")],
    [job("a", "2026-09-01", "in_progress", { deleted_at: "2026-09-05" })],
  );
  assert.deepEqual(todos, []);
});

test("pasul șters nu se numără", () => {
  const todos = openTasks(
    [task("a", "Șters", false, { deleted_at: "2026-09-05" }), task("a", "Real")],
    [job("a", "2026-09-22")],
  );
  assert.equal(todos[0].tasks.length, 1);
  assert.equal(todos[0].total, 1, "nici la total");
});

test("pasul unei lucrări care nu există nu dărâmă lista", () => {
  const todos = openTasks([task("fantomă", "Pas")], [job("a", "2026-09-22")]);
  assert.deepEqual(todos, []);
});

test("ce e programat mai devreme urcă", () => {
  const todos = openTasks(
    [task("tarziu", "x"), task("devreme", "y")],
    [job("tarziu", "2026-09-30"), job("devreme", "2026-09-23")],
  );
  assert.deepEqual(
    todos.map((todo) => todo.job.id),
    ["devreme", "tarziu"],
  );
});

test("lucrarea fără dată stă la urmă", () => {
  const todos = openTasks(
    [task("fara", "x"), task("cu", "y")],
    [job("fara", null), job("cu", "2026-12-01")],
  );
  assert.deepEqual(
    todos.map((todo) => todo.job.id),
    ["cu", "fara"],
  );
});

test("pașii unei lucrări rămân în ordinea în care i-ai scris", () => {
  const todos = openTasks(
    [
      task("a", "Al treilea", false, { position: 3 }),
      task("a", "Primul", false, { position: 1 }),
      task("a", "Al doilea", false, { position: 2 }),
    ],
    [job("a", "2026-09-22")],
  );
  assert.deepEqual(
    todos[0].tasks.map((item) => item.title),
    ["Primul", "Al doilea", "Al treilea"],
  );
});

test("totalul adună pașii din toate lucrările", () => {
  const todos = openTasks(
    [task("a", "x"), task("a", "y"), task("b", "z")],
    [job("a", "2026-09-22"), job("b", "2026-09-23")],
  );
  assert.equal(openCount(todos), 3);
});
