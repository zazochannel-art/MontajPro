/**
 * Ce se ia din ofertă când devine lucrare.
 *
 * Până acum, oferta acceptată se transforma într-o lucrare de tip „Altceva”,
 * cu toate liniile lipite ca text în notițe. Adică scriseseși o dată scara cu
 * cincisprezece trepte, iar lucrarea nu știa nici că e scară, nici câte ore ai
 * socotit, nici câți kilometri ai pus la drum.
 *
 * Liniile ofertei sunt manoperă, nu materiale — de aceea nu devin materiale pe
 * lucrare. Devin ce sunt: tipul lucrării, orele și kilometrii.
 */
import { builtinId, matchPosition, type Position } from "./price-list";
import { num } from "./utils";
import { JOB_TYPES, type JobType } from "./types";

export interface QuotePlan {
  /** Tipul de lucrare, după linia care cântărește cel mai mult. */
  type: JobType;
  /** Orele de manoperă, dacă oferta are o linie la oră. */
  hours: number;
  /** Kilometrii de deplasare, dacă oferta are linia de drum. */
  travelKm: number;
  /** Mărimea lucrării, în unitatea tipului ei: m², trepte, metri. */
  size: number;
}

/**
 * Cât trebuie să știe o linie ca să poată fi citită.
 *
 * Oferta salvată are `QuoteItem`-uri; formularul are rânduri de ecran, cu
 * cheie proprie și fără `deleted_at`. Citirea e aceeași pentru amândouă, deci
 * cere doar ce chiar folosește.
 */
export type ReadableItem = {
  description: string;
  quantity: number;
  unit_price: number;
  deleted_at?: string | null;
};

/** Cât face linia. */
function lineTotal(item: Pick<ReadableItem, "quantity" | "unit_price">): number {
  return num(item.quantity) * num(item.unit_price);
}

/**
 * Tipul lucrării, citit din liniile ofertei.
 *
 * Se alege după bani, nu după numărul de linii: o scară cu o singură linie de
 * 12.000 de lei bate trei linii de consumabile a câte 200. Pozițiile „any”
 * (manoperă la oră, deplasare) nu votează — sunt la fel de bune pentru orice
 * lucrare, deci n-au ce spune despre tipul ei.
 *
 * Fără nicio linie care să știe tipul, rămâne „other” — cum era și înainte,
 * dar acum fiindcă chiar nu se știe, nu din lene.
 */
export function typeFromItems(
  items: ReadableItem[],
  positions: Position[],
): JobType {
  const weight = new Map<JobType, number>();

  for (const item of items) {
    const position = matchPosition(positions, item.description);
    if (!position || position.kind === "any") continue;
    const kind = position.kind;
    weight.set(kind, (weight.get(kind) ?? 0) + lineTotal(item));
  }

  let best: JobType = "other";
  let most = 0;
  // Ordinea din JOB_TYPES decide la egalitate, ca rezultatul să nu depindă
  // de ordinea în care s-au scris liniile.
  for (const kind of JOB_TYPES) {
    const value = weight.get(kind) ?? 0;
    if (value > most) {
      best = kind;
      most = value;
    }
  }
  return best;
}

/** Cantitatea de pe linia unei poziții implicite, adunată dacă se repetă. */
function quantityOf(
  items: ReadableItem[],
  positions: Position[],
  id: string,
): number {
  let total = 0;
  for (const item of items) {
    const position = matchPosition(positions, item.description);
    if (position?.id === id) total += num(item.quantity);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Cât de mare e lucrarea din ofertă, în unitatea tipului ei.
 *
 * Metri pătrați pentru parchet, trepte pentru scară, metri pentru plintă —
 * adunate din liniile care chiar țin de tipul ăsta. Pozițiile „any” nu intră:
 * orele și kilometrii nu sunt mărimea lucrării, sunt altceva.
 *
 * Cifra asta ține loc de măsurătoare înainte să existe una. Cu ea, ritmul tău
 * (`pace.ts`) poate spune câte ore ies din ofertă — deci și cât îți rămâne pe
 * oră la prețul scris, înainte să-l trimiți.
 */
export function sizeFromItems(
  items: ReadableItem[],
  positions: Position[],
  kind: JobType,
): number {
  let total = 0;
  for (const item of items) {
    if (item.deleted_at) continue;
    const position = matchPosition(positions, item.description);
    if (!position || position.kind !== kind) continue;
    total += num(item.quantity);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Orele lucrării din ofertă: cele scrise, plus cele care ies din mărime.
 *
 * Prima variantă lua ori orele scrise, ori pe cele din ritm — niciodată
 * amândouă. O ofertă cu cincisprezece trepte ȘI patru ore de manoperă în plus
 * se socotea ca patru ore, deci „îți rămân pe oră” ieșea de câteva ori mai
 * mare decât adevărul, exact în locul unde omul se uită ca să hotărască
 * prețul.
 *
 * Liniile la oră sunt muncă peste cea din mărime, nu în locul ei: se adună.
 */
export function quoteHours(
  plan: Pick<QuotePlan, "hours" | "size">,
  pacedHours: number | null | undefined,
): number {
  const written = num(plan.hours);
  // Fără mărime n-are ce spune ritmul: rămân doar orele scrise.
  if (plan.size <= 0 || !pacedHours || pacedHours <= 0) return written;
  return Math.round((written + pacedHours) * 100) / 100;
}

/** Tot ce se poate citi dintr-o ofertă, ca să nu se scrie a doua oară. */
export function planFromQuote(
  items: ReadableItem[],
  positions: Position[],
): QuotePlan {
  const live = items.filter((item) => !item.deleted_at);
  const type = typeFromItems(live, positions);
  return {
    type,
    hours: quantityOf(live, positions, builtinId("hourly")),
    travelKm: quantityOf(live, positions, builtinId("travel_km")),
    size: sizeFromItems(live, positions, type),
  };
}
