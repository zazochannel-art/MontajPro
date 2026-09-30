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

/**
 * O scară care ocupă o parte din cadru, cu linii verticale lungi în jur.
 *
 * Așa arată realitatea: muchiile treptelor sunt scurte, fiindcă scara nu umple
 * poza, iar în jur sunt balustri, tocuri de ușă, colțuri de perete — sau, într-un
 * desen tehnic, linii de cotă — care străbat cadrul de sus până jos. Lungimea
 * contează: detecția cântărește direcțiile cu pătratul voturilor, așa că puține
 * linii lungi bat multe muchii scurte.
 */
function stairsAmongUprights(options: {
  count: number;
  uprights: number;
}): { rgba: Uint8ClampedArray; width: number; height: number } {
  const rgba = blank(40);
  const put = (x: number, y: number) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const p = (y * WIDTH + x) * 4;
    rgba[p] = 230;
    rgba[p + 1] = 230;
    rgba[p + 2] = 230;
  };

  // Muchiile treptelor: scurte, la mijlocul cadrului.
  for (let step = 0; step < options.count; step += 1) {
    const y = 40 + step * 22;
    for (let x = 90; x < 230; x += 1) {
      put(x, y);
      put(x, y + 1);
    }
  }

  // Verticalele: de sus până jos.
  const gap = Math.floor(WIDTH / (options.uprights + 1));
  for (let bar = 1; bar <= options.uprights; bar += 1) {
    for (let y = 0; y < HEIGHT; y += 1) {
      put(bar * gap, y);
      put(bar * gap + 1, y);
    }
  }

  return { rgba, width: WIDTH, height: HEIGHT };
}

/**
 * O treaptă e lată și scundă, niciodată o fâșie verticală.
 *
 * Verificarea asta prinde greșeala care se vede cu ochiul liber pe ecran: cînd
 * detecția se agață de direcția greșită, „treptele” ies dungi de sus până jos.
 */
function latăȘiScundă(
  doc: { points: Record<string, { x: number; y: number }>; steps: { points: string[] }[] },
): boolean {
  return doc.steps.every((step) => {
    const xs = step.points.map((id) => doc.points[id].x);
    const ys = step.points.map((id) => doc.points[id].y);
    return Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
  });
}

test("balustrada nu fură direcția treptelor", () => {
  /*
   * O scară adevărată are mereu în poză și linii verticale — balustri, tocul
   * ușii, colțul peretelui — iar într-un desen tehnic sunt cu duiumul: liniile
   * de cotă. Dacă detecția ia pur și simplu direcția cu cele mai multe voturi,
   * se agață de ele și scoate fâșii verticale numerotate ca trepte.
   */
  const image = stairsAmongUprights({ count: 8, uprights: 9 });
  const result = detectStairs(image.rgba, image.width, image.height);

  assert.ok(result.doc.steps.length >= 5, `a găsit ${result.doc.steps.length} trepte`);
  assert.ok(latăȘiScundă(result.doc), "treptele au ieșit fâșii verticale");
});

test("desenul iese în coordonatele fotografiei, nu ale copiei micșorate", () => {
  /*
   * Detecția lucrează pe o copie micșorată, ca să meargă pe un telefon. Dar ce
   * întoarce se desenează peste fotografia întreagă, așa că trebuie să vină în
   * coordonatele ei. Altfel treptele se înghesuie într-un colț și nu mai stau
   * peste scara din poză — greșeală pe care o poză mică n-o arată, fiindcă sub
   * pragul de micșorare cele două sisteme coincid.
   */
  const larg = 1280;
  const inalt = 960;
  const image = stairs({ count: 8, width: larg, height: inalt, gap: 96, margin: 80 });
  const result = detectStairs(image.rgba, image.width, image.height);

  assert.ok(result.doc.steps.length >= 5, `a găsit ${result.doc.steps.length} trepte`);
  const xs = Object.values(result.doc.points).map((p) => p.x);
  assert.ok(
    Math.max(...xs) > larg * 0.8,
    `cel mai depărtat punct e la x=${Math.round(Math.max(...xs))}, poza are ${larg}`,
  );
  assert.equal(result.width, larg);
  assert.equal(result.height, inalt);
});

test("o poză strâmbă nu scade încrederea ca și cum scara ar fi neregulată", () => {
  /*
   * Aceeași scară, la fel de regulată, fotografiată drept și strâmb. Încrederea
   * spune cât de sigură e citirea scării, nu cât de drept a ținut omul
   * telefonul, deci n-are voie să se prăbușească doar fiindcă poza e înclinată.
   *
   * Greșeala era în ce se măsura: distanța dintre două drepte paralele se ia pe
   * perpendiculara lor, nu pe verticală. Pe verticală, muchiile înclinate par
   * să se înghesuie, iar regularitatea iese mică fără ca scara să se fi
   * schimbat — la 30° de înclinare, 0,55 în loc de 0,93.
   */
  const drept = stairs({ count: 8, gap: 30 });
  const stramba = stairs({ count: 8, gap: 30, tilt: Math.tan((30 * Math.PI) / 180) });

  const a = detectStairs(drept.rgba, drept.width, drept.height).detection.confidence;
  const b = detectStairs(stramba.rgba, stramba.width, stramba.height).detection.confidence;

  assert.ok(a > 0.5, `poza dreaptă dă ${a}`);
  assert.ok(b >= a * 0.85, `dreaptă ${a}, strâmbă ${b}`);
});

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
