/**
 * Testele zilei de lucru.
 *
 * O avertizare falsă e mai rea decât niciuna: dacă aplicația strigă „conflict"
 * la fiecare zi cu două lucrări, omul se învață s-o ignore, iar atunci n-o mai
 * vede nici când chiar e una.
 *
 *   node --test tests/route.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LONG_DAY_HOURS, dayLoad, routeHref } from "../src/lib/route.ts";
import type { Job } from "../src/lib/types.ts";

function job(patch: Partial<Job> & { id: string }): Job {
  return {
    user_id: "u",
    created_at: "2026-03-01T08:00:00.000Z",
    updated_at: "2026-03-01T08:00:00.000Z",
    deleted_at: null,
    client_id: null,
    project_id: null,
    title: `Lucrare ${patch.id}`,
    type: "stairs",
    status: "confirmed",
    address: null,
    scheduled_date: "2026-03-10",
    scheduled_time: null,
    estimated_hours: null,
    price_total: 0,
    material_cost: null,
    start_date: null,
    end_date: null,
    notes: null,
    archived_at: null,
    in_portfolio: false,
    portfolio_description: null,
    ...patch,
  } as Job;
}

test("două lucrări fără oră nu sunt un conflict", () => {
  const load = dayLoad([job({ id: "a" }), job({ id: "b" })]);
  assert.deepEqual(load.overlaps, []);
});

test("orele care se calcă una pe alta se văd", () => {
  const load = dayLoad([
    job({ id: "a", scheduled_time: "09:00", estimated_hours: 3 }),
    job({ id: "b", scheduled_time: "11:00", estimated_hours: 2 }),
  ]);
  assert.equal(load.overlaps.length, 1);
  assert.equal(load.overlaps[0].a.id, "a");
  assert.equal(load.overlaps[0].b.id, "b");
});

test("una după alta, fără pauză, nu e o suprapunere", () => {
  const load = dayLoad([
    job({ id: "a", scheduled_time: "09:00", estimated_hours: 2 }),
    job({ id: "b", scheduled_time: "11:00", estimated_hours: 2 }),
  ]);
  assert.deepEqual(load.overlaps, []);
});

test("două lucrări la aceeași oră se ciocnesc chiar și fără durată", () => {
  const load = dayLoad([
    job({ id: "a", scheduled_time: "09:00" }),
    job({ id: "b", scheduled_time: "09:00" }),
  ]);
  assert.equal(load.overlaps.length, 1);
});

test("ziua prea plină se vede, cea normală nu", () => {
  const short = dayLoad([job({ id: "a", estimated_hours: 8 })]);
  assert.equal(short.long, false);
  assert.equal(short.hours, 8);

  const long = dayLoad([
    job({ id: "a", estimated_hours: 8 }),
    job({ id: "b", estimated_hours: 5 }),
  ]);
  assert.equal(long.hours, 13);
  assert.equal(long.long, true);
  assert.ok(long.hours > LONG_DAY_HOURS);
});

test("lucrările terminate și cele șterse nu mai încarcă ziua", () => {
  const load = dayLoad([
    job({ id: "a", estimated_hours: 8, status: "done" }),
    job({ id: "b", estimated_hours: 8, deleted_at: "2026-03-02T00:00:00.000Z" }),
    job({ id: "c", estimated_hours: 3 }),
  ]);
  assert.equal(load.jobs.length, 1);
  assert.equal(load.hours, 3);
});

test("opririle stau în ordinea orei, iar cele fără adresă nu intră", () => {
  const load = dayLoad([
    job({ id: "b", scheduled_time: "14:00", address: "str. Ismail 45" }),
    job({ id: "a", scheduled_time: "09:00", address: "bd. Dacia 12" }),
    job({ id: "c", scheduled_time: "10:00" }),
  ]);
  assert.deepEqual(
    load.stops.map((stop) => stop.address),
    ["bd. Dacia 12", "str. Ismail 45"],
  );
});

test("o singură adresă e o căutare, nu o rută", () => {
  const href = routeHref(["str. Ismail 45"]);
  assert.ok(href?.includes("maps/search"));
  assert.ok(href?.includes("Ismail"));
});

test("mai multe adrese devin un drum, cu opriri pe traseu", () => {
  const href = routeHref(["A", "B", "C"]);
  assert.ok(href?.includes("maps/dir"));
  assert.ok(href?.includes("origin=A"));
  assert.ok(href?.includes("destination=C"));
  assert.ok(href?.includes("waypoints=B"));
});

test("două adrese n-au opriri intermediare", () => {
  const href = routeHref(["A", "B"]);
  assert.ok(!href?.includes("waypoints"));
});

test("fără adrese nu există drum", () => {
  assert.equal(routeHref([]), null);
  assert.equal(routeHref(["   "]), null);
});
