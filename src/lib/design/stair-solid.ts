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
import { prism, prismVar, project, rotateY } from "./solid";
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
/**
 * Pereții casei scării, ca unghiuri de normală.
 *
 * Scara nu se învârte în aer: se întoarce într-un colț de zidărie. Peretele
 * dinaintea cotului și cel de după se întâlnesc la 90°, iar treptele în evantai
 * se taie ca să umple colțul ăla — nu se opresc la o rază constantă. Diferența
 * se vede cu ochiul liber în plan: cu rază constantă, colțul iese rotunjit și
 * rămâne un triunghi de podea nefolosit; tăiate pe colț, treptele ajung până
 * în zid, cum se și montează.
 *
 * La fiecare sfert de tură intră un perete nou, așa că o întoarcere la 180° dă
 * trei pereți — adică exact o casă de scară în formă de U.
 */
function wallAngles(from: number, to: number, spin: number): number[] {
  const quarter = (Math.PI / 2) * spin;
  const out: number[] = [];
  const passed = (a: number) => (spin > 0 ? a > to + 1e-9 : a < to - 1e-9);

  for (let k = 0; k < 8; k += 1) {
    const a = from + quarter * k;
    if (passed(a)) break;
    out.push(a);
  }
  if (Math.abs(out[out.length - 1] - to) > 1e-9) out.push(to);
  return out;
}

/**
 * Cât de departe de stâlp ajunge o rază până dă de zid.
 *
 * Fiecare perete e o dreaptă la distanța `radius` de stâlp; raza se oprește la
 * primul pe care-l atinge. Din regula asta iese colțul pătrat, fără niciun caz
 * special: lângă capete raza cade pe zidul din dreptul ei, iar la mijloc taie
 * chiar colțul, la `radius × √2`.
 */
function reachOf(angle: number, walls: number[], radius: number): number {
  const ray = across(angle);
  let best = Infinity;
  for (const wall of walls) {
    const normal = across(wall);
    const facing = ray.x * normal.x + ray.y * normal.y;
    if (facing <= 1e-6) continue;
    best = Math.min(best, radius / facing);
  }
  return Number.isFinite(best) ? best : radius;
}

/** Unghiurile colțurilor: la mijloc, între doi pereți vecini. */
function cornerAngles(walls: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < walls.length; i += 1) out.push((walls[i - 1] + walls[i]) / 2);
  return out;
}

function between(from: number, to: number, value: number): boolean {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  return value > low + 1e-9 && value < high - 1e-9;
}

/** Grosimea zidului. */
const WALL_THICKNESS = 100;

/**
 * Cât urcă zidul peste treapta din dreptul lui.
 *
 * Zidul nu se desenează pe toată înălțimea etajului: ridicat drept, iese un
 * panou cât peretele unei camere, iar scara pare lipită pe el în loc să stea
 * lângă el. Tăiat în pantă, la o statură de om peste treaptă, se citește ca un
 * zid de casă a scării — ca în desenele de prezentare, unde zidăria e secționată
 * anume ca să se vadă scara dinăuntru.
 */
const WALL_ABOVE = 500;

/**
 * Scara întreagă: blaturi, contratrepte, conturul fiecărei trepte în plan și,
 * dacă se cer, pereții pe partea din afara cotului.
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

  /*
   * Pereții sunt ai casei scării, nu ai fiecărei trepte.
   *
   * Socotiți o dată, din unghiul cu care intră scara în cot și din cel cu care
   * iese. Luați pe treaptă — adică între unghiul de început și cel de sfârșit
   * al treptei alea — fiecare treaptă și-ar tăia propriul colț de 30°, iar din
   * ele toate ar ieși tot un arc: exact rotunjirea de care scăpăm.
   */
  const turnEnd = (spin * (spec.turnAngle * Math.PI)) / 180;
  const walls = delta !== 0 ? wallAngles(0, turnEnd, spin) : [0];
  const corners = cornerAngles(walls);

  /*
   * Talpa de beton: o placă în pantă, pe sub colțurile treptelor.
   *
   * `k` e cât coboară talpa sub colțul treptei, măsurat pe verticală. Grosimea
   * se dă perpendicular pe pantă — așa se toarnă și așa se armează —, iar pe
   * verticală iese mai mare cu cât panta e mai abruptă: de aia se înmulțește
   * cu lungimea ipotenuzei unui pas.
   */
  const k = spec.slab * Math.hypot(1, rise / spec.tread);
  // Sub podea nu se coboară: acolo talpa se îngroașă și se așază pe placă.
  const soffit = (index: number) => Math.max(0, index * rise - k);

  const faces: Face[] = [];
  const treads: TreadOutline[] = [];
  /*
   * Muchia dinspre zid, treaptă cu treaptă, fiecare punct cu stâlpul lui.
   *
   * Stâlpul se ține minte fiindcă din el se află încotro e „în afară”. Luat
   * față de mijlocul muchiei, sensul iese la întâmplare pe un braț drept:
   * mijlocul unei linii drepte cade chiar pe ea, deci nu spune de care parte e
   * scara — și zidul fie dispare, fie se așază peste trepte.
   */
  const outerPath: { p: Vec2; ref: Vec2; top: number }[] = [];

  let pivot: Vec2 = { x: 0, y: 0 };
  let angle = 0;

  for (let i = 0; i < spec.steps; i += 1) {
    const step = i + 1;
    const top = (i + 1) * rise;
    const treadBottom = top - spec.thickness;
    const winder = step > spec.turnAfter && step <= spec.turnAfter + spec.winders && delta !== 0;

    let outline: Vec2[];
    let riser: Vec2[];
    // Conturul betonului e al treptei, fără nas: betonul nu iese în consolă.
    let core: Vec2[];
    let coreFront: number;

    if (winder) {
      const front = angle - spin * noseAngle;
      const back = angle + delta;

      /*
       * Muchia dinspre zid nu e un arc, ci linia frântă a zidăriei. Unde un
       * colț cade în mijlocul treptei, intră ca punct în plus — altfel treapta
       * ar tăia colțul pe diagonală și ar rămâne podea nefolosită în spatele ei.
       */
      const edge = [front, ...corners.filter((c) => between(front, back, c)), back];
      const outerPoints = edge.map((a) => radial(pivot, a, side, reachOf(a, walls, outer)));

      outline = [radial(pivot, front, side, inner), ...outerPoints, radial(pivot, back, side, inner)];

      const coreEdge = [angle, ...corners.filter((c) => between(angle, back, c)), back];
      core = [
        radial(pivot, angle, side, inner),
        ...coreEdge.map((a) => radial(pivot, a, side, reachOf(a, walls, outer))),
        radial(pivot, back, side, inner),
      ];
      // Tot două: colțul de la stâlp și cel de la zid, ambele pe muchia din față.
      coreFront = 2;

      const behind = angle + spin * riserAngle;
      riser = [
        radial(pivot, angle, side, inner),
        radial(pivot, angle, side, reachOf(angle, walls, outer)),
        radial(pivot, behind, side, reachOf(behind, walls, outer)),
        radial(pivot, behind, side, inner),
      ];
      outerPath.push(...outerPoints.map((p) => ({ p, ref: pivot, top })));
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
      core = [a, b, at(b, f, spec.tread), at(a, f, spec.tread)];
      coreFront = 2;
      outerPath.push({ p: at(b, f, -spec.nosing), ref: pivot, top }, { p: at(b, f, spec.tread), ref: pivot, top });
    }

    faces.push(...prism(outline, treadBottom, top, "treapta", step));
    if (spec.closedRisers) {
      // Contratreapta urcă de la treapta de dedesubt până sub blatul de deasupra.
      const bottom = i * rise;
      if (treadBottom > bottom) {
        faces.push(...prism(riser, bottom, treadBottom, "contratreapta", step));
      }
    }

    if (spec.concrete) {
      /*
       * Fundul plăcii coboară de la o treaptă la alta, nu în trepte: punctele
       * din față stau pe panta de sub colțul dinainte, cele din spate pe cea de
       * sub colțul următor. Așa se leagă o placă de alta într-o pantă continuă,
       * cum se vede pe orice scară de beton privită din lateral.
       */
      const bottoms = core.map((_, index) => soffit(index < coreFront ? i : i + 1));
      const tops = core.map(() => treadBottom);
      faces.push(...prismVar(core, bottoms, tops, "beton", step));
    }

    treads.push({ step, outline, top, winder });

    if (winder) {
      angle += delta;
    } else {
      pivot = at(pivot, forward(angle), spec.tread);
    }
  }

  if (spec.walls) faces.push(...wallFaces(simplify(outerPath), spec.totalRise));

  return { solid: { faces }, treads };
}

/**
 * Muchia, fără punctele care nu cotesc nimic.
 *
 * Muchia dinspre zid se adună treaptă cu treaptă, deci un braț drept de
 * șaisprezece trepte vine cu treizeci și două de puncte în linie. Lăsate așa,
 * ar ieși treizeci și două de lespezi lipite una de alta, fiecare cu conturul
 * ei — un zid cu dungi, desenat de patru ori mai lent. Rămân numai punctele
 * unde zidul chiar cotește.
 */
function simplify<T extends { p: Vec2 }>(path: T[]): T[] {
  if (path.length < 3) return path;
  const out: T[] = [path[0]];

  for (let i = 1; i < path.length - 1; i += 1) {
    const from = out[out.length - 1].p;
    const here = path[i].p;
    const next = path[i + 1].p;
    const ax = here.x - from.x;
    const ay = here.y - from.y;
    const bx = next.x - here.x;
    const by = next.y - here.y;
    // Produsul încrucișat, raportat la lungimi: cât de tare cotește aici.
    const cross = Math.abs(ax * by - ay * bx);
    const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (scale > 1e-9 && cross / scale > 1e-3) out.push(path[i]);
  }

  out.push(path[path.length - 1]);
  return out;
}

/**
 * Zidăria de pe latura dinspre exterior, ca o bandă de-a lungul muchiei.
 *
 * Fiecare segment de muchie primește o lespede împinsă în afară, iar „în afară”
 * se hotărăște față de stâlpul segmentului — singurul punct despre care se știe
 * sigur că e înăuntru. Pe un cot latura își schimbă direcția, deci o normală
 * aleasă o dată pentru totdeauna ar întoarce zidul peste trepte tocmai la colț.
 */
function wallFaces(path: { p: Vec2; ref: Vec2; top: number }[], ceiling: number): Face[] {
  if (path.length < 2) return [];

  const faces: Face[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const from = path[i - 1].p;
    const to = path[i].p;
    const inside = path[i - 1].ref;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;

    let normal = { x: -dy / length, y: dx / length };
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const away = { x: midpoint.x - inside.x, y: midpoint.y - inside.y };
    if (normal.x * away.x + normal.y * away.y < 0) normal = { x: -normal.x, y: -normal.y };

    // Zidul urcă odată cu treapta din dreptul lui, dar nu trece de etaj.
    const hereTop = Math.min(ceiling, path[i - 1].top + WALL_ABOVE);
    const nextTop = Math.min(ceiling, path[i].top + WALL_ABOVE);
    const outline = [
      from,
      to,
      { x: to.x + normal.x * WALL_THICKNESS, y: to.y + normal.y * WALL_THICKNESS },
      { x: from.x + normal.x * WALL_THICKNESS, y: from.y + normal.y * WALL_THICKNESS },
    ];
    faces.push(
      ...prismVar(outline, [0, 0, 0, 0], [hereTop, nextTop, nextTop, hereTop], "perete", 0),
    );
  }

  return faces;
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
    // Gabaritul e al scării. Zidul și betonul o poartă, nu fac parte din ea.
    if (face.kind === "perete" || face.kind === "beton") continue;
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
