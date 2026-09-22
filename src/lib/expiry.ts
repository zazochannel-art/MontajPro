/**
 * Oferta care a expirat.
 *
 * Termenul de valabilitate se scria pe ofertă și se tipărea pe hârtie, dar
 * aplicația nu-l citea niciodată. Baza, da: `quote_by_token` și `accept_quote`
 * refuză amândouă o ofertă trecută de termen, deci clientul deschide linkul
 * și nu vede nimic — iar tu îi dai ghes fără să știi că n-are ce deschide.
 *
 * Aici se citește același termen, ca să se vadă și în aplicație.
 */
import type { Quote } from "./types";

export interface Expiry {
  /** Zile până la termen; negativ înseamnă că a trecut. */
  days: number;
  /** A trecut termenul: linkul public nu mai întoarce nimic. */
  expired: boolean;
  /** Mai are cel mult trei zile — încă se poate prelungi la timp. */
  soon: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Cum stă oferta cu termenul.
 *
 * Întoarce `null` când întrebarea n-are sens: ofertă fără termen, ciornă,
 * ofertă deja acceptată sau refuzată, ofertă ștearsă. O ofertă acceptată
 * nu „expiră” — s-a terminat cu bine înainte.
 */
export function quoteExpiry(
  quote: Pick<Quote, "valid_until" | "status" | "deleted_at">,
  today: string,
): Expiry | null {
  if (quote.deleted_at) return null;
  if (quote.status !== "sent") return null;
  if (!quote.valid_until) return null;

  const due = Date.parse(`${quote.valid_until.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return null;

  const days = Math.round((due - now) / DAY);
  return { days, expired: days < 0, soon: days >= 0 && days <= 3 };
}

/** Ofertele trecute de termen, cele mai vechi întâi. */
export function expiredQuotes(quotes: Quote[], today: string): Quote[] {
  return quotes
    .filter((quote) => quoteExpiry(quote, today)?.expired)
    .sort((a, b) => (a.valid_until ?? "").localeCompare(b.valid_until ?? ""));
}

/**
 * Un termen nou, pornit de azi.
 *
 * Prelungirea nu se face din vechiul termen: dacă oferta a stat două luni,
 * „încă paisprezece zile” din ziua în care expirase ar însemna un termen tot
 * trecut. Se numără de azi, ca omul să aibă chiar atâtea zile.
 */
export function extendedUntil(today: string, days = 14): string {
  const start = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start)) return today.slice(0, 10);
  return new Date(start + days * DAY).toISOString().slice(0, 10);
}
