/**
 * Testele scării din cifre.
 *
 * Fotografia poate greși; cifrele nu au voie. Ce se verifică aici e tocmai
 * ce ajunge la debitat: că o cifră scrisă în formular se regăsește nemodificată
 * în corp, că nasul nu fură din adâncimea pe care calci, și că înălțimea totală
 * e chiar suma treptelor — nu o rotunjire care adună trei milimetri pe fiecare
 * și pierde o treaptă la capăt.
 *
 *   node --test tests/stair-spec.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMFORT,
  defaultSpec,
  derive,
  fromDetection,
  kindOf,
  normalizeSpec,
} from "../src/lib/design/stair-spec.ts";
import { bestAzimuth, buildStair, footprint, outlineCenter } from "../src/lib/design/stair-solid.ts";
import { boundsOf, faceSet, project, rotateY } from "../src/lib/design/solid.ts";
import type { DesignDetection } from "../src/lib/design/model.ts";

test("scara implicită se urcă comod", () => {
  const info = derive(defaultSpec());
  assert.equal(info.rise, 175);
  assert.ok(info.stepFormula >= COMFORT.formula.min && info.stepFormula <= COMFORT.formula.max);
  assert.deepEqual(info.warnings, []);
});

test("o scară prea abruptă spune asta, dar nu se refuză", () => {
  const info = derive({ ...defaultSpec(), totalRise: 3000, steps: 12 });
  assert.equal(info.rise, 250);
  assert.ok(info.warnings.length > 0);
  assert.ok(info.warnings.some((line) => line.includes("250")));
  // Avertizează, dar cifrele ies oricum: în mansardă altă scară nu încape.
  assert.ok(info.angle > 40);
});

test("nasul nu poate fi mai lung decât jumătate de treaptă", () => {
  const spec = normalizeSpec({ ...defaultSpec(), tread: 200, nosing: 500 });
  assert.equal(spec.nosing, 100);
});

test("cotul are nevoie de o treaptă înainte și de una după", () => {
  const spec = normalizeSpec({ ...defaultSpec(), steps: 6, turn: "dreapta", turnAfter: 99, winders: 99 });
  assert.equal(spec.turnAfter, 4);
  assert.equal(spec.winders, 1);
});

test("fără cot nu există trepte în evantai", () => {
  const spec = normalizeSpec({ ...defaultSpec(), turn: "fara", winders: 5 });
  assert.equal(spec.winders, 0);
  assert.equal(kindOf(spec), "dreapta");
});

test("cifrele scrise se regăsesc în corp", () => {
  const spec = { ...defaultSpec(), totalRise: 2800, steps: 16, width: 900 };
  const box = boundsOf(buildStair(spec).solid);
  assert.ok(box);
  // Treapta de sus stă fix la înălțimea podelei de deasupra.
  assert.equal(Math.round(box.maxY), 2800);
  assert.equal(Math.round(box.maxX - box.minX), 900);
});

test("nasul iese peste contratreaptă, nu din adâncimea pe care calci", () => {
  const spec = { ...defaultSpec(), steps: 4, tread: 280, nosing: 30 };
  const treads = buildStair(spec).treads;
  // Distanța dintre două trepte vecine e chiar adâncimea, nu adâncimea plus nas.
  const first = outlineCenter(treads[0].outline);
  const second = outlineCenter(treads[1].outline);
  assert.equal(Math.round(Math.hypot(second.x - first.x, second.y - first.y)), 280);

  // Iar amprenta e mai lungă exact cu nasul care iese în față.
  assert.equal(footprint(buildStair(spec)).run, 4 * 280 + 30);
});

test("lățimea scării intră unu la unu în amprentă", () => {
  const narrow = footprint(buildStair({ ...defaultSpec(), width: 800 }));
  const wide = footprint(buildStair({ ...defaultSpec(), width: 1200 }));
  assert.equal(wide.width - narrow.width, 400);
  // Lățimea nu are ce căuta în lungime.
  assert.equal(wide.run, narrow.run);
});

test("treptele în evantai sunt exact cele cerute", () => {
  const spec = { ...defaultSpec(), turn: "dreapta" as const, turnAfter: 8, winders: 3 };
  const winders = buildStair(spec).treads.filter((tread) => tread.winder);
  assert.deepEqual(
    winders.map((tread) => tread.step),
    [9, 10, 11],
  );
});

test("cotul scurtează scara, fiindcă o întoarce", () => {
  const straight = footprint(buildStair(defaultSpec()));
  const turned = footprint(
    buildStair({ ...defaultSpec(), turn: "dreapta", turnAfter: 8, winders: 3, turnAngle: 90 }),
  );
  const back = footprint(
    buildStair({ ...defaultSpec(), turn: "stanga", turnAfter: 7, winders: 4, turnAngle: 180 }),
  );
  assert.ok(turned.run < straight.run);
  // Întoarsă de tot, scara ocupă cel mai puțin pe lungime.
  assert.ok(back.run < turned.run);
  // Dar se lățește: brațul al doilea vine alături de primul.
  assert.ok(back.width > straight.width);
});

test("cotul spre stânga e oglinda celui spre dreapta", () => {
  const right = footprint(buildStair({ ...defaultSpec(), turn: "dreapta", turnAfter: 8, winders: 3 }));
  const left = footprint(buildStair({ ...defaultSpec(), turn: "stanga", turnAfter: 8, winders: 3 }));
  assert.deepEqual(right, left);
});

test("toate treptele urcă la fel", () => {
  const spec = { ...defaultSpec(), steps: 10, totalRise: 2500 };
  const treads = buildStair(spec).treads;
  assert.equal(treads.length, 10);
  for (let i = 1; i < treads.length; i += 1) {
    assert.equal(Math.round(treads[i].top - treads[i - 1].top), 250);
  }
});

test("fără contratrepte, corpul are mai puține fețe", () => {
  const closed = buildStair({ ...defaultSpec(), closedRisers: true }).solid.faces.length;
  const open = buildStair({ ...defaultSpec(), closedRisers: false }).solid.faces.length;
  assert.ok(open < closed);
});

/* ------------------------------------------------------------------ */
/* Vederile                                                            */
/* ------------------------------------------------------------------ */

test("din fiecare parte se vede altceva, și nimic din spate", () => {
  const build = buildStair(defaultSpec());
  const total = build.solid.faces.length;
  for (const view of ["plan", "fata", "lateral", "izometric"] as const) {
    const visible = faceSet(build.solid, view);
    assert.ok(visible.length > 0, `${view} nu arată nimic`);
    assert.ok(visible.length < total, `${view} arată și fețele din spate`);
  }
});

test("de sus se văd exact fețele de sus", () => {
  // Șaisprezece blaturi și șaisprezece capace de contratreaptă, nimic altceva.
  const build = buildStair({ ...defaultSpec(), steps: 16 });
  assert.equal(faceSet(build.solid, "plan").length, 32);
});

test("fețele se așază de la depărtare spre apropiere", () => {
  const faces = faceSet(buildStair(defaultSpec()).solid, "izometric");
  for (let i = 1; i < faces.length; i += 1) {
    assert.ok(faces[i].depth >= faces[i - 1].depth);
  }
});

/*
 * Greșeala pe care o prinde testul ăsta: un izometric în care privirea cade
 * chiar în lungul rampei. Scara urcă perfect pe verticală, nu se desfășoară
 * deloc în lateral, și iese o scară de mână rezemată de perete. S-a întâmplat
 * cu unghiul ales numai după urcare.
 */
test("unghiul ales arată scara urcând și desfășurându-se", () => {
  for (const spec of [
    defaultSpec(),
    { ...defaultSpec(), turn: "dreapta" as const, turnAfter: 8, winders: 3, turnAngle: 90 },
    { ...defaultSpec(), turn: "stanga" as const, turnAfter: 7, winders: 4, turnAngle: 180 },
  ]) {
    const build = buildStair(spec);
    const azimuth = bestAzimuth(build);
    const centers = build.treads.map((tread) => {
      const middle = outlineCenter(tread.outline);
      return project(rotateY({ x: middle.x, y: tread.top, z: middle.y }, azimuth), "izometric");
    });

    for (let i = 1; i < centers.length; i += 1) {
      const climb = centers[i - 1].y - centers[i].y;
      const spread = Math.abs(centers[i].x - centers[i - 1].x);
      assert.ok(climb > 0, `treapta ${i + 1} nu urcă pe ecran`);
      /*
       * „Se desfășoară” nu înseamnă „nu e zero”: la un unghi aproape în lungul
       * rampei, treptele tot se despart cu câțiva pixeli și scara tot arată ca
       * o scară de mână. Pragul e o cifră fizică — treapta trebuie să meargă în
       * lateral cel puțin cât două cincimi din adâncimea ei adevărată.
       */
      assert.ok(
        spread >= spec.tread * 0.4,
        `treapta ${i + 1} abia se desfășoară: ${spread.toFixed(0)} din ${spec.tread}`,
      );
    }
  }
});

/* ------------------------------------------------------------------ */
/* Puntea dinspre fotografie                                           */
/* ------------------------------------------------------------------ */

function detection(over: Partial<DesignDetection> = {}): DesignDetection {
  return { steps: 12, kind: "dreapta", angle: 32, confidence: 0.7, warning: null, ...over };
}

test("fotografia dă numărul de trepte și unghiul, restul rămâne implicit", () => {
  const spec = fromDetection(detection({ steps: 14 }));
  assert.equal(spec.steps, 14);
  // Unghiul de 32° cu o treaptă obișnuită de 175 mm dă cam 280 mm adâncime.
  assert.ok(Math.abs(spec.tread - 280) < 15);
  // Lățimea nu se vede într-o poză, deci nu se ghicește.
  assert.equal(spec.width, defaultSpec().width);
});

test("o detecție goală nu schimbă nimic", () => {
  const base = { ...defaultSpec(), steps: 9 };
  assert.deepEqual(fromDetection(null, base), normalizeSpec(base));
  assert.deepEqual(fromDetection(detection({ steps: 1 }), base), normalizeSpec(base));
});

test("o scară în evantai citită din poză vine cu cot", () => {
  const spec = fromDetection(detection({ kind: "evantai" }));
  assert.notEqual(spec.turn, "fara");
  assert.ok(spec.winders > 0);
});
