/**
 * Testele prețului pe client și ale verificării de tarif.
 *
 *   node --test tests/pricing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustLabel, adjustedPrice, rateCheck } from "../src/lib/pricing.ts";

test("reducerea clientului se aplică pe preț", () => {
  assert.equal(adjustedPrice(1000, { price_adjust: -10 }), 900);
  assert.equal(adjustLabel({ price_adjust: -10 }), "−10%");
});

test("adaosul merge la fel, în cealaltă direcție", () => {
  assert.equal(adjustedPrice(1000, { price_adjust: 15 }), 1150);
  assert.equal(adjustLabel({ price_adjust: 15 }), "+15%");
});

test("clientul fără ajustare plătește prețul din listă", () => {
  assert.equal(adjustedPrice(1000, { price_adjust: 0 }), 1000);
  assert.equal(adjustedPrice(1000, null), 1000);
  assert.equal(adjustLabel(null), "");
});

test("rotunjirea nu lasă bani în zecimale nesfârșite", () => {
  // 333,33 × 0,93 = 309,9969 — se rotunjește la bani, nu la sutimi de ban.
  assert.equal(adjustedPrice(333.33, { price_adjust: -7 }), 310);
  // 100,005 × 0,99 = 99,00495 — sub jumătate de ban, deci în jos.
  assert.equal(adjustedPrice(100.005, { price_adjust: -1 }), 99);
});

test("verificarea spune cât îți rămâne pe oră aici, față de media ta", () => {
  const check = rateCheck({
    price: 3200,
    materialsCost: 800,
    hours: 6,
    average: 420,
  });
  assert.equal(check?.perHour, 400);
  assert.equal(check?.average, 420);
  assert.equal(check?.verdict, "la_fel", "20 de lei sub 420 e zgomot, nu semnal");
});

test("sub media ta cu mai mult de o zecime e un semnal", () => {
  const check = rateCheck({ price: 2000, materialsCost: 800, hours: 6, average: 420 });
  assert.equal(check?.perHour, 200);
  assert.equal(check?.verdict, "slab");
  assert.ok(check!.diff < 0);
});

test("peste medie, la fel", () => {
  const check = rateCheck({ price: 6000, materialsCost: 800, hours: 6, average: 420 });
  assert.equal(check?.verdict, "bun");
});

test("fără ore sau fără medie nu se pronunță", () => {
  assert.equal(rateCheck({ price: 3200, hours: 0, average: 420 }), null);
  assert.equal(rateCheck({ price: 3200, hours: 6, average: 0 }), null);
  assert.equal(rateCheck({ price: 3200, hours: 0.1, average: 420 }), null);
});
