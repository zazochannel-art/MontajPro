import type { DefaultRates, JobType, PriceItem, Settings } from "./types";

/**
 * Lista de poziții din care se alege în calculatorul de preț.
 *
 * Sunt două feluri de poziții, ținute separat ca să nu existe două surse
 * pentru același preț:
 *
 * - cele **implicite**, cele șapte tarife din setări (`default_rates`). Prețul
 *   stă acolo, aici doar numele și unitatea;
 * - cele **proprii**, adăugate de utilizator în setări (`price_list`), cu
 *   nume, unitate și preț la un loc.
 *
 * Calculatorul le vede pe amândouă la fel: alegi poziția, prețul și unitatea
 * vin singure din setări.
 */

export interface Position {
  id: string;
  name: string;
  unit: string;
  price: number;
  kind: JobType | "any";
}

/** Valoarea din selector pentru o linie scrisă de mână. */
export const CUSTOM_POSITION = "custom";

export const BUILTIN_POSITIONS: {
  key: keyof DefaultRates;
  name: string;
  unit: string;
  kind: JobType | "any";
}[] = [
  { key: "stair_step", name: "Montaj treaptă", unit: "buc", kind: "stairs" },
  { key: "stair_riser", name: "Contratreaptă", unit: "buc", kind: "stairs" },
  { key: "landing", name: "Podest", unit: "buc", kind: "stairs" },
  { key: "railing", name: "Balustradă", unit: "set", kind: "stairs" },
  { key: "parquet_m2", name: "Montaj parchet", unit: "m²", kind: "parquet" },
  { key: "plinth_m", name: "Montaj plintă", unit: "m", kind: "plinth" },
  { key: "hourly", name: "Manoperă la oră", unit: "oră", kind: "any" },
];

/** Id-ul unei poziții implicite, ca să nu se ciocnească cu cele proprii. */
export function builtinId(key: keyof DefaultRates): string {
  return `rate:${key}`;
}

/** Toate pozițiile disponibile: întâi cele implicite, apoi cele proprii. */
export function allPositions(
  settings: Pick<Settings, "default_rates" | "price_list"> | null | undefined,
): Position[] {
  const rates = (settings?.default_rates ?? {}) as Partial<DefaultRates>;
  const builtins: Position[] = BUILTIN_POSITIONS.map((item) => ({
    id: builtinId(item.key),
    name: item.name,
    unit: item.unit,
    price: Number(rates[item.key]) || 0,
    kind: item.kind,
  }));

  const own: Position[] = (settings?.price_list ?? [])
    .filter((item) => item.name.trim())
    .map((item: PriceItem) => ({
      id: item.id,
      name: item.name,
      unit: item.unit || "buc",
      price: Number(item.price) || 0,
      kind: item.kind ?? "any",
    }));

  return [...builtins, ...own];
}

export function findPosition(list: Position[], id: string): Position | undefined {
  return list.find((item) => item.id === id);
}

/**
 * Pozițiile împărțite în două grupuri: cele care se potrivesc tipului de
 * lucrare deschis și restul. Pe telefon contează ordinea — ce cauți trebuie
 * să fie sus, nu la al treilea scroll.
 */
export function groupedPositions(list: Position[], kind: JobType) {
  const matching = list.filter((item) => item.kind === kind);
  const rest = list.filter((item) => item.kind !== kind);
  return { matching, rest };
}

/**
 * Pozițiile grupate pe tip de lucrare, în ordinea în care se caută.
 *
 * Calculatorul are tab-uri, deci știe ce tip e deschis; oferta nu — acolo
 * grupurile țin loc de tab-uri.
 */
export function positionGroups(
  list: Position[],
): { kind: JobType | "any"; items: Position[] }[] {
  const order: (JobType | "any")[] = ["stairs", "parquet", "plinth", "other", "any"];
  return order
    .map((kind) => ({ kind, items: list.filter((item) => item.kind === kind) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Poziția cu numele dat, dacă există.
 *
 * Liniile salvate înainte de lista de poziții — sau venite din calculator —
 * țin doar denumirea. Dacă aceasta se potrivește cu o poziție, selectorul o
 * arată aleasă în loc să pară scrisă de mână.
 */
export function matchPosition(list: Position[], name: string): Position | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return list.find((item) => item.name.trim().toLowerCase() === needle);
}

/** Adevărat cât timp niciun tarif nu e pus: atunci merită îndrumat spre setări. */
export function everyPriceUnset(list: Position[]): boolean {
  return list.every((item) => item.price <= 0);
}
