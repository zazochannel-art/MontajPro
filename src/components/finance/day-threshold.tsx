"use client";

import { useMemo } from "react";
import { Target } from "lucide-react";
import { useTable } from "@/hooks/use-data";
import { dayThreshold } from "@/lib/threshold";
import { formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { useT } from "@/hooks/use-t";

/**
 * Pragul zilei.
 *
 * Cheltuielile fixe se scad corect din profitul lunii, dar acolo le vezi o
 * dată, la sfârșit, când nu mai ai ce face cu ele. Cifra utilă e alta și se
 * folosește la început: chiria, telefonul și leasingul, împărțite la zilele în
 * care chiar lucrezi. Sub atât, ziua a fost pentru proprietar.
 *
 * Zilele blocate urcă pragul: cheltuiala rămâne aceeași și se împarte la mai
 * puține zile. Îți iei o săptămână liberă, restul zilelor trebuie să aducă
 * mai mult — exact ce se întâmplă și în realitate.
 */
export function DayThreshold({ monthKey }: { monthKey: string }) {
  const t = useT();
  const { currency } = useApp();
  const costs = useTable("fixed_costs");
  const blocks = useTable("day_blocks");

  const threshold = useMemo(
    () => dayThreshold(costs, blocks, monthKey),
    [costs, blocks, monthKey],
  );

  if (!threshold) return null;

  return (
    <section className="surface space-y-1.5 rounded-2xl p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Target className="size-4 text-primary" /> {t("Pragul zilei")}
      </h3>
      <p className="text-2xl font-bold tabular-nums text-primary">
        {formatMoney(threshold.perDay, currency)}
      </p>
      <p className="text-xs text-muted-foreground">
        Atât trebuie să aducă o zi, curat, doar ca să acoperi{" "}
        {formatMoney(threshold.fixed, currency)} de cheltuieli fixe pe{" "}
        {threshold.days} {threshold.days === 1 ? "zi lucrătoare" : "zile lucrătoare"}
        {threshold.blocked > 0
          ? ` — ${threshold.blocked} ${
              threshold.blocked === 1 ? "zi blocată" : "zile blocate"
            } sunt scoase din socoteală.`
          : "."}
      </p>
    </section>
  );
}
