/**
 * Câte oferte câștigi, și pe ce le pierzi.
 *
 * „Refuzată” exista ca stare, dar nimic nu întreba de ce. Iar fără motiv,
 * singura concluzie care-ți rămâne după trei refuzuri e „lumea n-are bani” —
 * care nu te ajută să schimbi nimic. Dacă în schimb vezi că cinci din șase
 * pierdute au fost pe preț, știi exact ce să faci la a șaptea.
 *
 * Ciornele nu se numără: o ofertă nescrisă până la capăt n-a fost nici
 * câștigată, nici pierdută.
 */
import { num } from "./utils";
import type { Quote, QuoteItem } from "./types";

export const REJECT_REASONS = [
  "price",
  "timing",
  "competitor",
  "postponed",
  "no_answer",
  "other",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  price: "Prea scump",
  timing: "Nu puteam la data cerută",
  competitor: "A luat altcineva lucrarea",
  postponed: "A amânat lucrarea",
  no_answer: "N-a mai răspuns",
  other: "Altceva",
};

export function isRejectReason(value: unknown): value is RejectReason {
  return REJECT_REASONS.includes(value as RejectReason);
}

export interface ReasonCount {
  reason: RejectReason | null;
  quotes: number;
  value: number;
}

export interface QuoteStats {
  /** Oferte ieșite din ciornă: trimise, acceptate sau refuzate. */
  decided: number;
  sent: number;
  accepted: number;
  rejected: number;
  /** Cât fac ofertele acceptate. */
  wonValue: number;
  /** Cât fac cele refuzate — banii pe lângă care ai trecut. */
  lostValue: number;
  /** Procentul de oferte câștigate din cele care au primit un răspuns. */
  winRate: number | null;
  /** Motivele refuzului, cele mai multe întâi. */
  reasons: ReasonCount[];
}

/** Cât face oferta, după liniile ei, minus reducerea. */
function quoteValue(quote: Quote, items: QuoteItem[]): number {
  const subtotal = items
    .filter((item) => item.quote_id === quote.id && !item.deleted_at)
    .reduce((acc, item) => acc + num(item.quantity) * num(item.unit_price), 0);
  return Math.max(0, subtotal - num(quote.discount));
}

/**
 * Socoteala ofertelor dintr-o perioadă.
 *
 * `from` și `to` sunt date ISO, inclusiv amândouă; fără ele intră tot.
 * Data după care se filtrează e cea a trimiterii, iar pentru cele netrimise
 * cea a creării: o ofertă se judecă din clipa în care a plecat din mână.
 */
export function quoteStats(
  quotes: Quote[],
  items: QuoteItem[],
  range?: { from?: string; to?: string },
): QuoteStats {
  const inRange = (quote: Quote) => {
    const day = (quote.sent_at ?? quote.created_at).slice(0, 10);
    if (range?.from && day < range.from) return false;
    if (range?.to && day > range.to) return false;
    return true;
  };

  const live = quotes.filter(
    (quote) => !quote.deleted_at && quote.status !== "draft" && inRange(quote),
  );

  const accepted = live.filter((quote) => quote.status === "accepted");
  const rejected = live.filter((quote) => quote.status === "rejected");
  const sent = live.filter((quote) => quote.status === "sent");

  const wonValue = accepted.reduce((acc, quote) => acc + quoteValue(quote, items), 0);
  const lostValue = rejected.reduce((acc, quote) => acc + quoteValue(quote, items), 0);

  /*
   * Rata se calculează din ofertele care au primit un răspuns. Cele încă
   * trimise n-au pierdut nimic — doar n-au răspuns încă, iar dacă le-am
   * număra ca pierdute, rata ar arăta prost exact în lunile bune.
   */
  const answered = accepted.length + rejected.length;
  const winRate = answered > 0 ? Math.round((accepted.length / answered) * 100) : null;

  const byReason = new Map<RejectReason | null, ReasonCount>();
  for (const quote of rejected) {
    const reason = isRejectReason(quote.rejected_reason) ? quote.rejected_reason : null;
    const current = byReason.get(reason) ?? { reason, quotes: 0, value: 0 };
    current.quotes += 1;
    current.value += quoteValue(quote, items);
    byReason.set(reason, current);
  }

  return {
    decided: live.length,
    sent: sent.length,
    accepted: accepted.length,
    rejected: rejected.length,
    wonValue: Math.round(wonValue * 100) / 100,
    lostValue: Math.round(lostValue * 100) / 100,
    winRate,
    reasons: [...byReason.values()].sort(
      (a, b) => b.quotes - a.quotes || b.value - a.value,
    ),
  };
}
