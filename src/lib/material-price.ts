/**
 * Cât ai plătit pe materialul ăsta, de-a lungul timpului.
 *
 * Fiecare linie de material pe o lucrare ține prețul pe unitate și data ei,
 * deci istoricul e deja în bază de când există aplicația. Nu-l citea nimeni:
 * `unit_price` intra doar în suma costurilor.
 *
 * Iar diferența contează. Pachetul de parchet cu 42 de lei anul trecut și cu
 * 58 azi e o creștere de 38% pe care o plătești fără s-o vezi, fiindcă
 * prețul se uită între două lucrări.
 */
import { num } from "./utils";
import type { JobMaterial } from "./types";

export interface PricePoint {
  /** ISO date — ziua în care s-a trecut pe lucrare. */
  day: string;
  price: number;
  job_id: string;
}

export interface PriceTrend {
  /** Prețurile, de la cel mai vechi la cel mai nou. */
  points: PricePoint[];
  first: number;
  last: number;
  /** Cât s-a schimbat, în procente, de la primul la ultimul. */
  change: number;
  /** Cel mai mic preț plătit vreodată. */
  best: number;
  direction: "sus" | "jos" | "la_fel";
}

/**
 * Istoricul de preț al unui material din depozit.
 *
 * Se leagă prin `material_id`: o linie scrisă de mână, fără legătură cu
 * inventarul, n-are cum ști că e același material. Liniile fără preț nu intră
 * — zero nu e un preț, e un câmp necompletat.
 *
 * Sub două prețuri nu există tendință, deci întoarce `null`: un singur preț
 * nu s-a schimbat față de nimic.
 */
export function priceTrend(
  materials: JobMaterial[],
  materialId: string,
): PriceTrend | null {
  const points: PricePoint[] = materials
    .filter(
      (row) =>
        !row.deleted_at && row.material_id === materialId && num(row.unit_price) > 0,
    )
    .map((row) => ({
      day: row.created_at.slice(0, 10),
      price: num(row.unit_price),
      job_id: row.job_id,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  if (points.length < 2) return null;

  const first = points[0].price;
  const last = points[points.length - 1].price;
  const best = points.reduce((low, point) => Math.min(low, point.price), first);
  const change = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;

  return {
    points,
    first,
    last,
    best,
    change,
    // Sub un procent nu e o schimbare de preț, e o rotunjire de bon.
    direction: change > 1 ? "sus" : change < -1 ? "jos" : "la_fel",
  };
}
