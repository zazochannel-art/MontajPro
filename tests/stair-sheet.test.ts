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
import {
  FINISHES,
  PALETTES,
  buildSheet,
  fillOf,
  grainLines,
  layoutSheet,
  mm,
  paneExtent,
  strokeOf,
  variantOf,
} from "../src/lib/design/sheet.ts";
import type { Pane, Sheet } from "../src/lib/design/sheet.ts";
import { sheetToSvg } from "../src/lib/design/export.ts";
import { defaultSpec, normalizeSpec } from "../src/lib/design/stair-spec.ts";
import { buildStair, footprint } from "../src/lib/design/stair-solid.ts";

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

/* ------------------------------------------------------------------ */
/* Muchia treptei                                                      */
/* ------------------------------------------------------------------ */

test("muchia dreaptă scoate nasul din geometrie, nu doar de pe desen", () => {
  const withNose = normalizeSpec({ ...STRAIGHT, edge: "nas", nosing: 30 });
  const flush = normalizeSpec({ ...STRAIGHT, edge: "dreapta", nosing: 30 });
  assert.equal(flush.nosing, 0);
  // Nasul ieșea în față, deci scara scurtează exact cu el.
  assert.equal(
    footprint(buildStair(withNose)).run - footprint(buildStair(flush)).run,
    30,
  );
});

test("un desen salvat înainte de alegerea muchiei rămâne cu nas", () => {
  // Câmpul lipsește cu totul, cum arată datele scrise înainte.
  const old = { ...STRAIGHT } as Partial<typeof STRAIGHT>;
  delete old.edge;
  assert.equal(normalizeSpec(old as typeof STRAIGHT).edge, "nas");
});

/*
 * Greșeala pe care o prinde testul ăsta: pe muchie dreaptă, detaliul scria
 * „0 mm” între două linii suprapuse și repeta adâncimea de două ori. Un desen
 * corect care pare greșit e tot un desen prost.
 */
test("pe muchie dreaptă nu se cotează nasul care nu există", () => {
  const flush = buildSheet({ ...STRAIGHT, edge: "dreapta" }, "Dreaptă");
  const written = paneOf(flush, "detaliu").texts.map((text) => text.value);
  assert.ok(!written.includes("0 mm"), "cotează un nas de zero");
  assert.equal(
    written.filter((value) => value === "280 mm").length,
    1,
    "scrie adâncimea de două ori",
  );
  // Cifrele care chiar există rămân.
  assert.ok(written.includes("40 mm"));
  assert.ok(written.includes("20 mm"));
});

/* ------------------------------------------------------------------ */
/* Cerneala: lemn sau tehnic                                           */
/* ------------------------------------------------------------------ */

test("firul lemnului stă în interiorul feței, nu pe lângă ea", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ];
  const grain = grainLines(square, 4);
  assert.equal(grain.length, 4);
  for (const line of grain) {
    for (const point of [line.a, line.b]) {
      assert.ok(point.x >= -0.001 && point.x <= 100.001, "firul iese pe lateral");
      assert.ok(point.y >= -0.001 && point.y <= 60.001, "firul iese pe verticală");
    }
    // Merge pe lungime, cum se debitează un blat: pe fibră.
    assert.ok(Math.abs(line.a.x - line.b.x) > Math.abs(line.a.y - line.b.y));
  }
});

test("o față degenerată n-are fir", () => {
  assert.deepEqual(grainLines([{ x: 0, y: 0 }, { x: 1, y: 1 }]), []);
  assert.deepEqual(grainLines([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]), []);
});

test("fiecare față își știe orientarea, iar cele din umbră n-au fir", () => {
  const sheet = buildSheet(TURNED, "Scară");
  const tones = new Set<string>();
  for (const pane of sheet.panes) {
    for (const polygon of pane.polygons) {
      tones.add(polygon.tone);
      if (polygon.tone === "lateral") {
        assert.equal(polygon.grain.length, 0, "fața din umbră are fir degeaba");
      }
    }
  }
  // Izometricul arată toate cele trei orientări; de aia se citește ca un solid.
  assert.deepEqual([...tones].sort(), ["fata", "lateral", "sus"]);
});

test("paleta acoperă toate orientările, în ambele cerneli", () => {
  for (const finish of FINISHES) {
    const ink = PALETTES[finish];
    for (const tone of ["sus", "fata", "lateral"] as const) {
      assert.match(ink.fill[tone], /^#[0-9a-f]{6}$/i, `${finish}/${tone} n-are umplere`);
      if (ink.grain) assert.match(ink.grain[tone], /^#[0-9a-f]{6}$/i);
    }
  }
  // Desenul tehnic rămâne fără fir: lângă un ferăstrău, liniile în plus încurcă.
  assert.equal(PALETTES.tehnic.grain, null);
  assert.notEqual(PALETTES.lemn.grain, null);
});

test("cerneala schimbă numai culorile, nu și geometria", () => {
  const sheet = buildSheet(TURNED, "Scară");
  const wood = sheetToSvg(sheet, false, "lemn");
  const ink = sheetToSvg(sheet, false, "tehnic");

  const corners = (svg: string) => svg.match(/<polygon points="([^"]+)"/g);
  assert.deepEqual(corners(wood), corners(ink));

  // Dar hârtia și cerneala diferă, iar firul apare numai pe lemn.
  assert.ok(wood.includes(PALETTES.lemn.paper));
  assert.ok(ink.includes(PALETTES.tehnic.paper));
  assert.ok(wood.includes(PALETTES.lemn.grain!.sus));
  assert.ok(!ink.includes(PALETTES.lemn.grain!.sus));
});

/* ------------------------------------------------------------------ */
/* Lemnul: fir, nuanțe, umbră                                          */
/* ------------------------------------------------------------------ */

test("firul se îndesește după lățimea piesei", () => {
  const thin = grainLines([
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 40 },
    { x: 0, y: 40 },
  ]);
  const wide = grainLines([
    { x: 0, y: 0 },
    { x: 900, y: 0 },
    { x: 900, y: 280 },
    { x: 0, y: 280 },
  ]);
  // Patru fire pe un blat de 4 cm arată ca un gard; pe unul de 28 cm arată rar.
  assert.ok(wide.length > thin.length, `${wide.length} nu e mai mult ca ${thin.length}`);
  assert.ok(thin.length >= 2 && wide.length <= 8);
});

test("firele nu stau la distanțe egale", () => {
  const grain = grainLines([
    { x: 0, y: 0 },
    { x: 900, y: 0 },
    { x: 900, y: 280 },
    { x: 0, y: 280 },
  ]);
  const gaps: number[] = [];
  for (let i = 1; i < grain.length; i += 1) {
    gaps.push(Math.abs(grain[i].a.y - grain[i - 1].a.y));
  }
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  // Lemnul crescut la riglă nu există, iar ochiul recunoaște imediat șirul perfect.
  assert.ok(
    gaps.some((gap) => Math.abs(gap - average) > average * 0.08),
    "firele ies la linie, ca desenate de o mașină",
  );
});

test("aceeași față are mereu același fir", () => {
  const face = [
    { x: 12, y: 7 },
    { x: 912, y: 7 },
    { x: 912, y: 287 },
    { x: 12, y: 287 },
  ];
  assert.deepEqual(grainLines(face), grainLines(face));
  // Dar o față așezată în alt loc are firul ei.
  const moved = face.map((point) => ({ x: point.x + 500, y: point.y }));
  assert.notDeepEqual(
    grainLines(face).map((line) => line.a.y),
    grainLines(moved).map((line) => line.a.y),
  );
});

test("nuanța blatului e statornică și mică", () => {
  for (let step = 1; step <= 20; step += 1) {
    assert.equal(variantOf(step), variantOf(step));
    assert.ok(Math.abs(variantOf(step)) <= 1);
  }
  // Blaturi diferite, scânduri diferite.
  assert.notEqual(variantOf(3), variantOf(4));
});

test("umplerea albă a desenului tehnic nu se nuanțează", () => {
  // Albul de acolo are o treabă: acoperă treapta din spate. Orice nuanță încurcă.
  for (const variant of [-3, -1, 0, 1, 3]) {
    assert.equal(fillOf(PALETTES.tehnic, "treapta", "sus", variant), PALETTES.tehnic.fill.sus);
  }
});

test("pe lemn nuanța mișcă culoarea, dar nu oricât", () => {
  const base = fillOf(PALETTES.lemn, "treapta", "sus", 0);
  assert.equal(base, PALETTES.lemn.fill.sus);
  assert.notEqual(fillOf(PALETTES.lemn, "treapta", "sus", 1), base);
  // Peste limită se oprește: o față nu are voie să iasă din paletă.
  assert.equal(fillOf(PALETTES.lemn, "treapta", "sus", 9), fillOf(PALETTES.lemn, "treapta", "sus", 3));
});

/*
 * Greșeala pe care o prinde testul ăsta: contratreapta ieșea exact în nuanța
 * muchiei de blat de deasupra ei, cele două se lipeau într-o bandă lată, iar
 * scara părea făcută din blaturi care plutesc. Contratreapta stă retrasă sub
 * nas, deci primește mai puțină lumină — nu e alegere de culoare, e umbră.
 */
test("contratreapta stă în umbra nasului, deci e mai închisă", () => {
  const iso = paneOf(buildSheet(STRAIGHT, "Scară"), "izometric");
  const mean = (kind: string) => {
    const rows = iso.polygons.filter((polygon) => polygon.kind === kind);
    assert.ok(rows.length > 4, `prea puține fețe de fel „${kind}”`);
    return rows.reduce((sum, polygon) => sum + polygon.variant, 0) / rows.length;
  };

  /*
   * Media, nu împrăștierea: fiecare blat are deja abaterea lui de scândură, iar
   * pe șaisprezece trepte abaterile alea singure acoperă un interval întreg.
   * Un test care se uită la interval trece și fără umbră — a și trecut.
   */
  assert.ok(
    mean("treapta") - mean("contratreapta") > 1.5,
    "contratreapta iese în aceeași nuanță cu blatul de deasupra",
  );
});

test("lemnul se desenează cu linie mai subțire decât cerneala", () => {
  assert.ok(strokeOf(PALETTES.lemn, "main") < strokeOf(PALETTES.tehnic, "main"));
  for (const finish of FINISHES) {
    assert.ok(strokeOf(PALETTES[finish], "detail") < strokeOf(PALETTES[finish], "main"));
  }
});
