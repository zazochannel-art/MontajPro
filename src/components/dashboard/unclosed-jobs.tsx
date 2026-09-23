"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, PackageCheck } from "lucide-react";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { openClosings } from "@/lib/closing";
import { formatMoney, todayKey } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { useT } from "@/hooks/use-t";
import { JOB_TYPE_EMOJI } from "@/lib/constants";

/** Câte lucrări se arată înainte de „vezi tot”. */
const SHOWN = 3;

/**
 * Ce-ai lăsat neînchis, pe toate lucrările.
 *
 * Lista de plecare de pe șantier se vedea doar intrând în lucrare — adică
 * exact când erai deja acolo și îți aminteai singur. Aceeași problemă pe care
 * o avea checklistul înainte să existe „De terminat”: dimineața, întrebarea e
 * ce-a rămas atârnat peste tot, nu ce-a rămas la lucrarea asta.
 *
 * Fiecare rând duce direct unde se rezolvă, fiindcă lucrurile astea nu se
 * bifează — se fac: o poză, o semnătură, niște bani.
 */
export function UnclosedJobs() {
  const t = useT();
  const { currency } = useApp();
  const jobs = useAllJobs();
  const photos = useTable("job_photos");
  const handovers = useTable("handovers");
  const payments = useTable("payments");
  const [all, setAll] = useState(false);
  // Ziua intră în dependențe: altfel socoteala rămâne a zilei de ieri până
  // se schimbă altceva pe ecran.
  const today = todayKey();

  const open = useMemo(
    () => openClosings({ jobs, photos, handovers, payments, today }),
    [jobs, photos, handovers, payments, today],
  );
  if (!open.length) return null;

  const shown = all ? open : open.slice(0, SHOWN);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <PackageCheck className="size-5 text-primary" /> {t("Rămase neînchise")}
        </h3>
        <span className="text-sm text-muted-foreground">
          {open.length} {open.length === 1 ? "lucrare" : "lucrări"}
        </span>
      </div>

      <div className="space-y-2.5">
        {shown.map(({ job, items, rest }) => (
          <div key={job.id} className="space-y-2 rounded-2xl surface p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/lucrari/${job.id}`}
                className="min-w-0 truncate text-sm font-medium hover:underline"
              >
                {JOB_TYPE_EMOJI[job.type]} {job.title}
              </Link>
              {rest > 0 && (
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-amber-300">
                  {formatMoney(rest, currency, { compact: true })}
                </span>
              )}
            </div>

            <ul className="space-y-1.5">
              {items.map((item) =>
                item.href ? (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      • {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={item.key} className="text-sm text-muted-foreground">
                    • {item.label}
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      {open.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((value) => !value)}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {all ? "Arată mai puțin" : `Încă ${open.length - SHOWN} lucrări`}
          <ChevronDown
            className={`size-4 transition-transform duration-[--dur-2] ${all ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}
