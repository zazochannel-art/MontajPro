import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ce are `crypto` în browserele vechi — adică poate nimic.
 *
 * Typings-urile DOM spun că `randomUUID` există mereu, deci o verificare
 * obișnuită s-ar reduce la „întotdeauna adevărat” și n-ar mai lăsa loc de
 * fallback. Aici se scrie cum stau lucrurile de fapt.
 */
type MaybeCrypto = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

/** ID-uri stabile, generate pe client (compatibile cu `uuid` din Postgres). */
export function uid(): string {
  const source: MaybeCrypto | undefined =
    typeof crypto === "undefined" ? undefined : crypto;
  if (source?.randomUUID) return source.randomUUID();

  /*
   * Fallback pentru contexte fără `crypto.randomUUID`.
   *
   * Octeții vin tot din `crypto`, nu din `Math.random()`: aceleași id-uri
   * lipite două câte două fac tokenurile linkurilor publice (oferta, lucrarea,
   * portofoliul). Un `Math.random()` se poate ghici din câteva ieșiri, iar
   * atunci linkul „imposibil de ghicit” n-ar mai fi. Mai bine o eroare
   * zgomotoasă decât un token slab.
   */
  if (!source?.getRandomValues) {
    throw new Error("Lipsește crypto: nu se pot genera id-uri.");
  }
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Suma unei liste, ignorând valorile lipsă. */
export function sum<T>(items: T[], pick: (item: T) => number | null | undefined) {
  return items.reduce((acc, item) => acc + (Number(pick(item)) || 0), 0);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Transformă orice input de formular într-un număr sigur. */
export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Normalizează un număr de telefon pentru linkuri `tel:` / WhatsApp. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export function mapsHref(address: string | null | undefined): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Grupează o listă după o cheie calculată. */
export function groupBy<T, K extends string>(
  items: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}
