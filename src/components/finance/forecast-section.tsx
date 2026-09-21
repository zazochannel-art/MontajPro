"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { buildForecast, type ForecastWeek } from "@/lib/forecast";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Un rând pe săptămână, cu banii care intră și cei care ies. */
function WeekRow({
  week,
  scale,
  currency,
}: {
  week: ForecastWeek;
  scale: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const entries = [...week.incoming, ...week.outgoing];
  const width = (value: number) => `${scale ? Math.max(0, (value / scale) * 100) : 0}%`;

  return (
    <li className="rounded-xl surface/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={!entries.length}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
      >
        <span className="w-24 shrink-0 text-xs text-muted-foreground">{week.label}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-emerald-400"
              style={{ width: width(week.income) }}
            />
          </span>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-red-400"
              style={{ width: width(week.expense) }}
            />
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block text-sm font-semibold tabular-nums",
              week.net >= 0 ? "text-emerald-300" : "text-red-300",
            )}
          >
            {week.net >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(week.net), currency, { compact: true })}
          </span>
          <span
            className={cn(
              "block text-[11px] tabular-nums",
              week.cumulative >= 0 ? "text-muted-foreground" : "text-red-300",
            )}
          >
            cumulat {formatMoney(week.cumulative, currency, { compact: true })}
          </span>
        </span>
        {entries.length > 0 && (
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {open && entries.length > 0 && (
        <ul className="space-y-1 border-t border-border px-3 py-2">
          {entries.map((entry) => {
            const money = formatMoney(entry.amount, currency);
            const incoming = entry.kind === "installment" || entry.kind === "job_rest";
            const row = (
              <>
                <span className="min-w-0 flex-1 truncate">
                  {entry.label}
                  {entry.overdue && (
                    <span className="ml-1.5 text-amber-300">restanță</span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    incoming ? "text-emerald-300" : "text-red-300",
                  )}
                >
                  {incoming ? "+" : "−"}
                  {money}
                </span>
              </>
            );
            return (
              <li key={entry.id} className="text-xs">
                {entry.job_id ? (
                  <Link
                    href={`/lucrari/${entry.job_id}`}
                    className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/60"
                  >
                    {row}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 px-1 py-1">{row}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/**
 * Prognoza: ce intră și ce iese în următoarele patru săptămâni.
 *
 * Restul paginii se uită la o lună care s-a consumat deja. Asta e singura
 * bucată care răspunde la întrebarea de care atârnă lunile grele — îmi ajung
 * banii până la următoarea încasare? — și o face fără să inventeze nimic:
 * doar bani cu termen și cheltuieli cunoscute.
 */
export function ForecastSection() {
  const { currency } = useApp();
  const jobs = useAllJobs();
  const payments = useTable("payments");
  const installments = useTable("installments");
  const fixedCosts = useTable("fixed_costs");
  const materials = useTable("job_materials");

  const forecast = useMemo(
    () => buildForecast({ jobs, payments, installments, fixedCosts, materials }),
    [jobs, payments, installments, fixedCosts, materials],
  );

  const scale = Math.max(
    1,
    ...forecast.weeks.map((week) => Math.max(week.income, week.expense)),
  );
  const empty = forecast.income === 0 && forecast.expense === 0;

  return (
    <section className="space-y-3 rounded-2xl surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Următoarele 4 săptămâni</h3>
          <p className="text-xs text-muted-foreground">
            Doar bani cu termen și cheltuieli cunoscute.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-right text-lg font-bold tabular-nums",
            forecast.net >= 0 ? "text-emerald-300" : "text-red-300",
          )}
        >
          {forecast.net >= 0 ? "+" : "−"}
          {formatMoney(Math.abs(forecast.net), currency, { compact: true })}
        </span>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">
          Nimic cu termen în perioada asta. Pune o dată pe lucrări sau un
          scadențar, ca să vezi când intră banii.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <TrendingUp className="size-3.5" /> intră{" "}
              {formatMoney(forecast.income, currency)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <TrendingDown className="size-3.5" /> ies{" "}
              {formatMoney(forecast.expense, currency)}
            </span>
            {forecast.overdue > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="size-3.5" /> restanțe{" "}
                {formatMoney(forecast.overdue, currency)}
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {forecast.weeks.map((week) => (
              <WeekRow
                key={week.start}
                week={week}
                scale={scale}
                currency={currency}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
