/**
 * Pragul zilei: cât trebuie să aducă o zi de lucru ca să nu lucrezi degeaba.
 *
 * Cheltuielile fixe se scad corect din profitul lunii, dar acolo le vezi o
 * dată, la sfârșit, când nu mai ai ce face cu ele. Cifra utilă e alta, și se
 * folosește la început: chiria, telefonul, leasingul și asigurarea, împărțite
 * la zilele în care chiar lucrezi. Sub atât, ziua a fost pentru proprietar.
 *
 * Zilele se numără din lună, nu dintr-o constantă: o lună cu 23 de zile
 * lucrătoare cere mai puțin pe zi decât una cu 20. Iar zilele blocate — o
 * nuntă, o sărbătoare, o zi la spital — se scad, fiindcă cheltuiala rămâne
 * aceeași și se împarte la mai puține zile. Îți blochezi o săptămână, pragul
 * urcă: exact ce se întâmplă în realitate.
 */
import { num } from "./utils";
import type { DayBlock, FixedCost } from "./types";
import { fixedCostsForMonth } from "./calc";

export interface DayThreshold {
  /** Cheltuielile fixe ale lunii. */
  fixed: number;
  /** Zilele lucrătoare rămase în socoteală, după ce scazi ce ai blocat. */
  days: number;
  /** Cât trebuie să aducă o zi, curat, doar pentru fix. */
  perDay: number;
  /** Din câte zile lucrătoare are luna. */
  workDays: number;
  /** Câte ai blocat dintre ele. */
  blocked: number;
}

/** Zilele de luni până vineri dintr-o lună, ca chei. */
export function workDaysOf(monthKey: string): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return [];

  const days: string[] = [];
  // Ziua 0 a lunii următoare este ultima zi a lunii cerute.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay();
    // Duminica (0) și sâmbăta (6) nu intră: cine lucrează și sâmbăta are
    // oricum ziua în plus, iar pragul iese mai mic — nu mai mare.
    if (weekday === 0 || weekday === 6) continue;
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Pragul lunii cerute.
 *
 * Fără cheltuieli fixe nu există prag: n-are ce acoperi ziua. Asta nu e o
 * greșeală, e un om care încă n-a scris ce-l costă lunar.
 */
export function dayThreshold(
  costs: FixedCost[],
  blocks: DayBlock[],
  monthKey: string,
): DayThreshold | null {
  const fixed = fixedCostsForMonth(costs, monthKey);
  if (fixed <= 0) return null;

  const all = workDaysOf(monthKey);
  if (!all.length) return null;

  const blockedDays = new Set(
    blocks.filter((row) => !row.deleted_at).map((row) => row.day),
  );
  const blocked = all.filter((day) => blockedDays.has(day)).length;
  // Cel puțin o zi: împărțirea la zero n-ar spune nimic, iar o lună blocată
  // în întregime înseamnă că tot ce e fix cade pe singura zi rămasă.
  const days = Math.max(1, all.length - blocked);

  return {
    fixed: Math.round(num(fixed) * 100) / 100,
    days,
    perDay: Math.round((fixed / days) * 100) / 100,
    workDays: all.length,
    blocked,
  };
}
