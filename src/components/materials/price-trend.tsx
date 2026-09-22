"use client";

import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTable } from "@/hooks/use-data";
import { priceTrend } from "@/lib/material-price";
import { formatDateShort, formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";

/**
 * Cât ai plătit pe materialul ăsta, de-a lungul timpului.
 *
 * Prețul se uită între două lucrări, iar furnizorul se bazează pe asta.
 * Istoricul era deja în bază — fiecare linie de material ține prețul și data
 * ei —, doar că nu-l citea nimeni.
 *
 * Nu apare la un singur preț: un preț nu s-a schimbat față de nimic.
 */
export function PriceTrend({ materialId }: { materialId: string }) {
  const { currency } = useApp();
  const lines = useTable("job_materials");
  const trend = useMemo(() => priceTrend(lines, materialId), [lines, materialId]);

  if (!trend) return null;

  const tone =
    trend.direction === "sus"
      ? "text-amber-300"
      : trend.direction === "jos"
        ? "text-emerald-300"
        : "text-muted-foreground";

  const last = trend.points[trend.points.length - 1];

  return (
    <p className={`mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] ${tone}`}>
      {trend.direction === "sus" && <TrendingUp className="size-3" />}
      {trend.direction === "jos" && <TrendingDown className="size-3" />}
      <span>
        {trend.direction === "la_fel"
          ? `același preț ca în ${formatDateShort(trend.points[0].day)}`
          : `${trend.change > 0 ? "+" : ""}${trend.change}% față de ${formatDateShort(trend.points[0].day)}`}
      </span>
      <span className="text-muted-foreground">
        ({formatMoney(trend.first, currency)} → {formatMoney(last.price, currency)}
        {trend.best < last.price &&
          `, cel mai ieftin ${formatMoney(trend.best, currency)}`}
        )
      </span>
    </p>
  );
}
