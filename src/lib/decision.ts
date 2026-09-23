/**
 * Cât stă clientul până se hotărăște.
 *
 * „Ofertă neconfirmată” se aprindea la trei zile pentru toată lumea — o cifră
 * aleasă din burtă, care sună la fel pentru o scară de 40.000 și pentru o
 * plintă de 600. Dar `sent_at` și `accepted_at` stau amândouă în bază pe
 * fiecare ofertă câștigată: din ele iese cât durează, de obicei, la tine.
 *
 * Mediană, nu medie — din același motiv ca la ritmul de lucru (`pace.ts`): un
 * client care a tăcut trei luni și apoi a semnat n-are voie să mute cifra
 * pentru totdeauna.
 */
import type { Quote } from "./types";

/** Sub atâtea oferte câștigate, cifra e o coincidență, nu un obicei. */
export const MIN_QUOTES = 4;

/** Cât se așteaptă când nu există încă istoric. */
export const FALLBACK_DAYS = 3;

export interface DecisionPace {
  /** Zilele, ca mediană, de la trimitere la acceptare. */
  median: number;
  /** Din câte oferte câștigate iese cifra. */
  quotes: number;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Ritmul tău de hotărâre, din ofertele deja acceptate.
 *
 * Întoarce `null` până sunt destule: mai bine niciun număr decât unul care
 * pare măsurat și e o părere.
 */
export function decisionPace(quotes: Quote[]): DecisionPace | null {
  const days: number[] = [];
  for (const quote of quotes) {
    if (quote.deleted_at) continue;
    if (!quote.sent_at) continue;
    const decided = quote.accepted_by_client_at ?? quote.accepted_at;
    if (!decided) continue;
    const span = daysBetween(quote.sent_at, decided);
    if (span === null) continue;
    days.push(span);
  }

  if (days.length < MIN_QUOTES) return null;
  return { median: Math.round(median(days) * 10) / 10, quotes: days.length };
}

/**
 * După câte zile o ofertă netrimisă mai departe chiar întârzie.
 *
 * O zi peste mediană, ca să nu dai ghes fix în ziua în care omul se hotăra
 * oricum. Fără istoric, se rămâne la trei zile: e o presupunere, dar una
 * care nu pretinde că e măsurată.
 */
export function lateAfterDays(pace: DecisionPace | null): number {
  if (!pace) return FALLBACK_DAYS;
  return Math.max(FALLBACK_DAYS, Math.ceil(pace.median) + 1);
}
