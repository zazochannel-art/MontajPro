"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Hourglass } from "lucide-react";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { AGE_LABELS, aging, type AgeBand } from "@/lib/aging";
import { formatMoney, todayKey } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";

/** Cu cât mai veche, cu atât mai tare: culoarea spune pe cine suni azi. */
const BAND_TONE: Record<AgeBand, string> = {
  proaspat: "text-muted-foreground",
  intarziat: "text-amber-300",
  vechi: "text-red-300",
};

const BAND_ORDER: AgeBand[] = ["vechi", "intarziat", "proaspat"];

/**
 * Restanțele, pe vechime.
 *
 * Restul de încasat era un singur număr, iar notificarea „Plată restantă” se
 * aprinde în ziua în care marchezi lucrarea finalizată și nu se mai stinge
 * niciodată. Dar 2.000 de lei de acum trei zile și 2.000 de acum patru luni
 * sunt două lucruri diferite: unul e cum merge treaba, celălalt e un om pe
 * care trebuie să-l suni azi.
 */
export function AgingCard() {
  const t = useT();
  const { currency } = useApp();
  const jobs = useAllJobs();
  const payments = useTable("payments");
  const clients = useTable("clients");

  const result = useMemo(
    () => aging(jobs, payments, todayKey()),
    [jobs, payments],
  );

  if (!result.rows.length) return null;

  const clientName = (id: string | null) =>
    clients.find((client) => client.id === id)?.name ?? "Fără client";

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Hourglass className="size-4 text-primary" /> {t("De încasat, pe vechime")}
        </h2>
        <p className="text-sm font-semibold tabular-nums">
          {formatMoney(result.total, currency)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {BAND_ORDER.map((band) => (
          <div key={band} className="rounded-2xl surface p-3">
            <p className="text-[11px] text-muted-foreground">
              {AGE_LABELS[band]}
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                result.byBand[band] > 0 ? BAND_TONE[band] : "text-muted-foreground/50",
              )}
            >
              {formatMoney(result.byBand[band], currency, { compact: true })}
            </p>
          </div>
        ))}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl surface">
        {result.rows.slice(0, 6).map((row) => (
          <li key={row.job.id}>
            <Link
              href={`/lucrari/${row.job.id}?tab=finante`}
              className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{row.job.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {clientName(row.job.client_id)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">
                  {formatMoney(row.rest, currency)}
                </p>
                <p className={cn("text-xs tabular-nums", BAND_TONE[row.band])}>
                  {row.days === 0 ? "de azi" : `de ${row.days} zile`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {result.rows.length > 6 && (
        <p className="text-xs text-muted-foreground">
          Și încă {result.rows.length - 6}, mai noi.
        </p>
      )}
    </section>
  );
}
