/**
 * Desenul scării, ca geometrie — nu ca imagine.
 *
 * Tot ce se vede pe ecran iese de aici: puncte cu coordonate, trepte care leagă
 * puncte, cote care leagă și ele tot puncte. Nicăieri un pixel. Asta e singurul
 * motiv pentru care desenul poate fi corectat cu mâna după ce l-a ghicit
 * mașina, și pentru care mai târziu se poate socoti din el suprafața, materialul
 * și planul de debitare: dintr-o poză frumoasă nu se poate tăia nimic.
 *
 * Coordonatele stau într-o unitate proprie, fără nume. Fotografia le dă în
 * pixeli; calibrarea (`measure.ts`) spune câți milimetri face o unitate. Până
 * atunci desenul e corect ca formă și necunoscut ca mărime — și așa se și
 * spune pe ecran, nu se inventează milimetri.
 *
 * Toate funcțiile de aici sunt pure: primesc un desen, întorc altul. Nimic nu
 * se schimbă pe loc, ca „anulează” să fie o listă de desene, nu o socoteală
 * inversă care nu iese niciodată.
 */
import { uid } from "../utils";

export interface DesignPoint {
  id: string;
  x: number;
  y: number;
}

/**
 * O treaptă: conturul ei, în ordine, ca poligon închis.
 *
 * Nu se presupune patru colțuri. O treaptă dreaptă are patru, una în evantai
 * poate avea cinci sau șase, iar una tăiată pe loc, oricâte. Forma vine din
 * fotografie; modelul n-are voie s-o rotunjească la ce se așteaptă el.
 */
export interface DesignStep {
  id: string;
  /** Id-uri de puncte, în ordinea conturului. */
  points: string[];
  /** Numărul treptei, de jos în sus. Prima treaptă e 1. */
  index: number;
}

/** O cotă scrisă pe desen, legată de două puncte — nu de două numere. */
export interface DesignDimension {
  id: string;
  from: string;
  to: string;
  /** Cât de departe de linie stă cota, în unități de desen. */
  offset: number;
  /** Text pus de om peste valoarea calculată; gol = se afișează măsura. */
  label: string | null;
}

/** Ce a ieșit din citirea fotografiei. Păstrat ca să se vadă cât e de crezut. */
export interface DesignDetection {
  /** Câte trepte s-au găsit. */
  steps: number;
  /** Ce fel de scară pare. */
  kind: StairKind;
  /** Unghiul de urcare, în grade față de orizontală. */
  angle: number;
  /** Între 0 și 1. Cum s-a socotit: vezi `detect.ts`. */
  confidence: number;
  /** Ce a împiedicat o citire bună, dacă a împiedicat ceva. */
  warning: string | null;
}

export const STAIR_KINDS = ["dreapta", "evantai", "cotita", "neregulata"] as const;
export type StairKind = (typeof STAIR_KINDS)[number];

export const STAIR_KIND_LABELS: Record<StairKind, string> = {
  dreapta: "Scară dreaptă",
  evantai: "Trepte în evantai",
  cotita: "Scară cotită",
  neregulata: "Formă neregulată",
};

export interface DesignDoc {
  points: Record<string, DesignPoint>;
  steps: DesignStep[];
  dimensions: DesignDimension[];
  /**
   * Câți milimetri face o unitate de desen. `null` până la calibrare.
   *
   * Cât e `null`, nicio cotă nu se scrie în milimetri: o cifră cu „mm” lângă
   * ea, scoasă din pixelii unei poze, ar fi o minciună pe care cineva o taie
   * în lemn.
   */
  scale: number | null;
  detection: DesignDetection | null;
}

export function emptyDesign(): DesignDoc {
  return { points: {}, steps: [], dimensions: [], scale: null, detection: null };
}

export function isEmpty(doc: DesignDoc): boolean {
  return doc.steps.length === 0 && Object.keys(doc.points).length === 0;
}

/* ------------------------------------------------------------------ */
/* Citiri                                                              */
/* ------------------------------------------------------------------ */

/** Punctele unei trepte, în ordinea conturului. Sare peste ce lipsește. */
export function stepPoints(doc: DesignDoc, step: DesignStep): DesignPoint[] {
  const out: DesignPoint[] = [];
  for (const id of step.points) {
    const point = doc.points[id];
    if (point) out.push(point);
  }
  return out;
}

/** Marginile desenului. `null` pe un desen gol — n-are ce încadra. */
export function bounds(
  doc: DesignDoc,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const points = Object.values(doc.points);
  if (!points.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Punctele ținute în viață de trepte.
 *
 * Numai treptele. O cotă nu deține puncte, ci atârnă de ele — prima variantă
 * le socotea și pe ele, iar atunci ștergerea unei trepte nu curăța nimic:
 * cota ținea punctele, punctele țineau cota, și amândouă rămâneau agățate de
 * o treaptă care nu mai există.
 */
export function usedPoints(doc: DesignDoc): Set<string> {
  const used = new Set<string>();
  for (const step of doc.steps) for (const id of step.points) used.add(id);
  return used;
}

/* ------------------------------------------------------------------ */
/* Schimbări                                                           */
/* ------------------------------------------------------------------ */

/** Mută un punct. Toate treptele și cotele care-l folosesc se mișcă cu el. */
export function movePoint(
  doc: DesignDoc,
  id: string,
  x: number,
  y: number,
): DesignDoc {
  const point = doc.points[id];
  if (!point) return doc;
  return { ...doc, points: { ...doc.points, [id]: { ...point, x, y } } };
}

/** Mută toate punctele unei trepte deodată. */
export function moveStep(
  doc: DesignDoc,
  stepId: string,
  dx: number,
  dy: number,
): DesignDoc {
  const step = doc.steps.find((row) => row.id === stepId);
  if (!step) return doc;

  const points = { ...doc.points };
  // Un punct împărțit cu treapta vecină se mișcă o singură dată.
  for (const id of new Set(step.points)) {
    const point = points[id];
    if (point) points[id] = { ...point, x: point.x + dx, y: point.y + dy };
  }
  return { ...doc, points };
}

/** Adaugă o treaptă din colțuri date, la capătul de sus al scării. */
export function addStep(
  doc: DesignDoc,
  corners: { x: number; y: number }[],
): DesignDoc {
  if (corners.length < 3) return doc;

  const points = { ...doc.points };
  const ids: string[] = [];
  for (const corner of corners) {
    const id = uid();
    points[id] = { id, x: corner.x, y: corner.y };
    ids.push(id);
  }

  const index = doc.steps.reduce((max, step) => Math.max(max, step.index), 0) + 1;
  return {
    ...doc,
    points,
    steps: [...doc.steps, { id: uid(), points: ids, index }],
  };
}

/**
 * Șterge o treaptă.
 *
 * Punctele rămase fără stăpân pleacă odată cu ea; cele împărțite cu o treaptă
 * vecină rămân, altfel s-ar rupe și vecina. Cotele agățate de punctele
 * dispărute pleacă și ele: o cotă fără capete nu măsoară nimic.
 */
export function removeStep(doc: DesignDoc, stepId: string): DesignDoc {
  const steps = doc.steps.filter((step) => step.id !== stepId);
  if (steps.length === doc.steps.length) return doc;

  const renumbered = steps
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((step, position) => ({ ...step, index: position + 1 }));

  const next: DesignDoc = { ...doc, steps: renumbered };
  const used = usedPoints(next);

  const points: Record<string, DesignPoint> = {};
  for (const [id, point] of Object.entries(doc.points)) {
    if (used.has(id)) points[id] = point;
  }

  return {
    ...next,
    points,
    dimensions: next.dimensions.filter(
      (dimension) => points[dimension.from] && points[dimension.to],
    ),
  };
}

/**
 * Unește două puncte: al doilea dispare, tot ce-l folosea trece pe primul.
 *
 * Așa se lipesc două trepte care în fotografie se ating, dar au ieșit din
 * citire cu colțuri ușor diferite.
 */
export function mergePoints(
  doc: DesignDoc,
  keepId: string,
  dropId: string,
): DesignDoc {
  if (keepId === dropId) return doc;
  if (!doc.points[keepId] || !doc.points[dropId]) return doc;

  const points = { ...doc.points };
  delete points[dropId];

  const steps = doc.steps.map((step) => {
    const swapped = step.points.map((id) => (id === dropId ? keepId : id));
    // Același punct de două ori la rând nu mai e un contur, e o buclă goală.
    const cleaned = swapped.filter((id, position) => id !== swapped[position - 1]);
    if (cleaned.length > 1 && cleaned[0] === cleaned[cleaned.length - 1]) {
      cleaned.pop();
    }
    return { ...step, points: cleaned };
  });

  const dimensions = doc.dimensions
    .map((dimension) => ({
      ...dimension,
      from: dimension.from === dropId ? keepId : dimension.from,
      to: dimension.to === dropId ? keepId : dimension.to,
    }))
    // O cotă cu ambele capete în același punct măsoară zero.
    .filter((dimension) => dimension.from !== dimension.to);

  return { ...doc, points, steps, dimensions };
}

/**
 * Rupe o latură în două, punând un punct la mijloc.
 *
 * De aici încolo colțul nou se poate trage separat: așa devine dreaptă o
 * treaptă care în realitate e trapezoidală.
 */
export function splitEdge(
  doc: DesignDoc,
  stepId: string,
  edgeIndex: number,
): DesignDoc {
  const step = doc.steps.find((row) => row.id === stepId);
  if (!step || step.points.length < 2) return doc;
  if (edgeIndex < 0 || edgeIndex >= step.points.length) return doc;

  const fromId = step.points[edgeIndex];
  const toId = step.points[(edgeIndex + 1) % step.points.length];
  const from = doc.points[fromId];
  const to = doc.points[toId];
  if (!from || !to) return doc;

  const id = uid();
  const middle: DesignPoint = {
    id,
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };

  const points = [...step.points];
  points.splice(edgeIndex + 1, 0, id);

  return {
    ...doc,
    points: { ...doc.points, [id]: middle },
    steps: doc.steps.map((row) => (row.id === stepId ? { ...row, points } : row)),
  };
}

/* ------------------------------------------------------------------ */
/* Transformări peste tot desenul                                      */
/* ------------------------------------------------------------------ */

/** Un punct oarecare, ca centru de rotire sau de scalare. */
export interface Anchor {
  x: number;
  y: number;
}

/** Centrul desenului. `null` dacă nu e nimic desenat. */
export function center(doc: DesignDoc): Anchor | null {
  const box = bounds(doc);
  if (!box) return null;
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

function mapPoints(
  doc: DesignDoc,
  transform: (point: DesignPoint) => { x: number; y: number },
): DesignDoc {
  const points: Record<string, DesignPoint> = {};
  for (const [id, point] of Object.entries(doc.points)) {
    const moved = transform(point);
    points[id] = { id, x: moved.x, y: moved.y };
  }
  return { ...doc, points };
}

/** Rotește tot desenul în jurul unui punct. Unghiul în grade, în sens orar. */
export function rotate(doc: DesignDoc, degrees: number, anchor?: Anchor): DesignDoc {
  const pivot = anchor ?? center(doc);
  if (!pivot) return doc;

  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return mapPoints(doc, (point) => {
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;
    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos,
    };
  });
}

/**
 * Mărește sau micșorează desenul.
 *
 * Scara de calibrare se schimbă invers: desenul devine de două ori mai mare în
 * unități, deci o unitate face jumătate de milimetru față de cât făcea. Altfel
 * o redimensionare ar schimba în tăcere măsurile reale, care sunt tocmai ce
 * n-are voie să se miște.
 */
export function scaleBy(doc: DesignDoc, factor: number, anchor?: Anchor): DesignDoc {
  if (!Number.isFinite(factor) || factor <= 0) return doc;
  const pivot = anchor ?? center(doc);
  if (!pivot) return doc;

  const scaled = mapPoints(doc, (point) => ({
    x: pivot.x + (point.x - pivot.x) * factor,
    y: pivot.y + (point.y - pivot.y) * factor,
  }));

  return {
    ...scaled,
    scale: doc.scale === null ? null : doc.scale / factor,
  };
}

/* ------------------------------------------------------------------ */
/* Cote                                                                */
/* ------------------------------------------------------------------ */

export function addDimension(
  doc: DesignDoc,
  from: string,
  to: string,
  offset = 24,
): DesignDoc {
  if (from === to) return doc;
  if (!doc.points[from] || !doc.points[to]) return doc;
  // Aceeași pereche de două ori n-are ce adăuga.
  const already = doc.dimensions.some(
    (row) =>
      (row.from === from && row.to === to) || (row.from === to && row.to === from),
  );
  if (already) return doc;

  return {
    ...doc,
    dimensions: [...doc.dimensions, { id: uid(), from, to, offset, label: null }],
  };
}

export function removeDimension(doc: DesignDoc, id: string): DesignDoc {
  return { ...doc, dimensions: doc.dimensions.filter((row) => row.id !== id) };
}
