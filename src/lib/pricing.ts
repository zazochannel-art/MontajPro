/**
 * Prețul, pe clientul din fața ta.
 *
 * Până acum exista o singură listă de prețuri pentru toată lumea. Dar
 * constructorul care îți aduce cinci apartamente pe an nu plătește cât omul
 * care vine o dată în viață, așa că reducerea stătea în capul tău și o
 * recalculai la fiecare ofertă.
 */
import { num } from "./utils";
import type { Client } from "./types";

/** Cât plătește clientul ăsta, după lista ta. */
export function adjustedPrice(
  base: number,
  client: Pick<Client, "price_adjust"> | null | undefined,
): number {
  const price = num(base);
  const adjust = num(client?.price_adjust);
  if (!adjust) return price;
  return Math.round(price * (1 + adjust / 100) * 100) / 100;
}

/** „−10%” sau „+5%”, gata de pus pe ecran. Gol când n-are ajustare. */
export function adjustLabel(
  client: Pick<Client, "price_adjust"> | null | undefined,
): string {
  const adjust = num(client?.price_adjust);
  if (!adjust) return "";
  return `${adjust > 0 ? "+" : "−"}${Math.abs(adjust)}%`;
}

export interface RateCheck {
  /** Cât îți rămâne pe oră la lucrarea asta. */
  perHour: number;
  /** Cu cât stai față de media ta. Negativ = sub. */
  diff: number;
  /** Media ta, cea cu care se compară. */
  average: number;
  verdict: "bun" | "la_fel" | "slab";
}

/**
 * Merită lucrarea asta?
 *
 * Răspunsul nu e „da/nu”, e o comparație cu tine însuți: cât îți rămâne pe oră
 * aici, față de cât îți rămâne de obicei. O lucrare sub media ta nu e neapărat
 * de refuzat — dar e bine s-o știi înainte de a da prețul, nu în raportul de
 * luna viitoare.
 */
export function rateCheck(input: {
  price: number;
  materialsCost?: number | null;
  otherCost?: number | null;
  hours: number;
  average: number;
}): RateCheck | null {
  const hours = num(input.hours);
  const average = num(input.average);
  if (hours < 0.25 || average <= 0) return null;

  const left = num(input.price) - num(input.materialsCost) - num(input.otherCost);
  const perHour = Math.round((left / hours) * 100) / 100;
  const diff = Math.round((perHour - average) * 100) / 100;

  // Sub o zecime nu e o diferență, e zgomot.
  const band = average * 0.1;
  return {
    perHour,
    diff,
    average: Math.round(average * 100) / 100,
    verdict: diff > band ? "bun" : diff < -band ? "slab" : "la_fel",
  };
}
