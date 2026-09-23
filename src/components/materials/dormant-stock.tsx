"use client";

import { useMemo } from "react";
import { Moon } from "lucide-react";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { dormantStock } from "@/lib/dormant";
import { formatMoney, formatNumber, todayKey } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { useT } from "@/hooks/use-t";

/**
 * Materialul care doarme pe raft.
 *
 * „Pune restul în stoc” există tocmai ca să nu cumperi din nou ce ai deja în
 * pod. Dar nimic nu se uita înapoi: parchetul pus acolo acum opt luni, pe care
 * nicio lucrare nu l-a mai atins, sunt bani care stau. Nu e o pierdere — e o
 * listă cu ce poți da mai ieftin la următoarea ofertă.
 */
export function DormantStock() {
  const t = useT();
  const { currency } = useApp();
  const stock = useTable("materials");
  const used = useTable("job_materials");
  const jobs = useAllJobs();
  const today = todayKey();

  const dormant = useMemo(
    () => dormantStock(stock, used, jobs, today),
    [stock, used, jobs, today],
  );

  if (!dormant.lines.length) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Moon className="size-4 text-primary" /> {t("Stă pe raft de mult")}
        </h2>
        <p className="text-sm font-semibold tabular-nums text-amber-300">
          {formatMoney(dormant.total, currency)}
        </p>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl surface">
        {dormant.lines.slice(0, 8).map((line) => (
          <li
            key={line.material.id}
            className="flex items-center justify-between gap-3 p-3.5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{line.material.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatNumber(line.material.quantity)} {line.material.unit} ·{" "}
                {line.never
                  ? "niciodată folosit"
                  : `neatins de ${line.months} luni`}
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatMoney(line.value, currency)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
