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
import { JOB_TYPES, type JobType, type QuoteItem } from "./types";

export interface QuotePlan {
  /** Tipul de lucrare, după linia care cântărește cel mai mult. */
  type: JobType;
  /** Orele de manoperă, dacă oferta are o linie la oră. */
  hours: number;
  /** Kilometrii de deplasare, dacă oferta are linia de drum. */
  travelKm: number;
}

/** Cât face linia. */
function lineTotal(item: Pick<QuoteItem, "quantity" | "unit_price">): number {
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
  items: QuoteItem[],
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
  items: QuoteItem[],
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

/** Tot ce se poate citi dintr-o ofertă, ca să nu se scrie a doua oară. */
export function planFromQuote(
  items: QuoteItem[],
  positions: Position[],
): QuotePlan {
  const live = items.filter((item) => !item.deleted_at);
  return {
    type: typeFromItems(live, positions),
    hours: quantityOf(live, positions, builtinId("hourly")),
    travelKm: quantityOf(live, positions, builtinId("travel_km")),
  };
}
