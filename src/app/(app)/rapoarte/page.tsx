"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Clock, Hammer, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { useMinuteTick, useStoreReady, useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import {
  buildConsumption,
  buildJobRows,
  byClient,
  byType,
  consumptionByType,
  totals,
  UNIT_LABELS,
} from "@/lib/reports";
import {
  CLIENT_SOURCE_LABELS,
  JOB_TYPE_EMOJI,
  JOB_TYPE_LABELS,
} from "@/lib/constants";
import { topReferrers, totalsBySource } from "@/lib/sources";
import { QuoteReport } from "@/components/reports/quote-report";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Period = "3" | "12" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "3": "3 luni",
  "12": "12 luni",
  all: "Tot",
};

export default function ReportsPage() {
  const ready = useStoreReady();
  const { currency } = useApp();
  const now = useMinuteTick();
  const jobs = useTable("jobs");
  const materials = useTable("job_materials");
  const expenses = useTable("expenses");
  const sessions = useTable("work_sessions");
  const measurements = useTable("job_measurements");
  const clients = useTable("clients");

  const payments = useTable("payments");

  const [period, setPeriod] = useState<Period>("12");

  /*
   * „De unde vine treaba" nu ține de perioada aleasă mai sus: un om care te-a
   * recomandat acum doi ani îți aduce clienți și azi, iar tăiat la douăsprezece
   * luni răspunsul ar fi altul în fiecare lună.
   */
  const sourceRows = useMemo(
    () =>
      totalsBySource(clients, jobs, payments).filter(
        (row) => row.earned > 0 || row.jobs > 0,
      ),
    [clients, jobs, payments],
  );
  const referrers = useMemo(
    () => topReferrers(clients, jobs, payments),
    [clients, jobs, payments],
  );

  /*
   * Aceeași tăietură pentru tot ce se uită în urmă pe pagina asta: dacă
   * lucrările sunt pe douăsprezece luni, ofertele n-au voie să fie pe tot.
   */
  const cutoff = useMemo(
    () =>
      period === "all"
        ? ""
        : new Date(now - Number(period) * 30 * 86_400_000)
            .toISOString()
            .slice(0, 10),
    [period, now],
  );

  const report = useMemo(() => {
    const rows = buildJobRows({
      jobs,
      materials,
      expenses,
      sessions,
      measurements,
      now,
    }).filter((row) => {
      if (!cutoff) return true;
      const date =
        row.job.end_date ??
        row.job.start_date ??
        row.job.scheduled_date ??
        row.job.created_at;
      return date.slice(0, 10) >= cutoff;
    });

    // Consumul se judecă pe aceleași lucrări ca restul raportului.
    const consumption = consumptionByType(
      buildConsumption({
        jobs: rows.map((row) => row.job),
        materials,
        measurements,
      }),
    );

    return {
      rows,
      sum: totals(rows),
      types: byType(rows),
      clients: byClient(rows),
      consumption,
    };
  }, [cutoff, now, jobs, materials, expenses, sessions, measurements]);

  const clientName = (id: string | null) =>
    id
      ? (clients.find((client) => client.id === id)?.name ?? "Client șters")
      : "Fără client";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rapoarte"
        description="Ce tip de lucrare aduce bani și de la cine vin"
      />

      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={(["3", "12", "all"] as Period[]).map((value) => ({
          value,
          label: PERIOD_LABELS[value],
        }))}
      />

      {/*
        * Ofertele nu stau după lucrări: cine trimite zece oferte și le pierde
        * pe toate n-are nicio lucrare terminată, și tocmai atunci are cel mai
        * mult nevoie să vadă de ce.
        */}
      {ready && <QuoteReport from={cutoff || undefined} />}

      {!ready ? (
        <Skeleton className="h-48 w-full" />
      ) : report.rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Încă nicio lucrare finalizată"
          description="Rapoartele se fac din lucrările terminate: o lucrare în curs n-are încă toate cheltuielile."
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard
              label="Lucrări finalizate"
              value={String(report.sum.jobs)}
              icon={Hammer}
              tone="primary"
            />
            <StatCard
              label="Valoare lucrări"
              value={formatMoney(report.sum.price, currency, { compact: true })}
              icon={Wallet}
              tone="secondary"
            />
            <StatCard
              label="Profit"
              value={formatMoney(report.sum.profit, currency, { compact: true })}
              icon={TrendingUp}
              tone={report.sum.profit >= 0 ? "success" : "danger"}
            />
            <StatCard
              label="Câștig pe oră"
              value={
                report.sum.perHour === null
                  ? "—"
                  : formatMoney(report.sum.perHour, currency, { compact: true })
              }
              icon={Clock}
              hint={
                report.sum.hours >= 0.25
                  ? `${formatNumber(report.sum.hours)} ore`
                  : "fără ore cronometrate"
              }
            />
          </section>

          <section className="space-y-2.5">
            <h2 className="text-sm font-semibold">Pe tip de lucrare</h2>
            {report.types.map((row) => (
              <article
                key={row.kind}
                className="space-y-3 rounded-2xl surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="text-xl">{JOB_TYPE_EMOJI[row.kind]}</span>
                    {JOB_TYPE_LABELS[row.kind]}
                    <span className="text-xs font-normal text-muted-foreground">
                      {row.jobs} {row.jobs === 1 ? "lucrare" : "lucrări"}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      row.profit >= 0 ? "text-emerald-300" : "text-red-300",
                    )}
                  >
                    {formatMoney(row.profit, currency)}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Valoare</dt>
                    <dd className="font-medium tabular-nums">
                      {formatMoney(row.price, currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Marjă</dt>
                    <dd className="font-medium tabular-nums">
                      {formatPercent(row.margin)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Pe oră</dt>
                    <dd className="font-medium tabular-nums">
                      {row.perHour === null
                        ? "—"
                        : formatMoney(row.perHour, currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {UNIT_LABELS[row.kind]
                        ? `Preț pe ${UNIT_LABELS[row.kind]}`
                        : "Preț pe unitate"}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {row.pricePerUnit === null
                        ? "—"
                        : formatMoney(row.pricePerUnit, currency)}
                    </dd>
                  </div>
                </dl>

                {row.pricePerUnit !== null && (
                  <p className="text-[11px] text-muted-foreground/70">
                    media e calculată doar din lucrările care au măsurători
                    ({formatNumber(row.units)} {UNIT_LABELS[row.kind] || "unități"})
                  </p>
                )}
              </article>
            ))}
          </section>

          {report.consumption.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-sm font-semibold">Consum față de estimat</h2>
              <p className="text-xs text-muted-foreground">
                Cât ai măsurat și cât a intrat efectiv. Diferența e tăiată
                greșit, spart la montaj sau „mai luăm doi metri, să fie”.
              </p>
              <div className="divide-y divide-border overflow-hidden rounded-2xl surface">
                {report.consumption.map((row) => (
                  <div
                    key={row.kind}
                    className="flex items-center justify-between gap-3 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {JOB_TYPE_EMOJI[row.kind]} {JOB_TYPE_LABELS[row.kind]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        estimat {formatNumber(row.planned)} {row.unit} · consumat{" "}
                        {formatNumber(row.used)} {row.unit} · {row.jobs} lucrări
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 font-bold tabular-nums",
                        (row.extraPercent ?? 0) > 0
                          ? "text-amber-300"
                          : "text-emerald-300",
                      )}
                    >
                      {(row.extraPercent ?? 0) > 0 ? "+" : ""}
                      {formatNumber(row.extraPercent ?? 0, 1)}%
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2.5">
            <h2 className="text-sm font-semibold">Clienți</h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl surface">
              {report.clients.slice(0, 10).map((row) => (
                <div
                  key={row.clientId ?? "none"}
                  className="flex items-center justify-between gap-3 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {clientName(row.clientId)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.jobs} {row.jobs === 1 ? "lucrare" : "lucrări"} · profit{" "}
                      {formatMoney(row.profit, currency)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(row.price, currency)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/*
            * De unde vine treaba. Apare doar după ce s-a notat măcar o sursă:
            * un tabel plin de „nu știu” n-ar spune nimic nimănui.
            */}
          {sourceRows.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-sm font-semibold">De unde vine treaba</h2>
              <div className="divide-y divide-border overflow-hidden rounded-2xl surface">
                {sourceRows.map((row) => (
                  <div
                    key={row.source}
                    className="flex items-center justify-between gap-3 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {row.source === "unknown"
                          ? "Nu s-a notat"
                          : CLIENT_SOURCE_LABELS[row.source]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.clients} {row.clients === 1 ? "client" : "clienți"} ·{" "}
                        {row.jobs} {row.jobs === 1 ? "lucrare" : "lucrări"}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">
                      {formatMoney(row.earned, currency)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {referrers.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-sm font-semibold">Cine te recomandă</h2>
              <p className="text-xs text-muted-foreground">
                Banii sunt cei aduși de oamenii pe care i-au trimis, nu cei
                plătiți de ei.
              </p>
              <div className="divide-y divide-border overflow-hidden rounded-2xl surface">
                {referrers.slice(0, 10).map((row) => (
                  <Link
                    key={row.client_id}
                    href={`/clienti/${row.client_id}`}
                    className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        a trimis {row.sent}{" "}
                        {row.sent === 1 ? "client" : "clienți"}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">
                      {formatMoney(row.earned, currency)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
