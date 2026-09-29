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
import { buildSheet } from "../src/lib/design/sheet.ts";
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
  // Fără zidărie: aici se măsoară scara, nu casa scării din jurul ei.
  const spec = { ...defaultSpec(), totalRise: 2800, steps: 16, width: 900, walls: false };
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
  const build = buildStair({ ...defaultSpec(), steps: 16, walls: false });
  assert.equal(faceSet(build.solid, "plan").length, 32);
});

test("fețele se așază de la depărtare spre apropiere", () => {
  // Zidăria are regula ei — stă în spate oricât de aproape ar fi — și se
  // verifică separat. Între fețele scării, ordinea e cea din adâncime.
  const faces = faceSet(buildStair(defaultSpec()).solid, "izometric").filter(
    (face) => face.kind !== "perete",
  );
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

/* ------------------------------------------------------------------ */
/* Colțul cotului și zidăria                                           */
/* ------------------------------------------------------------------ */

const CORNER = {
  ...defaultSpec(),
  turn: "dreapta" as const,
  turnAfter: 8,
  winders: 3,
  turnAngle: 90,
  newel: 60,
  width: 900,
  tread: 280,
};

/*
 * Greșeala pe care o prinde testul ăsta: treptele în evantai se opreau la o
 * rază constantă în jurul stâlpului, așa că în plan colțul ieșea rotunjit și
 * rămânea un triunghi de podea nefolosit în spatele lor. O scară se întoarce
 * într-un colț de zidărie, iar treptele se taie ca să-l umple.
 */
test("treptele în evantai ajung până în colțul pătrat", () => {
  const build = buildStair(CORNER);
  // După opt trepte drepte, stâlpul e la (0, 8 × adâncime).
  const pivot = { x: 0, y: 8 * CORNER.tread };
  const radius = CORNER.newel + CORNER.width;

  let reach = 0;
  for (const tread of build.treads.filter((row) => row.winder)) {
    for (const point of tread.outline) {
      reach = Math.max(reach, Math.hypot(point.x - pivot.x, point.y - pivot.y));
    }
  }

  // Colțul a două ziduri la 90° stă la rază × √2, nu la rază.
  assert.ok(
    Math.abs(reach - radius * Math.SQRT2) < 2,
    `colțul e la ${Math.round(reach)} mm, se aștepta ${Math.round(radius * Math.SQRT2)}`,
  );
});

test("colțul pătrat umple colțul, dar nu iese din ziduri", () => {
  /*
   * Diferența dintre arc și colț e arie, nu gabarit: punctul cel mai depărtat
   * de stâlp sare de la rază la rază × √2, dar pe fiecare axă în parte
   * treptele tot se opresc la zid. Dacă ar trece de el, scara ar fi desenată
   * intrând în zidărie.
   */
  const build = buildStair(CORNER);
  const pivot = { x: 0, y: 8 * CORNER.tread };
  const radius = CORNER.newel + CORNER.width;

  for (const tread of build.treads.filter((row) => row.winder)) {
    for (const point of tread.outline) {
      assert.ok(point.x >= pivot.x - radius - 1, "treapta trece prin zidul din stânga");
      assert.ok(point.y <= pivot.y + radius + 1, "treapta trece prin zidul de jos");
    }
  }

  /*
   * Iar amprenta iese din brațe, nu din colț: pe lățime, zidul din stânga plus
   * brațul de după cot; pe lungime, brațul dinainte plus zidul de jos, și
   * nasul primei trepte, care iese în față.
   */
  const after = CORNER.steps - CORNER.turnAfter - CORNER.winders;
  const size = footprint(build);
  assert.equal(size.width, radius + after * CORNER.tread);
  assert.equal(size.run, CORNER.turnAfter * CORNER.tread + radius + CORNER.nosing);
});

test("o întoarcere la 180° dă trei ziduri, adică o casă de scară în U", () => {
  const half = buildStair({ ...CORNER, turnAfter: 7, winders: 4, turnAngle: 180 });
  const pivot = { x: 0, y: 7 * CORNER.tread };
  const radius = CORNER.newel + CORNER.width;

  let reach = 0;
  for (const tread of half.treads.filter((row) => row.winder)) {
    for (const point of tread.outline) {
      reach = Math.max(reach, Math.hypot(point.x - pivot.x, point.y - pivot.y));
    }
  }
  // Tot colțuri de 90°: cel mai departe punct rămâne la rază × √2.
  assert.ok(Math.abs(reach - radius * Math.SQRT2) < 2);
});

test("zidul apare doar când e cerut, și nu intră în gabarit", () => {
  const withWalls = buildStair({ ...CORNER, walls: true });
  const bare = buildStair({ ...CORNER, walls: false });

  const walls = withWalls.solid.faces.filter((face) => face.kind === "perete");
  assert.ok(walls.length > 0, "zidul lipsește");
  assert.equal(bare.solid.faces.filter((face) => face.kind === "perete").length, 0);
  // Cota spune cât ține scara; dacă ar cuprinde zidul, n-ar mai fi cifra pe care o tai.
  assert.deepEqual(footprint(withWalls), footprint(bare));
});

/*
 * Greșeala pe care o prinde testul ăsta: sensul „în afară” se lua față de
 * mijlocul muchiei, iar pe un braț drept mijlocul cade chiar pe muchie, deci
 * semnul ieșea la întâmplare — zidul fie dispărea, fie se așeza peste trepte.
 */
test("pe o scară dreaptă zidul stă lângă scară, nu peste ea", () => {
  const build = buildStair({ ...defaultSpec(), walls: true, width: 900, newel: 60 });
  const walls = build.solid.faces.filter((face) => face.kind === "perete");
  assert.ok(walls.length > 0, "zidul lipsește pe scara dreaptă");

  const outer = 60 + 900;
  for (const face of walls) {
    for (const point of face.points) {
      // Muchia scării e la 960; zidul e dincolo de ea, niciodată înăuntru.
      assert.ok(point.x >= outer - 1, `zidul intră peste trepte, la x = ${Math.round(point.x)}`);
    }
  }
});

test("zidăria se desenează în spatele scării, în toate vederile", () => {
  const build = buildStair({ ...CORNER, walls: true });
  for (const view of ["plan", "fata", "lateral", "izometric"] as const) {
    const faces = faceSet(build.solid, view);
    const lastWall = faces.map((face) => face.kind).lastIndexOf("perete");
    const firstStair = faces.findIndex((face) => face.kind !== "perete");
    assert.ok(lastWall >= 0, `${view}: zidul lipsește`);
    assert.ok(firstStair >= 0, `${view}: scara lipsește`);
    // Desenul e o secțiune: casa scării se taie ca să se vadă ce e înăuntru.
    assert.ok(lastWall < firstStair, `${view}: zidul acoperă scara`);
  }
});

/* ------------------------------------------------------------------ */
/* Talpa de beton și zidul în pantă                                    */
/* ------------------------------------------------------------------ */

const CONCRETE = { ...defaultSpec(), concrete: true, slab: 120, steps: 10, totalRise: 1750 };

test("betonul apare doar când e cerut și nu intră în gabarit", () => {
  const cu = buildStair(CONCRETE);
  const fara = buildStair({ ...CONCRETE, concrete: false });
  assert.ok(cu.solid.faces.some((face) => face.kind === "beton"));
  assert.ok(!fara.solid.faces.some((face) => face.kind === "beton"));
  // Cota e a scării; talpa o poartă, nu face parte din ea.
  assert.deepEqual(footprint(cu), footprint(fara));
});

/*
 * Greșeala pe care ar prinde-o testul ăsta: o talpă ridicată drept sub fiecare
 * treaptă și tăiată pe urmă. Fundul i-ar ieși în trepte — o scară sub scară —
 * în loc de panta continuă care se vede pe orice scară de beton din lateral.
 */
test("talpa coboară în pantă continuă, nu în trepte", () => {
  const faces = buildStair(CONCRETE).solid.faces.filter((face) => face.kind === "beton");
  const rise = CONCRETE.totalRise / CONCRETE.steps;

  // Cotele la care stă fiecare placă, fără repetări.
  const levels = new Map<number, number[]>();
  for (const face of faces) {
    const rows = levels.get(face.step) ?? [];
    for (const point of face.points) {
      const y = Math.round(point.y * 10) / 10;
      if (!rows.includes(y)) rows.push(y);
    }
    levels.set(face.step, rows);
  }

  /*
   * O placă în pantă are trei cote: fundul din față, fundul din spate și fața
   * de sus. Cele două funduri sunt la exact o înălțime de treaptă unul de
   * altul — de acolo se leagă placa următoare, fără prag.
   *
   * Ridicată drept și tăiată pe urmă, placa ar avea un singur fund, iar
   * saltul până la fața de sus ar fi altă cifră. Testul se uită la primele
   * două cote de jos, fiindcă acolo se vede deosebirea; suma sau adâncimea
   * plăcii ies la fel în ambele cazuri și n-ar prinde nimic.
   *
   * Se începe de la a treia treaptă: sub primele, talpa dă de podea și se
   * oprește acolo, deci fundul din față e tăiat.
   */
  for (let step = 3; step <= CONCRETE.steps; step += 1) {
    const rows = (levels.get(step) ?? []).slice().sort((a, b) => a - b);
    assert.ok(rows.length >= 3, `placa ${step} are o singură cotă de fund`);
    assert.ok(
      Math.abs(rows[1] - rows[0] - rise) < 1,
      `placa ${step} are fundul în prag de ${Math.round(rows[1] - rows[0])} mm, nu în pantă`,
    );
  }
});

test("talpa se așază pe podea sub primele trepte", () => {
  const faces = buildStair(CONCRETE).solid.faces.filter((face) => face.kind === "beton");
  const floor = Math.min(...faces.flatMap((face) => face.points.map((p) => p.y)));
  // Sub podea nu se coboară: acolo talpa se îngroașă și se reazemă.
  assert.equal(floor, 0);
});

test("betonul stă sub blatul de lemn, nu peste el", () => {
  const build = buildStair(CONCRETE);
  const rise = CONCRETE.totalRise / CONCRETE.steps;
  for (const face of build.solid.faces.filter((f) => f.kind === "beton")) {
    const top = Math.max(...face.points.map((p) => p.y));
    // Fața de sus a betonului e chiar fundul blatului treptei lui.
    assert.ok(top <= face.step * rise - CONCRETE.thickness + 0.001);
  }
});

/*
 * Greșeala pe care o prinde testul ăsta: un zid ridicat drept pe toată
 * înălțimea etajului. Iese un panou cât peretele unei camere, scara pare
 * lipită pe el, iar în vederi acoperă tocmai ce era de arătat.
 */
test("zidul urcă odată cu scara, nu drept de la podea la tavan", () => {
  const build = buildStair({ ...defaultSpec(), walls: true });
  const walls = build.solid.faces.filter((face) => face.kind === "perete");
  assert.ok(walls.length > 0);

  /*
   * Se numără cotele de deasupra podelei.
   *
   * Un zid drept are una singură — tavanul —, oricâte lespezi ar avea. Unul
   * care urcă are cel puțin două, fiindcă muchia lui de sus e înclinată. Pe un
   * braț drept lespedea e una singură, așa că ies exact două cote; pe o scară
   * cotită, mai multe.
   *
   * Măsurat altfel, de pildă ca diferență între cel mai de jos și cel mai de
   * sus punct, cifra iese aceeași în ambele cazuri: și zidul drept pleacă de la
   * zero și ajunge la tavan.
   */
  const levels = new Set<number>();
  for (const face of walls) {
    for (const point of face.points) levels.add(Math.round(point.y));
  }
  const above = [...levels].filter((y) => y > 0);
  assert.ok(
    above.length > 1,
    `muchia de sus a zidului e orizontală, la ${above[0]} mm: e un panou drept`,
  );

  // Și nu trece de etaj.
  assert.ok(Math.max(...levels) <= defaultSpec().totalRise);
});

test("elevațiile sunt secțiuni: zidul nu apare în ele", () => {
  const sheet = buildSheet({ ...defaultSpec(), walls: true, concrete: true }, "Scară");
  for (const id of ["fata", "lateral"]) {
    const pane = sheet.panes.find((row) => row.id === id);
    assert.ok(pane);
    assert.ok(
      !pane.polygons.some((polygon) => polygon.kind === "perete"),
      `${id}: zidul umple silueta și acoperă panta`,
    );
    // Dar betonul rămâne: el e chiar ce arată vederea.
    assert.ok(pane.polygons.some((polygon) => polygon.kind === "beton"), `${id}: lipsește betonul`);
  }
  for (const id of ["plan", "izometric"]) {
    const pane = sheet.panes.find((row) => row.id === id);
    assert.ok(pane?.polygons.some((polygon) => polygon.kind === "perete"), `${id}: lipsește zidul`);
  }
});
