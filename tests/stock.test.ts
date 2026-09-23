/**
 * Depozitul: scos și pus la loc.
 *
 * Stocul e cifra după care hotărăști dacă mai treci pe la depozit înainte de
 * lucrare. Dacă ea crește din nimic, drumul se face degeaba — sau, mai rău,
 * nu se face deloc.
 *
 *   node --test tests/stock.test.ts
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { store } from "../src/lib/db/store.ts";
import { returnToStock, takeFromStock } from "../src/lib/db/actions.ts";

const USER = "55555555-5555-4555-8555-555555555555";

beforeEach(async () => {
  await store.wipeLocal();
  await store.boot(USER);
});

/** Un material în depozit și o linie de lucrare legată de el. */
async function setup(onShelf: number, needed: number) {
  const material = await store.insert("materials", {
    name: "Parchet stejar",
    quantity: onShelf,
    unit: "m²",
    price: 300,
  });
  const job = await store.insert("jobs", { title: "Apartament 12", type: "parquet" });
  const line = await store.insert("job_materials", {
    job_id: job.id,
    material_id: material.id,
    name: "Parchet stejar",
    quantity: needed,
    unit: "m²",
    unit_price: 300,
    purchased: false,
  });
  return { material, line };
}

const stockOf = (id: string) =>
  store.getTable("materials").find((row) => row.id === id)?.quantity;

test("scoaterea scade din depozit", async () => {
  const { material, line } = await setup(20, 8);
  const result = await takeFromStock(line.id);

  assert.equal(stockOf(material.id), 12);
  assert.equal(result?.short, 0);
});

test("nu se scoate mai mult decât e pe raft", async () => {
  const { material, line } = await setup(5, 8);
  const result = await takeFromStock(line.id);

  assert.equal(stockOf(material.id), 0, "stocul nu coboară sub zero");
  assert.equal(result?.short, 3, "și se spune cât a lipsit");
});

test("întoarcerea pune la loc exact cât s-a scos", async () => {
  const { material, line } = await setup(5, 8);
  await takeFromStock(line.id);
  await returnToStock(line.id);

  /*
   * Aici era gaura: se punea la loc cantitatea de pe lucrare (8), nu cât se
   * scosese de fapt (5). O apăsare greșită și anularea ei făceau din 5 pe
   * raft 8 — trei pachete care n-au existat niciodată.
   */
  assert.equal(stockOf(material.id), 5);
});

test("întoarcerea unui material care a încăput întreg", async () => {
  const { material, line } = await setup(20, 8);
  await takeFromStock(line.id);
  await returnToStock(line.id);

  assert.equal(stockOf(material.id), 20);
});

test("scos și pus la loc de mai multe ori nu umflă raftul", async () => {
  const { material, line } = await setup(5, 8);
  for (let i = 0; i < 4; i += 1) {
    await takeFromStock(line.id);
    await returnToStock(line.id);
  }
  assert.equal(stockOf(material.id), 5);
});

test("a doua apăsare pe „scoate” nu scade încă o dată", async () => {
  const { material, line } = await setup(20, 8);
  await takeFromStock(line.id);
  const second = await takeFromStock(line.id);

  assert.equal(second, null);
  assert.equal(stockOf(material.id), 12);
});

test("rândul scos înainte de `taken_quantity` se întoarce cu cantitatea lui", async () => {
  // Rândurile vechi n-au cifra notată: nu se poate ști cât s-a scos, deci se
  // pune la loc ce scrie pe lucrare — cum se făcea și până acum.
  const { material, line } = await setup(20, 8);
  await store.update("job_materials", line.id, {
    taken_from_stock: true,
    taken_quantity: null,
  });
  await store.update("materials", material.id, { quantity: 12 });

  await returnToStock(line.id);
  assert.equal(stockOf(material.id), 20);
});

test("scoaterea de pe un raft gol nu dă nimic și nu ia nimic înapoi", async () => {
  // `taken_quantity` iese 0, nu `null`: s-a apăsat, dar n-a fost ce lua.
  // Dacă întoarcerea ar confunda 0 cu „nenotat”, ar pune pe raft 8 din nimic.
  const { material, line } = await setup(0, 8);
  const result = await takeFromStock(line.id);
  assert.equal(result?.short, 8);
  assert.equal(stockOf(material.id), 0);

  await returnToStock(line.id);
  assert.equal(stockOf(material.id), 0);
});
