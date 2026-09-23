"use client";

import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { rateCheck } from "@/lib/pricing";

/**
 * Cât îți rămâne pe oră la prețul ăsta, față de cât îți rămâne de obicei.
 *
 * Nu spune „refuză” — spune doar unde stai. O lucrare sub media ta poate fi
 * bună din alte motive (e aproape, e un client care aduce alții), dar e bine
 * s-o știi înainte de a da prețul.
 *
 * Stătea în formularul lucrării, adică îl vedeai *după* ce trimiseseși deja
 * oferta. Acum e și acolo unde se hotărăște cifra.
 */
export function RateHint({
  price,
  hours,
  travelCost,
  average,
  currency,
}: {
  price: number;
  hours: number;
  travelCost: number;
  average: number;
  currency: string;
}) {
  const check = rateCheck({ price, otherCost: travelCost, hours, average });
  if (!check) return null;

  const tone =
    check.verdict === "bun"
      ? "text-emerald-300"
      : check.verdict === "slab"
        ? "text-amber-300"
        : "text-muted-foreground";

  return (
    <p className={cn("flex items-start gap-2 text-xs", tone)}>
      <Scale className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Îți rămân{" "}
        <strong>{formatMoney(check.perHour, currency)}</strong> pe oră.{" "}
        {check.verdict === "la_fel"
          ? `Cam cât de obicei (${formatMoney(check.average, currency)}).`
          : check.verdict === "bun"
            ? `Cu ${formatMoney(check.diff, currency)} peste media ta.`
            : `Cu ${formatMoney(Math.abs(check.diff), currency)} sub media ta de ${formatMoney(check.average, currency)}.`}
      </span>
    </p>
  );
}
