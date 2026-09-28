/**
 * Testele modelului: desenul ca geometrie.
 *
 * Aici se verifică exact ce face desenul editabil, adică ce-l desparte de o
 * poză: că punctele se mișcă, că treptele se adaugă și se șterg fără să lase
 * cioburi, și că o redimensionare nu schimbă în tăcere milimetrii.
 *
 *   node --test tests/design-model.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDimension,
  addStep,
  bounds,
  emptyDesign,
  isEmpty,
  mergePoints,
  moveStep,
  movePoint,
  removeStep,
  rotate,
  scaleBy,
  splitEdge,
  stepPoints,
  usedPoints,
} from "../src/lib/design/model.ts";
import {
  formatMeasure,
  measureStep,
  polygonArea,
  scaleFrom,
  toMm,
  totalArea,
} from "../src/lib/design/measure.ts";
import { toSvg, fileName } from "../src/lib/design/export.ts";

/** O treaptă dreaptă, 100 pe 30. */
function oneStep() {
  return addStep(emptyDesign(), [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 30 },
    { x: 0, y: 30 },
  ]);
}

test("un desen gol e gol", () => {
  assert.equal(isEmpty(emptyDesign()), true);
  assert.equal(bounds(emptyDesign()), null);
});

test("treapta adăugată are punctele ei și numărul 1", () => {
  const doc = oneStep();
  assert.equal(doc.steps.length, 1);
  assert.equal(doc.steps[0].index, 1);
  assert.equal(stepPoints(doc, doc.steps[0]).length, 4);
});

test("treptele se numerotează în ordine", () => {
  let doc = oneStep();
  doc = addStep(doc, [
    { x: 0, y: 30 },
    { x: 100, y: 30 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ]);
  assert.deepEqual(doc.steps.map((step) => step.index), [1, 2]);
});

test("mutarea unui punct nu atinge restul", () => {
  const doc = oneStep();
  const id = doc.steps[0].points[0];
  const moved = movePoint(doc, id, 10, 10);

  assert.deepEqual({ x: moved.points[id].x, y: moved.points[id].y }, { x: 10, y: 10 });
  const other = doc.steps[0].points[1];
  assert.deepEqual(moved.points[other], doc.points[other]);
});

test("mutarea treptei duce toate colțurile deodată", () => {
  const doc = oneStep();
  const moved = moveStep(doc, doc.steps[0].id, 5, -5);
  const box = bounds(moved);
  assert.deepEqual(box, { minX: 5, minY: -5, maxX: 105, maxY: 25 });
});

test("ștergerea treptei nu lasă puncte orfane", () => {
  const doc = oneStep();
  const gone = removeStep(doc, doc.steps[0].id);
  assert.deepEqual(gone.steps, []);
  assert.deepEqual(Object.keys(gone.points), [], "punctele pleacă odată cu ea");
});

test("ștergerea renumerotează ce rămâne", () => {
  let doc = oneStep();
  doc = addStep(doc, [{ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 60 }]);
  doc = addStep(doc, [{ x: 0, y: 60 }, { x: 100, y: 60 }, { x: 100, y: 90 }]);

  const gone = removeStep(doc, doc.steps[0].id);
  assert.deepEqual(gone.steps.map((step) => step.index), [1, 2], "fără goluri în numerotare");
});

test("ștergerea duce cu ea și cotele rămase fără capete", () => {
  let doc = oneStep();
  const [a, b] = doc.steps[0].points;
  doc = addDimension(doc, a, b);
  assert.equal(doc.dimensions.length, 1);

  const gone = removeStep(doc, doc.steps[0].id);
  assert.deepEqual(gone.dimensions, []);
});

test("unirea a două puncte le face unul singur", () => {
  let doc = oneStep();
  doc = addStep(doc, [{ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 60 }]);

  const keep = doc.steps[0].points[3];
  const drop = doc.steps[1].points[0];
  const merged = mergePoints(doc, keep, drop);

  assert.equal(merged.points[drop], undefined);
  assert.ok(merged.steps[1].points.includes(keep), "treapta a doua îl folosește pe cel rămas");
});

test("unirea nu lasă același punct de două ori la rând", () => {
  const doc = oneStep();
  const [a, b] = doc.steps[0].points;
  const merged = mergePoints(doc, a, b);
  const points = merged.steps[0].points;
  for (let i = 1; i < points.length; i += 1) {
    assert.notEqual(points[i], points[i - 1]);
  }
});

test("ruperea unei laturi pune un punct la mijloc", () => {
  const doc = oneStep();
  const split = splitEdge(doc, doc.steps[0].id, 0);

  assert.equal(split.steps[0].points.length, 5);
  const middle = split.points[split.steps[0].points[1]];
  assert.deepEqual({ x: middle.x, y: middle.y }, { x: 50, y: 0 });
});

test("rotirea cu 360 de grade aduce desenul înapoi", () => {
  const doc = oneStep();
  const turned = rotate(doc, 360);
  for (const id of Object.keys(doc.points)) {
    assert.ok(Math.abs(turned.points[id].x - doc.points[id].x) < 1e-9);
    assert.ok(Math.abs(turned.points[id].y - doc.points[id].y) < 1e-9);
  }
});

test("redimensionarea nu schimbă milimetrii", () => {
  /*
   * Asta e regula care contează: desenul se poate mări cât vrea omul pe ecran,
   * dar treapta rămâne de 1000 mm. Dacă scara n-ar fi ajustată invers, o
   * apăsare pe „mărește” ar tăia lemnul altfel.
   */
  let doc = oneStep();
  doc = { ...doc, scale: 10 }; // o unitate = 10 mm, deci treapta are 1000 mm
  const before = toMm(doc, 100);

  // Scalarea se face din centru, deci desenul crește în ambele părți:
  // lățimea se dublează, colțurile nu rămân pe loc.
  const bigger = scaleBy(doc, 2);
  const box = bounds(bigger);
  assert.equal((box?.maxX ?? 0) - (box?.minX ?? 0), 200, "desenul chiar s-a dublat");
  assert.equal(toMm(bigger, 200), before, "dar măsura reală a rămas 1000 mm");
});

test("un desen necalibrat nu scrie milimetri", () => {
  const doc = oneStep();
  assert.equal(doc.scale, null);
  assert.equal(toMm(doc, 100), null);
  assert.equal(formatMeasure(doc, 100), "100 u");
});

test("calibrarea dă milimetri", () => {
  const doc = { ...oneStep(), scale: scaleFrom({ x: 0, y: 0 }, { x: 100, y: 0 }, 1000) };
  assert.equal(doc.scale, 10);
  assert.equal(formatMeasure(doc, 100), "1000 mm");
});

test("două puncte suprapuse nu dau scară", () => {
  assert.equal(scaleFrom({ x: 5, y: 5 }, { x: 5, y: 5 }, 1000), null);
});

test("o valoare fără sens nu dă scară", () => {
  assert.equal(scaleFrom({ x: 0, y: 0 }, { x: 100, y: 0 }, 0), null);
  assert.equal(scaleFrom({ x: 0, y: 0 }, { x: 100, y: 0 }, -50), null);
});

test("aria unui dreptunghi e lățimea ori înălțimea", () => {
  assert.equal(
    polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]),
    40,
  );
});

test("măsurile unei trepte drepte", () => {
  const doc = oneStep();
  const measures = measureStep(doc, doc.steps[0]);
  assert.equal(measures?.width, 100, "muchia din față");
  assert.equal(measures?.depth, 30, "adâncimea, din arie împărțită la muchie");
  assert.equal(measures?.angle, 0, "muchie orizontală");
});

test("adâncimea unei trepte trapezoidale e media, nu o latură", () => {
  // Trapez: muchia din față 100, spatele 60. Aria 2400, deci adâncimea medie 24.
  const doc = addStep(emptyDesign(), [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 80, y: 30 },
    { x: 20, y: 30 },
  ]);
  const measures = measureStep(doc, doc.steps[0]);
  assert.equal(measures?.width, 100);
  assert.equal(measures?.depth, 24);
});

test("suprafața totală iese în metri pătrați doar calibrată", () => {
  const doc = oneStep();
  assert.equal(totalArea(doc).m2, null);

  const calibrated = { ...doc, scale: 10 };
  // 100×30 unități, la 10 mm unitatea: 1000×300 mm = 0,3 m².
  assert.equal(totalArea(calibrated).m2, 0.3);
});

test("punctele folosite sunt cele ale treptelor și cotelor", () => {
  const doc = oneStep();
  assert.equal(usedPoints(doc).size, 4);
});

/* ----------------------------- export ----------------------------- */

test("SVG-ul are un poligon pe treaptă și nicio poză", () => {
  const doc = oneStep();
  const svg = toSvg(doc);
  assert.equal((svg.match(/<polygon/g) ?? []).length, 1);
  assert.ok(!svg.includes("<image"), "fotografia n-are ce căuta în rezultat");
  assert.ok(svg.includes('fill="none"'), "contur, nu suprafață colorată");
});

test("SVG-ul scrie cota în unități cât desenul nu e calibrat", () => {
  let doc = oneStep();
  const [a, b] = doc.steps[0].points;
  doc = addDimension(doc, a, b);
  assert.ok(toSvg(doc).includes("100 u"));
});

test("SVG-ul scrie milimetri după calibrare", () => {
  let doc = oneStep();
  const [a, b] = doc.steps[0].points;
  doc = addDimension(doc, a, b);
  assert.ok(toSvg({ ...doc, scale: 10 }).includes("1000 mm"));
});

test("un desen gol nu dă un SVG stricat", () => {
  const svg = toSvg(emptyDesign());
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.endsWith("</svg>"));
});

test("numele fișierului scapă de diacritice și spații", () => {
  assert.equal(fileName("Scară stejar — bloc 12", "svg"), "scara-stejar-bloc-12.svg");
  assert.equal(fileName("", "pdf"), "desen.pdf");
});
