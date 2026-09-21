"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, User } from "lucide-react";
import {
  JOB_STATUS_BAR,
  JOB_TYPE_EMOJI,
  JOB_TYPE_LABELS,
} from "@/lib/constants";
import { formatDateShort, formatMoney, relativeDay } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { useT } from "@/hooks/use-t";
import { useClientName, useJobPaymentIndex } from "@/hooks/use-data";
import type { Job } from "@/lib/types";
import { StatusBadge } from "./status-badge";

/**
 * Cardul unei lucrări. Fără tabele pe mobil: tot ce contează (client, preț,
 * rest de plată, status) încape într-un card apăsabil.
 *
 * Dunga de culoare din stânga spune statusul înainte de orice cuvânt, iar
 * restul de plată e scris cel mai apăsat: e singura cifră pentru care omul
 * deschide aplicația a doua oară în aceeași zi.
 */
export function JobCard({ job }: { job: Job }) {
  const { currency, siteMode } = useApp();
  const t = useT();
  const clientName = useClientName(job.client_id);
  const payments = useJobPaymentIndex();
  const money = payments[job.id];
  const day = relativeDay(job.scheduled_date);
  const rest = money?.rest ?? 0;

  return (
    <Link
      href={`/lucrari/${job.id}`}
      className="card-hover surface group relative block overflow-hidden rounded-2xl p-4 pl-5"
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${JOB_STATUS_BAR[job.status]}`}
      />

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-elevated text-xl shadow-[var(--lift)] transition-transform duration-[--dur-2] ease-[--ease-spring] group-active:scale-90">
          {JOB_TYPE_EMOJI[job.type]}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-semibold leading-tight">
              {job.title}
            </p>
            <StatusBadge status={job.status} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {clientName}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {day ?? formatDateShort(job.scheduled_date)}
              {job.scheduled_time && ` · ${job.scheduled_time}`}
            </span>
            {job.address && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{job.address}</span>
              </span>
            )}
          </div>

          {siteMode ? (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {t("Mod șantier")} — {t("prețurile sunt ascunse")}
            </p>
          ) : (
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
              {/*
               * Trei coloane egale, nu un rând care curge: „124.500 MDL” și
               * „0 MDL” trebuie să încapă amândouă pe un telefon îngust, fără
               * ca vreo cifră de bani să ajungă tăiată cu trei puncte.
               */}
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 text-xs">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">
                    {t("Preț")}
                  </p>
                  <p className="truncate font-bold tabular-nums">
                    {formatMoney(job.price_total, currency, { compact: true })}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">
                    {t("Avans")}
                  </p>
                  <p className="truncate font-semibold tabular-nums text-emerald-300">
                    {formatMoney(money?.advance ?? 0, currency, {
                      compact: true,
                    })}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">
                    {t("Rest")}
                  </p>
                  <p
                    className={`truncate font-bold tabular-nums ${
                      rest > 0 ? "text-amber-300" : "text-muted-foreground"
                    }`}
                  >
                    {formatMoney(rest, currency, { compact: true })}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-[--dur-2] ease-[--ease-out] group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          )}
        </div>
      </div>
      <span className="sr-only">{t(JOB_TYPE_LABELS[job.type])}</span>
    </Link>
  );
}
