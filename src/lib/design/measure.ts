/**
 * De la formă la milimetri.
 *
 * O fotografie nu conține mărimi. Conține proporții — și nici pe acelea
 * întregi, fiindcă perspectiva face treapta de jos mai lată decât cea de sus,
 * deși în realitate sunt la fel. De aceea aici nu se inventează nimic: până
 * când omul nu spune „distanța asta e un metru”, tot ce se poate scrie pe
 * desen sunt unități, nu milimetri.
 *
 * Cifra care apare cât timp nu e calibrare e o proporție, și se spune pe
 * ecran că e estimare. E o regulă, nu o precauție: cineva taie lemn după ea.
 */
import { num } from "../utils";
import type { DesignDoc, DesignStep } from "./model";
import { stepPoints } from "./model";

/** Distanța dintre două puncte, în unități de desen. */
export function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Scara, dintr-o distanță știută.
 *
 * Omul arată pe desen două puncte între care știe cât e — pragul ușii, o
 * treaptă măsurată cu ruleta — și scrie valoarea. De acolo încolo tot desenul
 * are milimetri.
 *
 * Întoarce `null` când nu se poate socoti: două puncte suprapuse sau o valoare
 * fără sens n-au ce scară să dea.
 */
export function scaleFrom(
  a: { x: number; y: number },
  b: { x: number; y: number },
  realMm: number,
): number | null {
  const units = distance(a, b);
  const mm = num(realMm);
  if (units <= 0 || mm <= 0) return null;
  return mm / units;
}

/** Unități de desen → milimetri. `null` cât timp desenul nu e calibrat. */
export function toMm(doc: DesignDoc, units: number): number | null {
  if (doc.scale === null) return null;
  return Math.round(units * doc.scale);
}

export interface StepMeasures {
  step: DesignStep;
  /** Latura din față, cea pe care calci: lungimea treptei. */
  width: number;
  /** Cât de adâncă e treapta, din față spre spate. */
  depth: number;
  /** Unghiul laturii din față față de orizontală, în grade. */
  angle: number;
  /** Suprafața conturului, în unități pătrate. Pentru material, mai târziu. */
  area: number;
}

/**
 * Aria unui poligon, prin formula suveiului.
 *
 * Valoarea absolută: nu ne interesează în ce sens e scris conturul, ci cât
 * ține treapta.
 */
export function polygonArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Măsurile unei trepte, citite din conturul ei.
 *
 * Latura din față e cea mai lungă latură aproape orizontală — muchia pe care
 * calci și pe care o dai la debitat. Adâncimea iese din arie împărțită la
 * lățime, nu din „a doua latură”: pe o treaptă în evantai a doua latură nu
 * spune nimic, iar aria împărțită la muchie dă adâncimea medie, care e chiar
 * cifra de care ai nevoie ca să știi cât material intră.
 */
export function measureStep(doc: DesignDoc, step: DesignStep): StepMeasures | null {
  const points = stepPoints(doc, step);
  if (points.length < 3) return null;

  let width = 0;
  let angle = 0;
  for (let i = 0; i < points.length; i += 1) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const length = distance(from, to);
    // Grade față de orizontală, între -90 și 90.
    const degrees = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    const fromHorizontal = Math.abs(((degrees + 90) % 180) - 90);
    // Laturile aproape verticale sunt adâncimea, nu muchia din față.
    if (fromHorizontal > 45) continue;
    if (length > width) {
      width = length;
      angle = Math.round(fromHorizontal * 10) / 10;
    }
  }

  const area = polygonArea(points);
  // Fără nicio latură orizabilă, forma e prea ciudată ca să spunem care e fața.
  if (width <= 0) return { step, width: 0, depth: 0, angle: 0, area };

  return {
    step,
    width: Math.round(width * 10) / 10,
    depth: Math.round((area / width) * 10) / 10,
    angle,
    area,
  };
}

export function measureAll(doc: DesignDoc): StepMeasures[] {
  return doc.steps
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((step) => measureStep(doc, step))
    .filter((row): row is StepMeasures => row !== null);
}

/** Suprafața tuturor treptelor. În metri pătrați dacă desenul e calibrat. */
export function totalArea(doc: DesignDoc): { units: number; m2: number | null } {
  const units = measureAll(doc).reduce((sum, row) => sum + row.area, 0);
  if (doc.scale === null) return { units, m2: null };
  // Aria se scalează cu pătratul, iar milimetrul pătrat face un milion într-un
  // metru pătrat.
  const mm2 = units * doc.scale * doc.scale;
  return { units, m2: Math.round((mm2 / 1_000_000) * 1000) / 1000 };
}

/**
 * Cum se scrie o măsură pe desen.
 *
 * Calibrat: milimetri, cum se citesc pe șantier. Necalibrat: unități, cu semnul
 * că e o proporție — niciodată „mm” peste o cifră scoasă din pixeli.
 */
export function formatMeasure(doc: DesignDoc, units: number): string {
  const mm = toMm(doc, units);
  if (mm === null) return `${Math.round(units)} u`;
  return `${mm} mm`;
}
