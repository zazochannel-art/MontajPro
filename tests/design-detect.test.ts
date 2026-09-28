/**
 * Testele citirii fotografiei.
 *
 * Imaginile sunt făcute aici, cu mâna, tocmai ca să se știe răspunsul corect:
 * dacă desenez opt muchii, detecția trebuie să găsească opt. Pe o fotografie
 * adevărată n-aș avea cu ce compara, și atunci testul ar spune doar „a rulat”.
 *
 *   node --test tests/design-detect.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOT_ENOUGH,
  classify,
  detectStairs,
  scoreOf,
  spacingScore,
} from "../src/lib/design/detect.ts";

const WIDTH = 320;
const HEIGHT = 240;

/** O pânză goală, de culoarea cerută. */
function blank(value: number, width = WIDTH, height = HEIGHT): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = value;
    rgba[i + 1] = value;
    rgba[i + 2] = value;
    rgba[i + 3] = 255;
  }
  return rgba;
}

/**
 * O „scară”: dungi orizontale luminoase, la distanțe egale.
 *
 * Nu e o fotografie, dar are exact ce caută detecția — muchii lungi, drepte,
 * paralele și regulat așezate.
 */
function stairs(options: {
  count: number;
  gap?: number;
  margin?: number;
  tilt?: number;
  width?: number;
  height?: number;
}): { rgba: Uint8ClampedArray; width: number; height: number } {
  const width = options.width ?? WIDTH;
  const height = options.height ?? HEIGHT;
  const gap = options.gap ?? 24;
  const margin = options.margin ?? 20;
  const tilt = options.tilt ?? 0;

  const rgba = blank(40, width, height);
  const put = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = (y * width + x) * 4;
    rgba[p] = 230;
    rgba[p + 1] = 230;
    rgba[p + 2] = 230;
  };

  for (let step = 0; step < options.count; step += 1) {
    const base = margin + step * gap;
    for (let x = margin; x < width - margin; x += 1) {
      const y = Math.round(base + (x - margin) * tilt);
      // Muchie groasă de doi pixeli, ca într-o poză adevărată.
      put(x, y);
      put(x, y + 1);
    }
  }

  return { rgba, width, height };
}

test("o scară cu opt muchii dă șapte trepte", () => {
  // Șapte: între opt muchii sunt șapte trepte. A opta muchie e spatele
  // ultimei trepte, nu o treaptă în plus.
  const image = stairs({ count: 8 });
  const result = detectStairs(image.rgba, image.width, image.height);

  assert.equal(result.detection.steps, 7);
  assert.equal(result.doc.steps.length, 7);
  assert.equal(result.detection.warning, null);
});

test("treptele ies numerotate de jos în sus", () => {
  const image = stairs({ count: 6 });
  const { doc } = detectStairs(image.rgba, image.width, image.height);

  const ordered = [...doc.steps].sort((a, b) => a.index - b.index);
  assert.deepEqual(
    ordered.map((step) => step.index),
    [1, 2, 3, 4, 5],
  );

  // Treapta 1 e cea mai de jos în fotografie, deci cu y cel mai mare.
  const midY = (step: (typeof ordered)[number]) => {
    const points = step.points.map((id) => doc.points[id]);
    return points.reduce((sum, point) => sum + point.y, 0) / points.length;
  };
  assert.ok(midY(ordered[0]) > midY(ordered[ordered.length - 1]));
});

test("fiecare treaptă are patru colțuri, nelipite de vecine", () => {
  const image = stairs({ count: 5 });
  const { doc } = detectStairs(image.rgba, image.width, image.height);

  for (const step of doc.steps) {
    assert.equal(step.points.length, 4, "o treaptă dreaptă are patru colțuri");
    assert.equal(new Set(step.points).size, 4, "fără colțuri repetate");
  }
  // Fiecare treaptă cu punctele ei: separate vizual, cum s-a cerut.
  const all = doc.steps.flatMap((step) => step.points);
  assert.equal(new Set(all).size, all.length);
});

test("o imagine goală nu inventează trepte", () => {
  const result = detectStairs(blank(128), WIDTH, HEIGHT);

  assert.equal(result.detection.steps, 0);
  assert.deepEqual(result.doc.steps, []);
  assert.equal(result.detection.warning, NOT_ENOUGH);
  assert.ok(result.detection.confidence < 0.5);
});

test("o singură muchie nu e o scară", () => {
  const image = stairs({ count: 1 });
  const result = detectStairs(image.rgba, image.width, image.height);

  assert.equal(result.doc.steps.length, 0);
  assert.equal(result.detection.warning, NOT_ENOUGH);
});

test("scara fotografiată strâmb se citește la fel", () => {
  // Telefonul ținut înclinat: muchiile urcă ușor spre dreapta.
  const image = stairs({ count: 7, tilt: 0.08 });
  const result = detectStairs(image.rgba, image.width, image.height);

  assert.equal(result.detection.steps, 6);
  assert.ok(
    result.detection.confidence > 0.5,
    `încrederea a ieșit ${result.detection.confidence}`,
  );
});

test("o scară curată e recunoscută ca dreaptă", () => {
  const image = stairs({ count: 8 });
  const result = detectStairs(image.rgba, image.width, image.height);
  assert.equal(result.detection.kind, "dreapta");
});

test("unghiul de urcare se socotește, nu se presupune", () => {
  const image = stairs({ count: 8 });
  const result = detectStairs(image.rgba, image.width, image.height);
  // Muchii orizontale una peste alta: urcarea e pe verticală.
  assert.ok(result.detection.angle > 45, `a ieșit ${result.detection.angle}`);
});

/* ----------------------------- cifrele din spate ------------------ */

test("distanțele egale înseamnă așezare regulată", () => {
  assert.equal(spacingScore([0, 10, 20, 30, 40]), 1);
});

test("distanțele sărite scad regularitatea", () => {
  assert.ok(spacingScore([0, 10, 11, 60, 61]) < 0.5);
});

test("sub trei muchii nu se poate vorbi de regularitate", () => {
  assert.equal(spacingScore([0, 10]), 0);
});

test("încrederea nu trece niciodată de 0,95", () => {
  assert.equal(scoreOf({ strength: 1, spacing: 1, lines: 50 }), 0.95);
});

test("o singură cifră proastă trage toată încrederea în jos", () => {
  // Muchii superbe, dar așezate haotic: nu merită „bine pe jumătate”.
  const chaotic = scoreOf({ strength: 1, spacing: 0.05, lines: 10 });
  assert.ok(chaotic < 0.45, `a ieșit ${chaotic}`);
});

test("fără muchii, încrederea e zero", () => {
  assert.equal(scoreOf({ strength: 0, spacing: 1, lines: 10 }), 0);
});

test("clasificarea nu se hazardează sub trei muchii", () => {
  assert.equal(classify([]), "neregulata");
});
