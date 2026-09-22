"use client";

import Link from "next/link";
import { Check, CircleAlert, DoorOpen } from "lucide-react";
import { useApp } from "@/lib/app-provider";
import { useTable } from "@/hooks/use-data";
import { closingChecklist, closingLeft, quoteDeviation } from "@/lib/closing";
import { formatMoney } from "@/lib/format";
import type { Handover, Job, JobPhoto } from "@/lib/types";

/**
 * Înainte să pleci de pe șantier.
 *
 * Perechea pozei „înainte”, cerută la START. Niciun rând nu ține stare proprie:
 * fiecare se citește din ce există deja — poze, proces-verbal, bani —, deci nu
 * se poate bifa ceva ce nu s-a făcut.
 *
 * Apare doar când lucrarea a pornit: pe una care e încă ofertă n-ai de la ce
 * să pleci.
 */
export function ClosingCard({
  job,
  photos,
  handover,
  rest,
}: {
  job: Job;
  photos: JobPhoto[];
  handover: Handover | null;
  rest: number;
}) {
  const { currency } = useApp();
  const quotes = useTable("quotes");
  const quoteItems = useTable("quote_items");

  const deviation = quoteDeviation(job, quotes, quoteItems);
  const items = closingChecklist({ job, photos, handover, rest });
  const left = closingLeft(items);

  if (job.status === "quote" || job.status === "confirmed") return null;

  return (
    <section className="surface space-y-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <DoorOpen className="size-4 text-primary" /> Înainte să pleci
          </h3>
          <p className="text-xs text-muted-foreground">
            {left
              ? `${left} ${left === 1 ? "lucru rămas" : "lucruri rămase"} — mai ușor acum decât cu un drum înapoi.`
              : "Totul e pus la punct. Poți pleca."}
          </p>
        </div>
        {!left && <Check className="mt-0.5 size-5 shrink-0 text-emerald-400" />}
      </div>

      {/*
        * Abaterea de la ofertă stă aici, nu în finanțe: e o discuție de purtat
        * cu clientul cât ești încă la el, nu după ce ai ajuns acasă.
        */}
      {deviation && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="flex items-start gap-2 text-xs text-amber-200">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Oferta acceptată era {formatMoney(deviation.quoted, currency)}, iar
              lucrarea e acum {formatMoney(deviation.current, currency)} —{" "}
              {deviation.diff > 0 ? "cu " : "mai puțin cu "}
              {formatMoney(Math.abs(deviation.diff), currency)} (
              {deviation.percent > 0 ? "+" : ""}
              {deviation.percent}%). Ai vorbit cu clientul?
            </span>
          </p>
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => {
          const row = (
            <>
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                  item.done
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-elevated text-muted-foreground"
                }`}
              >
                {item.done ? <Check className="size-3" /> : null}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm ${
                    item.done ? "text-muted-foreground line-through" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
                {!item.done && (
                  <span className="block text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                )}
              </span>
            </>
          );

          return (
            <li key={item.key}>
              {item.done || !item.href ? (
                <div className="flex items-start gap-2.5">{row}</div>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-start gap-2.5 rounded-lg transition-colors hover:bg-accent"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
