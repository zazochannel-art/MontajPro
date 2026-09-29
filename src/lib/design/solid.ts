/**
 * Corpuri în spațiu și umbra lor pe hârtie.
 *
 * Scara se construiește o singură dată, în trei dimensiuni și în milimetri
 * adevărați. Vederile — plan, față, lateral, izometric — nu sunt patru desene
 * făcute separat, ci același corp privit din patru părți. De aceea nu se pot
 * contrazice între ele: dacă schimbi o cifră, se mișcă toate deodată, fiindcă
 * toate ies din același corp.
 *
 * Nu e nicio bibliotecă 3D aici și nu e nici din economie. Un WebGL ar desena
 * pixeli, iar din pixeli nu iese un SVG pe care să-l mărești și un PDF pe care
 * să-l pui sub șubler. Scara e făcută din cutii, iar cutiile se proiectează cu
 * două înmulțiri — atât costă ca desenul să rămână vectorial până la capăt.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

/** La ce parte din scară ține o față. Desenul o folosește la grosimea liniei. */
export type FaceKind = "treapta" | "contratreapta" | "podest" | "perete" | "beton";

/**
 * Încotro privește o față, după ce corpul a fost întors spre ochi.
 *
 * Din asta iese umbrirea în desenul cu lemn: fața de sus prinde lumina, cea
 * din față o prinde pieziș, cea laterală rămâne în umbră. E aceeași regulă
 * după care ochiul recunoaște un obiect ca fiind solid, iar fără ea trei
 * dreptunghiuri de aceeași culoare nu arată ca o treaptă, ci ca o pată.
 */
export type Tone = "sus" | "fata" | "lateral";

/** O față plană, ca poligon închis. Punctele sunt în ordine, în milimetri. */
export interface Face {
  points: Vec3[];
  kind: FaceKind;
  /** A câta treaptă. Pentru numerotare și pentru selecție, mai târziu. */
  step: number;
}

export interface Solid {
  faces: Face[];
}

export const VIEWS = ["plan", "fata", "lateral", "izometric"] as const;
export type ViewName = (typeof VIEWS)[number];

export const VIEW_LABELS: Record<ViewName, string> = {
  plan: "Plan (de sus)",
  fata: "Vedere din față",
  lateral: "Vedere laterală",
  izometric: "Vedere 3D",
};

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

/**
 * Corpul ridicat peste un contur orizontal.
 *
 * Aproape tot ce are scara — blatul treptei, contratreapta, podestul — e un
 * poligon orizontal ridicat între două înălțimi. O treaptă în evantai are
 * conturul unui sector, una dreaptă un dreptunghi, iar funcția asta nu le
 * deosebește: primește conturul care iese din fotografie sau din cifre și-l
 * ridică. Aici se vede de ce nu s-a presupus nicăieri că o treaptă are patru
 * colțuri.
 */
export function prism(
  outline: Vec2[],
  bottom: number,
  top: number,
  kind: FaceKind,
  step: number,
): Face[] {
  if (outline.length < 3) return [];

  const lift = (p: Vec2, y: number): Vec3 => ({ x: p.x, y, z: p.y });
  const faces: Face[] = [];

  faces.push({ points: outline.map((p) => lift(p, top)), kind, step });
  // Fața de jos se scrie în ordine inversă, ca normala ei să iasă în jos.
  faces.push({ points: [...outline].reverse().map((p) => lift(p, bottom)), kind, step });

  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    faces.push({
      points: [lift(a, bottom), lift(b, bottom), lift(b, top), lift(a, top)],
      kind,
      step,
    });
  }

  return faces;
}

/**
 * Corpul ridicat peste un contur, cu fiecare colț la înălțimea lui.
 *
 * `prism` ridică drept, între două cote. Aici fiecare punct al conturului are
 * jos și sus ale lui, ceea ce dă fețe înclinate — și de asta e nevoie de două
 * ori: pentru talpa de beton, care merge în pantă pe sub trepte, și pentru
 * zidul care urcă odată cu scara. Ridicate drept și tăiate pe urmă, amândouă
 * ar avea fundul în trepte, ca o scară sub scară.
 */
export function prismVar(
  outline: Vec2[],
  bottoms: number[],
  tops: number[],
  kind: FaceKind,
  step: number,
): Face[] {
  if (outline.length < 3 || bottoms.length !== outline.length || tops.length !== outline.length) {
    return [];
  }

  const lift = (p: Vec2, y: number): Vec3 => ({ x: p.x, y, z: p.y });
  const faces: Face[] = [];

  faces.push({ points: outline.map((p, i) => lift(p, tops[i])), kind, step });
  // Fața de jos se scrie în ordine inversă, ca normala ei să iasă în jos.
  faces.push({
    points: outline.map((p, i) => lift(p, bottoms[i])).reverse(),
    kind,
    step,
  });

  for (let i = 0; i < outline.length; i += 1) {
    const j = (i + 1) % outline.length;
    faces.push({
      points: [
        lift(outline[i], bottoms[i]),
        lift(outline[j], bottoms[j]),
        lift(outline[j], tops[j]),
        lift(outline[i], tops[i]),
      ],
      kind,
      step,
    });
  }

  return faces;
}

export interface Projected {
  points: Vec2[];
  kind: FaceKind;
  step: number;
  tone: Tone;
  /** Cât de aproape e fața de ochi. Mai mare = mai în față. */
  depth: number;
}

/**
 * Tonul unei fețe, din normala ei — după rotire, nu înainte.
 *
 * Contează că se ia normala rotită: aceeași contratreaptă, privită din alt
 * unghi, chiar primește altă lumină. Dacă s-ar lua normala din model, scara
 * rotită ar păstra umbrele vechi și ar arăta ca un desen lipit pe un obiect.
 */
export function toneOf(normal: Vec3): Tone {
  if (normal.y > 0.5) return "sus";
  if (normal.z < -0.35) return "fata";
  return "lateral";
}

/**
 * Un punct din spațiu, pe ecran.
 *
 * `y` crește în jos, ca peste tot în canvas și în SVG, așa că înălțimea reală
 * se scade. Izometricul e cel clasic, la 30°: adâncimea pleacă spre stânga,
 * lățimea spre dreapta, iar înălțimea rămâne verticală — de aceea o scară
 * desenată așa se citește fără să fie nevoie de explicații.
 */
/**
 * Corpul răsucit în jurul verticalei.
 *
 * Rotirea se face pe puncte, o singură dată, nu și pe direcția privirii. Dacă
 * s-ar roti amândouă, cele două socoteli ar trebui să rămână inverse una
 * alteia la fiecare schimbare — iar când se despart, fețele din spate ajung
 * desenate peste cele din față și nimeni nu vede de ce.
 */
export function rotateY(p: Vec3, angle: number): Vec3 {
  if (!angle) return p;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: p.x * cos - p.z * sin, y: p.y, z: p.x * sin + p.z * cos };
}

export function project(p: Vec3, view: ViewName): { x: number; y: number; depth: number } {
  switch (view) {
    case "plan":
      // Privită de sus: ce e mai sus e mai aproape de ochi.
      return { x: p.x, y: p.z, depth: p.y };
    case "fata":
      return { x: p.x, y: -p.y, depth: -p.z };
    case "lateral":
      return { x: p.z, y: -p.y, depth: -p.x };
    case "izometric":
    default:
      /*
       * Ochiul stă în fața scării, nu în spatele ei.
       *
       * Izometricul „de manual”, cu adâncimea care pleacă spre stânga, turtește
       * tocmai scara: mersul înainte coboară pe ecran cu o jumătate de
       * adâncime, iar urcarea îl ridică cu o înălțime de treaptă — două cifre
       * aproape egale, care se anulează, și rezultatul e o rampă întinsă pe
       * jos. Cu adâncimea întoarsă, cele două se adună: scara urcă spre dreapta
       * sus, cum se vede și cu ochiul liber când stai în fața ei.
       */
      return {
        x: (p.x + p.z) * COS30,
        y: (p.x - p.z) * SIN30 - p.y,
        depth: p.x + p.y - p.z,
      };
  }
}

/** Încotro se uită ochiul, pentru fiecare vedere. Normalizat. */
function eye(view: ViewName): Vec3 {
  switch (view) {
    case "plan":
      return { x: 0, y: 1, z: 0 };
    case "fata":
      return { x: 0, y: 0, z: -1 };
    case "lateral":
      return { x: -1, y: 0, z: 0 };
    case "izometric":
    default: {
      const k = 1 / Math.sqrt(3);
      return { x: k, y: k, z: -k };
    }
  }
}

/**
 * Normala unei fețe, prin produsul vectorial al primelor două laturi.
 *
 * Întoarce `null` pe o față degenerată — trei puncte în linie n-au normală, iar
 * o împărțire la zero ar scoate `NaN` tocmai în locul din care se hotărăște ce
 * se vede.
 */
export function normalOf(points: Vec3[]): Vec3 | null {
  if (points.length < 3) return null;
  const [a, b, c] = points;
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const n = {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  };
  const length = Math.hypot(n.x, n.y, n.z);
  if (length < 1e-9) return null;
  return { x: n.x / length, y: n.y / length, z: n.z / length };
}

/**
 * Corpul, gata de desenat dintr-o parte.
 *
 * Două treceri, în ordinea asta: se aruncă fețele întoarse cu spatele, apoi ce
 * rămâne se așază de la depărtare spre apropiere. Prima trecere scoate exact
 * jumătate din fețe — pe cele pe care oricum nu le-ai vedea — iar a doua face
 * ca treapta din față s-o acopere pe cea din spate, cum se întâmplă și în
 * realitate.
 */
export function faceSet(solid: Solid, view: ViewName, azimuth = 0): Projected[] {
  const direction = eye(view);
  // Numai izometricul se rotește; vederile ortogonale sunt vederi anume.
  const spin = view === "izometric" ? azimuth : 0;
  const out: Projected[] = [];

  for (const face of solid.faces) {
    const points = spin ? face.points.map((p) => rotateY(p, spin)) : face.points;
    const normal = normalOf(points);
    if (!normal) continue;
    const facing = normal.x * direction.x + normal.y * direction.y + normal.z * direction.z;
    // Fețele privite exact din muchie n-au ce arăta; pragul le scoate și pe ele.
    if (facing <= 1e-6) continue;

    const flat = points.map((p) => project(p, view));
    let depth = 0;
    for (const p of flat) depth += p.depth;
    out.push({
      points: flat.map((p) => ({ x: p.x, y: p.y })),
      kind: face.kind,
      step: face.step,
      tone: toneOf(normal),
      depth: depth / flat.length,
    });
  }

  /*
   * Zidăria stă în spate, întotdeauna, oricât de aproape ar fi de ochi.
   *
   * E convenția desenului în secțiune: casa scării se taie ca să se vadă ce e
   * înăuntru. Fără ea, din orice unghi în care zidul cade între ochi și trepte
   * n-ar mai rămâne de văzut decât un dreptunghi gri — și chiar așa ieșea
   * vederea laterală.
   *
   * O regulă mai blândă, care taie numai zidul mai apropiat decât cea mai
   * apropiată treaptă, nu e de ajuns: un zid poate fi mai departe decât treapta
   * din față și totuși să le acopere pe cele din mijloc. Aici nu se caută
   * exactitate fizică, ci un desen din care se înțelege scara.
   */
  const rank = (face: Projected) => (face.kind === "perete" ? 0 : 1);
  out.sort((a, b) => rank(a) - rank(b) || a.depth - b.depth);
  return out;
}

export interface Box2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Cât loc ocupă niște poligoane. `null` dacă nu e niciunul. */
export function extent(polygons: { points: Vec2[] }[]): Box2 | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const polygon of polygons) {
    for (const p of polygon.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/** Cât loc ocupă corpul în spațiu. Din el ies cotele de gabarit. */
export function boundsOf(solid: Solid): {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
} | null {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const face of solid.faces) {
    for (const p of face.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, minZ, maxX, maxY, maxZ };
}
