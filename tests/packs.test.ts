/**
 * Testele pachetelor întregi.
 *
 *   node --test tests/packs.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { packPlan, packPlanText } from "../src/lib/packs.ts";

test("rotunjește în sus, fiindcă jumătate de pachet nu se vinde", () => {
  const plan = packPlan(74.8, 2.18);
  assert.equal(plan?.packs, 35);
  assert.equal(plan?.total, 76.3);
  assert.equal(plan?.leftover, 1.5);
});

test("cantitatea care intră fix nu cere un pachet în plus", () => {
  // 4.36 / 2.18 dă 2.0000000000000004 în virgulă mobilă. Fără grijă, ar cere
  // trei pachete pentru exact două.
  const plan = packPlan(4.36, 2.18);
  assert.equal(plan?.packs, 2);
  assert.equal(plan?.leftover, 0);
});

test("materialul fără pachet nu se rotunjește deloc", () => {
  assert.equal(packPlan(12, null), null);
  assert.equal(packPlan(12, 0), null);
});

test("nimic de comandat înseamnă nimic de spus", () => {
  assert.equal(packPlan(0, 2.18), null);
  assert.equal(packPlan(-5, 2.18), null);
});

test("un singur pachet se scrie la singular", () => {
  const plan = packPlan(1.5, 2.18);
  assert.equal(plan?.packs, 1);
  assert.equal(packPlanText(plan, "m²"), "1 pachet = 2.18 m² (0.68 m² în plus)");
});

test("fără rest, textul nu mai adaugă o paranteză goală", () => {
  assert.equal(packPlanText(packPlan(4.36, 2.18), "m²"), "2 pachete = 4.36 m²");
});
