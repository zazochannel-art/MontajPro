/**
 * Cât comanzi de fapt: pachete întregi, nu metri pătrați.
 *
 * Calculatorul adună corect suprafața și adaugă procentul de pierdere. Dar
 * parchetul nu se vinde la metru: se vinde în pachete. 74,8 m² ceruți, cu
 * pachetul de 2,18 m², înseamnă 35 de pachete — adică 76,3 m², din care 1,5
 * rămân în pod pentru ziua în care se sparge o lamelă.
 *
 * Împărțirea asta se făcea în cap, în magazin, cu telefonul într-o mână.
 */
import { num } from "./utils";

export interface PackPlan {
  /** Câte pachete iei. */
  packs: number;
  /** Cât material iese din ele, în unitatea materialului. */
  total: number;
  /** Cât rămâne peste ce-ți trebuie. */
  leftover: number;
}

/*
 * Împărțirea în virgulă mobilă minte la capete: 4.36 / 2.18 dă
 * 2.0000000000000004, iar rotunjirea în sus ar cere trei pachete în loc de
 * două. Tăiem firul de praf înainte de rotunjire.
 */
const EPSILON = 1e-9;

/**
 * Câte pachete acoperă cantitatea cerută.
 *
 * Întoarce `null` când materialul nu se vinde la pachet (n-are `packSize`) sau
 * când nu e nimic de comandat — în ambele cazuri nu e nimic de rotunjit.
 */
export function packPlan(
  needed: number | null | undefined,
  packSize: number | null | undefined,
): PackPlan | null {
  const quantity = num(needed);
  const size = num(packSize);
  if (quantity <= 0 || size <= 0) return null;

  const exact = quantity / size;
  const packs = Math.ceil(exact - EPSILON);
  const total = round2(packs * size);
  return { packs, total, leftover: round2(total - quantity) };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Rândul de citit, gata scris: „35 pachete = 76,3 m² (1,5 în plus)”. */
export function packPlanText(plan: PackPlan | null, unit: string): string {
  if (!plan) return "";
  const pieces = `${plan.packs} ${plan.packs === 1 ? "pachet" : "pachete"} = ${plan.total} ${unit}`;
  if (plan.leftover <= 0) return pieces;
  return `${pieces} (${plan.leftover} ${unit} în plus)`;
}
