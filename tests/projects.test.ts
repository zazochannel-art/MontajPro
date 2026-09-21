/**
 * Testele proiectelor.
 *
 * Un proiect e doar un acoperiș peste lucrări. Partea care poate strica ceva
 * e ștergerea lui: dacă ar lua cu el apartamentele, ar lua și banii lor.
 *
 *   node --test tests/projects.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { store } from "../src/lib/db/store.ts";
import { deleteProject, saveProject, setJobProject } from "../src/lib/db/actions.ts";

const USER = "55555555-5555-4555-8555-555555555555";

function jobById(id: string) {
  const row = store.getTable("jobs").find((job) => job.id === id);
  assert.ok(row, "lucrarea ar trebui să existe");
  return row;
}

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
});

test("lucrările intră și ies din proiect", async () => {
  const project = await saveProject({ name: "Bloc Ismail 45" });
  assert.ok(project);
  const job = await store.insert("jobs", { title: "Ap. 12", type: "parquet" });

  await setJobProject(job.id, project.id);
  assert.equal(jobById(job.id).project_id, project.id);

  await setJobProject(job.id, null);
  assert.equal(jobById(job.id).project_id, null);
});

test("ștergerea proiectului lasă lucrările în picioare", async () => {
  const project = await saveProject({ name: "Bloc Ismail 45" });
  assert.ok(project);

  const a = await store.insert("jobs", {
    title: "Ap. 12",
    type: "parquet",
    price_total: 12000,
    project_id: project.id,
  });
  const b = await store.insert("jobs", {
    title: "Ap. 13",
    type: "parquet",
    price_total: 9000,
    project_id: project.id,
  });
  await store.insert("payments", { job_id: a.id, amount: 5000 });

  await deleteProject(project.id);

  // Proiectul a dispărut din listă…
  assert.equal(
    store.getTable("projects").filter((row) => !row.deleted_at).length,
    0,
  );
  // …dar lucrările sunt întregi, doar fără acoperiș.
  assert.equal(jobById(a.id).project_id, null);
  assert.equal(jobById(b.id).project_id, null);
  assert.equal(jobById(a.id).price_total, 12000);
  assert.equal(
    store.getTable("payments").filter((row) => !row.deleted_at).length,
    1,
  );
});

test("proiectul se poate redenumi fără să piardă lucrările", async () => {
  const project = await saveProject({ name: "Bloc" });
  assert.ok(project);
  const job = await store.insert("jobs", {
    title: "Ap. 1",
    type: "plinth",
    project_id: project.id,
  });

  await saveProject({ id: project.id, name: "Bloc Ismail 45, scara 2" });

  const saved = store.getTable("projects").find((row) => row.id === project.id);
  assert.equal(saved?.name, "Bloc Ismail 45, scara 2");
  assert.equal(jobById(job.id).project_id, project.id);
});
