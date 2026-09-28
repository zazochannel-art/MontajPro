/**
 * Din opt cifre, scara.
 *
 * Se merge treaptă cu treaptă, ținând minte două lucruri: unde e colțul dinspre
 * stâlp și încotro se urcă. O treaptă dreaptă mută colțul înainte și lasă
 * direcția cum era; una în evantai lasă colțul pe loc și rotește direcția. Atât
 * e tot cotul — de aceea aceeași buclă scoate și o scară dreaptă, și una
 * întoarsă la 180°, fără niciun caz special.
 *
 * Treptele în evantai ies cu laturi drepte, nu curbate, fiindcă chiar așa se
 * taie: un blat de lemn tăiat în sector are muchii drepte, iar un desen cu arc
 * de cerc ar trimite la debitat o piesă care nu există.
 *
 * Fără balustradă și fără mână curentă: desenul e pentru trepte.
 */
import type { StairSpec } from "./stair-spec";
import { normalizeSpec } from "./stair-spec";
import { prism, project, rotateY } from "./solid";
import type { Face, Solid, Vec2, Vec3 } from "./solid";

/** Conturul unei trepte în plan, cu înălțimea la care stă. */
export interface TreadOutline {
  /** Numărul treptei, de jos în sus. Prima e 1. */
  step: number;
  outline: Vec2[];
  /** Cota feței pe care calci. */
  top: number;
  /** Treaptă în evantai sau dreaptă. */
  winder: boolean;
}

export interface StairBuild {
  solid: Solid;
  treads: TreadOutline[];
}

/** Înainte, în planul orizontal. Unghiul zero urcă spre +z. */
function forward(angle: number): Vec2 {
  return { x: Math.sin(angle), y: Math.cos(angle) };
}

/** Spre dreapta celui care urcă. */
function across(angle: number): Vec2 {
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

function at(origin: Vec2, dir: Vec2, distance: number): Vec2 {
  return { x: origin.x + dir.x * distance, y: origin.y + dir.y * distance };
}

/** Punctul aflat la o rază și un unghi față de stâlp. */
function radial(pivot: Vec2, angle: number, side: number, radius: number): Vec2 {
  const dir = across(angle);
  return { x: pivot.x + dir.x * side * radius, y: pivot.y + dir.y * side * radius };
}

/**
 * Scara întreagă: blaturi, contratrepte și conturul fiecărei trepte în plan.
 *
 * Contratreapta se ridică de la treapta de dedesubt până sub blatul de
 * deasupra, iar nasul iese peste ea — de aceea se scade `nosing` la muchia din
 * față și nu se adună la adâncime: adâncimea pe care calci rămâne cea din
 * formular, nasul e pe deasupra.
 */
export function buildStair(input: StairSpec): StairBuild {
  const spec = normalizeSpec(input);
  const rise = spec.totalRise / spec.steps;
  const inner = spec.newel;
  const outer = spec.newel + spec.width;
  const mid = spec.newel + spec.width / 2;

  // Stâlpul stă în interiorul cotului, iar treptele pleacă din el în afară.
  const side = spec.turn === "dreapta" ? -1 : 1;
  const spin = spec.turn === "dreapta" ? 1 : -1;
  const delta = spec.winders > 0 ? (spin * (spec.turnAngle * Math.PI)) / 180 / spec.winders : 0;
  // Nasul și grosimea contratreptei, în unghi: lungimea de arc la jumătatea lățimii.
  const noseAngle = spec.nosing / mid;
  const riserAngle = spec.riserThickness / mid;

  const faces: Face[] = [];
  const treads: TreadOutline[] = [];

  let pivot: Vec2 = { x: 0, y: 0 };
  let angle = 0;

  for (let i = 0; i < spec.steps; i += 1) {
    const step = i + 1;
    const top = (i + 1) * rise;
    const treadBottom = top - spec.thickness;
    const winder = step > spec.turnAfter && step <= spec.turnAfter + spec.winders && delta !== 0;

    let outline: Vec2[];
    let riser: Vec2[];

    if (winder) {
      const front = angle - spin * noseAngle;
      const back = angle + delta;
      outline = [
        radial(pivot, front, side, inner),
        radial(pivot, front, side, outer),
        radial(pivot, back, side, outer),
        radial(pivot, back, side, inner),
      ];
      const behind = angle + spin * riserAngle;
      riser = [
        radial(pivot, angle, side, inner),
        radial(pivot, angle, side, outer),
        radial(pivot, behind, side, outer),
        radial(pivot, behind, side, inner),
      ];
    } else {
      const f = forward(angle);
      const a = radial(pivot, angle, side, inner);
      const b = radial(pivot, angle, side, outer);
      outline = [
        at(a, f, -spec.nosing),
        at(b, f, -spec.nosing),
        at(b, f, spec.tread),
        at(a, f, spec.tread),
      ];
      riser = [a, b, at(b, f, spec.riserThickness), at(a, f, spec.riserThickness)];
    }

    faces.push(...prism(outline, treadBottom, top, "treapta", step));
    if (spec.closedRisers) {
      // Contratreapta urcă de la treapta de dedesubt până sub blatul de deasupra.
      const bottom = i * rise;
      if (treadBottom > bottom) {
        faces.push(...prism(riser, bottom, treadBottom, "contratreapta", step));
      }
    }

    treads.push({ step, outline, top, winder });

    if (winder) {
      angle += delta;
    } else {
      pivot = at(pivot, forward(angle), spec.tread);
    }
  }

  return { solid: { faces }, treads };
}

/** Mijlocul unui contur. Acolo se scrie numărul treptei, în plan. */
export function outlineCenter(outline: Vec2[]): Vec2 {
  if (!outline.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of outline) {
    x += p.x;
    y += p.y;
  }
  return { x: x / outline.length, y: y / outline.length };
}

export interface Footprint {
  /** Cât ocupă scara pe lățime. */
  width: number;
  /** Cât ocupă scara în adâncime — gaura de scară. */
  run: number;
  /** Înălțimea totală, de la podea la podea. */
  height: number;
}

/**
 * Gabaritul scării, luat din corpul construit — nu dintr-o formulă.
 *
 * Pe o scară dreaptă ar fi mers și înmulțirea, dar pe una cotită numărul de
 * trepte ori adâncimea nu spune nimic despre locul ocupat. Măsurat pe corp,
 * răspunsul e bun pentru orice formă, inclusiv pentru una pe care n-am
 * prevăzut-o.
 */
export function footprint(build: StairBuild): Footprint {
  let minX = Infinity;
  let minZ = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  let maxY = -Infinity;

  for (const face of build.solid.faces) {
    for (const p of face.points) {
      if (p.x < minX) minX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.z > maxZ) maxZ = p.z;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (!Number.isFinite(minX)) return { width: 0, run: 0, height: 0 };
  return {
    width: Math.round(maxX - minX),
    run: Math.round(maxZ - minZ),
    height: Math.round(maxY - minY),
  };
}

/**
 * Din ce parte se vede scara cel mai bine.
 *
 * Într-o vedere izometrică, una dintre direcțiile orizontale ridică desenul pe
 * ecran cu jumătate din pas, iar urcarea îl coboară cu o înălțime de treaptă.
 * La proporțiile obișnuite cele două cifre sunt aproape egale — și atunci
 * brațul care merge în direcția aceea iese întins pe jos, ca o rampă. Pe o
 * scară cotită se întâmplă mereu: orice unghi ai alege, un braț cade prost.
 *
 * Așa că unghiul nu se alege din obișnuință, ci din geometrie: se încearcă
 * toate, și rămâne acela la care și treapta cea mai prost așezată tot se vede
 * bine. „Bine” înseamnă două lucruri deodată, iar al doilea e ușor de uitat:
 * treapta trebuie să urce pe ecran, dar trebuie și să se ducă în lateral. Dacă
 * ceri numai urcarea, ies unghiuri din care privești fix în lungul rampei —
 * scara urcă perfect și n-are nicio adâncime, adică arată ca o scară de mână
 * rezemată de perete. Se ia deci minimul dintre cele două, iar unghiul bun e
 * cel la care nici cel mai mic dintre ele nu e mic.
 */
export function bestAzimuth(build: StairBuild): number {
  if (build.treads.length < 2) return 0;

  const centers: Vec3[] = build.treads.map((tread) => {
    const center = outlineCenter(tread.outline);
    return { x: center.x, y: tread.top, z: center.y };
  });

  const tried: { azimuth: number; score: number; advance: number }[] = [];

  for (let degrees = 0; degrees < 360; degrees += 5) {
    const azimuth = (degrees * Math.PI) / 180;
    let worst = Infinity;
    for (let i = 1; i < centers.length; i += 1) {
      const from = project(rotateY(centers[i - 1], azimuth), "izometric");
      const to = project(rotateY(centers[i], azimuth), "izometric");
      // Ecranul are y în jos, deci urcarea e scăderea lui.
      const climb = from.y - to.y;
      const spread = Math.abs(to.x - from.x);
      const score = Math.min(climb, spread);
      if (score < worst) worst = score;
    }
    const first = project(rotateY(centers[0], azimuth), "izometric");
    const last = project(rotateY(centers[centers.length - 1], azimuth), "izometric");
    tried.push({ azimuth, score: worst, advance: last.x - first.x });
  }

  /*
   * Între unghiurile la fel de bune, cel în care scara urcă spre dreapta.
   *
   * Nu e capriciu: un desen se citește de la stânga la dreapta, iar o rampă
   * care urcă în sens invers o citește toată lumea de două ori. Pe o scară
   * întoarsă la 180° un braț merge oricum invers — atunci contează unde ajunge
   * scara față de unde a plecat, nu fiecare treaptă în parte.
   */
  const bestScore = Math.max(...tried.map((row) => row.score));
  const goodEnough = tried.filter((row) => row.score >= bestScore * 0.98);
  let best = goodEnough[0];
  for (const row of goodEnough) {
    if (row.advance > best.advance) best = row;
  }

  return best.azimuth;
}
