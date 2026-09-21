/**
 * Testele treptei comode.
 *
 * Greșeala pe care o prinde funcția asta costă lemn tăiat, deci e verificată
 * pe cazurile de la margine, nu doar pe cel bun.
 *
 *   node --test tests/stairs.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STAIR_LIMITS,
  comfortSummary,
  stairComfort,
} from "../src/lib/stairs.ts";

test("o scară obișnuită trece fără obiecții", () => {
  const result = stairComfort({ riser: 17, tread: 29, steps: 14 });
  assert.equal(result.level, "ok");
  assert.equal(result.stepSum, 63);
  assert.deepEqual(result.problems, []);
  assert.equal(result.suggestion, null);
  assert.equal(comfortSummary(result), "Treptele se urcă bine.");
});

test("treapta prea înaltă e oprită, nu doar semnalată", () => {
  const result = stairComfort({ riser: 22, tread: 24, steps: 12 });
  assert.equal(result.level, "bad");
  assert.ok(result.problems.some((p) => p.includes("prea înalte")));
});

test("călcătura prea scurtă e la fel de gravă ca treapta înaltă", () => {
  const result = stairComfort({ riser: 17, tread: 21, steps: 14 });
  assert.equal(result.level, "bad");
  assert.ok(result.problems.some((p) => p.includes("prea scurtă")));
});

test("pasul care iese din tipar e doar un avertisment", () => {
  // Măsuri în limite una câte una, dar suma iese: 2×18 + 32 = 68.
  const result = stairComfort({ riser: 18, tread: 32, steps: 13 });
  assert.equal(result.level, "warn");
  assert.equal(result.stepSum, 68);
  assert.ok(result.problems.some((p) => p.includes("prea lung")));
});

test("propune alt număr de trepte, păstrând înălțimea totală", () => {
  // 12 trepte × 22 cm = 264 cm de urcat. Ideal ar fi ~17 cm pe treaptă.
  const result = stairComfort({ riser: 22, tread: 28, steps: 12 });
  assert.ok(result.suggestion, "trebuia să propună ceva");
  assert.equal(result.suggestion?.steps, 16);
  assert.equal(result.suggestion?.riser, 16.5);
  // Înălțimea totală rămâne aceeași — altfel scara n-ar mai ajunge sus.
  assert.equal(
    Math.round(result.suggestion!.steps * result.suggestion!.riser),
    264,
  );
});

test("nu propune nimic când schimbarea n-ar repara nimic", () => {
  // Treaptă bună, doar suma pasului e mare: numărul de trepte nu e vinovatul.
  const result = stairComfort({ riser: 18, tread: 32, steps: 13 });
  assert.equal(result.suggestion, null);
});

test("fără măsuri nu inventează un verdict", () => {
  const result = stairComfort({ riser: 0, tread: 0, steps: 0 });
  assert.equal(result.level, "ok");
  assert.equal(result.stepSum, null);
  assert.deepEqual(result.problems, []);
  assert.equal(comfortSummary(result), "");
});

test("limitele se pot muta, iar verdictul se mută cu ele", () => {
  const strict = { ...DEFAULT_STAIR_LIMITS, riser_max: 16 };
  const measures = { riser: 17, tread: 29, steps: 14 };
  assert.equal(stairComfort(measures).level, "ok");
  assert.equal(stairComfort(measures, strict).level, "bad");
});
