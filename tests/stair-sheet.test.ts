/**
 * Testele planșei: patru vederi care nu se contrazic.
 *
 * O planșă greșită e mai rea decât niciuna, fiindcă omul taie după ea. Aici se
 * verifică lucrurile care fac diferența dintre un desen și o mâzgăleală: că
 * fiecare cotă scrisă e chiar cifra din model, că nicio cotă nu cade peste
 * piesă, și că pe aceeași foaie nu apar două unități de măsură.
 *
 *   node --test tests/stair-sheet.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSheet, layoutSheet, mm, paneExtent } from "../src/lib/design/sheet.ts";
import type { Pane, Sheet } from "../src/lib/design/sheet.ts";
import { sheetToSvg } from "../src/lib/design/export.ts";
import { defaultSpec } from "../src/lib/design/stair-spec.ts";

const STRAIGHT = defaultSpec();
const TURNED = { ...defaultSpec(), turn: "dreapta" as const, turnAfter: 8, winders: 3, turnAngle: 90 };

function paneOf(sheet: Sheet, id: string): Pane {
  const pane = sheet.panes.find((row) => row.id === id);
  assert.ok(pane, `lipsește panoul ${id}`);
  return pane;
}

/** Marginile a ceea ce e desenat, fără cote — adică piesa însăși. */
function drawingBox(pane: Pane) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of pane.polygons) {
    for (const point of polygon.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

test("planșa are toate vederile, plus detaliul", () => {
  const sheet = buildSheet(STRAIGHT, "Scară");
  assert.deepEqual(
    sheet.panes.map((pane) => pane.id),
    ["fata", "plan", "lateral", "izometric", "detaliu"],
  );
  for (const pane of sheet.panes) {
    assert.ok(pane.polygons.length > 0, `panoul ${pane.id} e gol`);
    assert.ok(pane.title.length > 0);
  }
});

test("cotele scrise sunt chiar gabaritul scării", () => {
  const sheet = buildSheet(STRAIGHT, "Scară");
  const written = new Set(
    sheet.panes.flatMap((pane) => pane.texts.filter((t) => t.role === "cota").map((t) => t.value)),
  );
  assert.ok(written.has(mm(sheet.footprint.height)));
  assert.ok(written.has(mm(sheet.footprint.width)));
  assert.ok(written.has(mm(sheet.footprint.run)));
});

/*
 * Greșeala pe care o prinde testul ăsta: cota de înălțime trasă cu semn greșit
 * cădea fix peste trepte, iar cifra se citea peste desen. Normala e la stânga
 * direcției, deci o cotă trasă de jos în sus are „afară” la negativ — ușor de
 * greșit, imposibil de ratat odată scris testul.
 */
test("nicio cotă nu cade peste piesă", () => {
  for (const spec of [STRAIGHT, TURNED]) {
    const sheet = buildSheet(spec, "Scară");
    for (const pane of sheet.panes) {
      const box = drawingBox(pane);
      for (const text of pane.texts) {
        // Numerele treptelor stau înadins în mijlocul lor, în plan.
        if (text.role !== "cota") continue;
        const inside =
          text.at.x > box.minX && text.at.x < box.maxX && text.at.y > box.minY && text.at.y < box.maxY;
        assert.ok(!inside, `cota „${text.value}” cade peste desen în panoul ${pane.id}`);
      }
    }
  }
});

test("pe planșă se scriu numai milimetri", () => {
  const sheet = buildSheet({ ...STRAIGHT, totalRise: 3200 }, "Scară");
  const texts = sheet.panes.flatMap((pane) => pane.texts.map((t) => t.value));
  assert.ok(texts.some((value) => value.includes("mm")));
  for (const value of texts) {
    assert.ok(!value.includes("cm"), `„${value}” amestecă unitățile`);
  }
  assert.equal(mm(3200), "3200 mm");
});

test("fiecare treaptă e numerotată în plan, de jos în sus", () => {
  const sheet = buildSheet({ ...STRAIGHT, steps: 12 }, "Scară");
  const numbers = paneOf(sheet, "plan")
    .texts.filter((text) => text.role === "numar")
    .map((text) => Number(text.value));
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("detaliul deosebește adâncimea pe care calci de adâncimea piesei", () => {
  const sheet = buildSheet({ ...STRAIGHT, tread: 280, nosing: 30 }, "Scară");
  const written = paneOf(sheet, "detaliu").texts.map((text) => text.value);
  assert.ok(written.includes("280 mm"), "lipsește adâncimea pe care calci");
  assert.ok(written.includes("310 mm"), "lipsește adâncimea întreagă a blatului");
  assert.ok(written.includes("40 mm"), "lipsește grosimea blatului");
  assert.ok(written.includes("20 mm"), "lipsește grosimea contratreptei");
});

test("avertismentele despre proporții ajung pe planșă", () => {
  const steep = buildSheet({ ...STRAIGHT, totalRise: 3000, steps: 12 }, "Abruptă");
  assert.ok(steep.warnings.length > 0);
  assert.ok(sheetToSvg(steep).includes(steep.warnings[0].slice(0, 20)));
});

/* ------------------------------------------------------------------ */
/* Așezarea în pagină                                                  */
/* ------------------------------------------------------------------ */

test("panourile stau în pagină și nu se calcă unul pe altul", () => {
  for (const tall of [false, true]) {
    const { page, panes } = layoutSheet(buildSheet(TURNED, "Scară"), tall);
    for (const placed of panes) {
      assert.ok(placed.frame.x >= -0.001);
      assert.ok(placed.frame.y >= -0.001);
      assert.ok(placed.frame.x + placed.frame.width <= page.width + 0.001);
      // Fâșia de jos e a indicatorului; niciun panou n-are voie în ea.
      assert.ok(placed.frame.y + placed.frame.height <= page.height - 40);
    }

    for (let i = 0; i < panes.length; i += 1) {
      for (let j = i + 1; j < panes.length; j += 1) {
        const a = panes[i].frame;
        const b = panes[j].frame;
        const apart =
          a.x + a.width <= b.x + 0.001 ||
          b.x + b.width <= a.x + 0.001 ||
          a.y + a.height <= b.y + 0.001 ||
          b.y + b.height <= a.y + 0.001;
        assert.ok(apart, `panourile ${panes[i].pane.id} și ${panes[j].pane.id} se suprapun`);
      }
    }
  }
});

test("desenul fiecărui panou încape în chenarul lui", () => {
  const { panes } = layoutSheet(buildSheet(TURNED, "Scară"), false);
  for (const placed of panes) {
    const box = paneExtent(placed.pane);
    assert.ok(box);
    const left = box.minX * placed.scale + placed.tx;
    const right = box.maxX * placed.scale + placed.tx;
    const top = box.minY * placed.scale + placed.ty;
    const bottom = box.maxY * placed.scale + placed.ty;
    assert.ok(left >= placed.frame.x - 0.001, `${placed.pane.id} iese în stânga`);
    assert.ok(right <= placed.frame.x + placed.frame.width + 0.001, `${placed.pane.id} iese în dreapta`);
    assert.ok(top >= placed.frame.y - 0.001, `${placed.pane.id} iese în sus`);
    assert.ok(bottom <= placed.frame.y + placed.frame.height + 0.001, `${placed.pane.id} iese în jos`);
  }
});

test("pe telefon planșa se înaltă, pe hârtie se lățește", () => {
  const sheet = buildSheet(STRAIGHT, "Scară");
  const wide = layoutSheet(sheet, false).page;
  const tall = layoutSheet(sheet, true).page;
  assert.ok(wide.width > wide.height);
  assert.ok(tall.height > tall.width);
});

test("SVG-ul planșei iese alb, cu toate panourile", () => {
  const svg = sheetToSvg(buildSheet(TURNED, "Scară cotită"));
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('fill="#ffffff"'));
  for (const title of ["Vedere din față", "Plan (de sus)", "Vedere laterală", "Vedere 3D", "Detaliu treaptă"]) {
    assert.ok(svg.includes(title), `SVG-ul nu are panoul „${title}”`);
  }
  // Fără nicio imagine încorporată: e desen, nu poză.
  assert.ok(!svg.includes("<image"));
});

test("aceleași cifre dau aceeași planșă", () => {
  const first = sheetToSvg(buildSheet(TURNED, "Scară"));
  const second = sheetToSvg(buildSheet({ ...TURNED }, "Scară"));
  assert.equal(first, second);
});
