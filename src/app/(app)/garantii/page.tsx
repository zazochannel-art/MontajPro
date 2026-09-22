"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/lib/app-provider";
import { useAllJobs, useStoreReady, useTable } from "@/hooks/use-data";
import { formatDateShort, formatMoney } from "@/lib/format";
import { searchWarranties, warrantyCost, warrantyRows } from "@/lib/warranty";
import type { WarrantyRow, WarrantyState } from "@/lib/warranty";

type Filter = WarrantyState | "all";

/**
 * Ce mai e în garanție.
 *
 * Ecranul ăsta se deschide cu clientul la telefon: întrebarea e „merg pe banii
 * mei sau pe ai lui?”, iar răspunsul trebuie găsit din două atingeri. De aceea
 * căutarea e prima, nu ultima, și merge și după număr de telefon.
 */
export default function WarrantiesPage() {
  const ready = useStoreReady();
  const { currency } = useApp();
  const handovers = useTable("handovers");
  const jobs = useAllJobs();
  const clients = useTable("clients");

  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => warrantyRows(handovers, jobs, clients),
    [handovers, jobs, clients],
  );
  const cost = useMemo(() => warrantyCost(jobs), [jobs]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((row) => row.state === "active").length,
      expiring: rows.filter((row) => row.state === "expiring").length,
      expired: rows.filter((row) => row.state === "expired").length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const byState =
      filter === "all" ? rows : rows.filter((row) => row.state === filter);
    return searchWarranties(byState, query);
  }, [rows, filter, query]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Garanții"
        description={
          counts.active + counts.expiring
            ? `${counts.active + counts.expiring} lucrări încă acoperite`
            : "Lucrările predate, cu termenul lor"
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nume, telefon sau lucrare"
          className="pl-10"
          type="search"
        />
      </div>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "active", label: "În garanție", count: counts.active },
          { value: "expiring", label: "Expiră curând", count: counts.expiring },
          { value: "expired", label: "Expirate", count: counts.expired },
          { value: "all", label: "Toate", count: counts.all },
        ]}
      />

      {cost.visits > 0 && (
        <div className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reveniri
          </p>
          <p className="mt-1 text-sm">
            {cost.visits} {cost.visits === 1 ? "revenire" : "reveniri"} la
            lucrări vechi, din care{" "}
            <span className="font-semibold text-amber-300">
              {cost.free} pe banii tăi
            </span>
            {cost.earned > 0 && (
              <>
                {" "}
                și{" "}
                <span className="font-semibold text-emerald-300">
                  {formatMoney(cost.earned, currency)} încasați
                </span>
              </>
            )}
            .
          </p>
        </div>
      )}

      {!ready ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="stagger space-y-3">
          {filtered.map((row) => (
            <WarrantyCard key={row.handover_id} row={row} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={query ? "Nimic găsit" : "Nicio garanție aici"}
          description={
            query
              ? "Încearcă alt nume sau alt număr de telefon."
              : "Garanția se pune pe procesul-verbal de predare. Lucrările predate cu un termen apar aici."
          }
        />
      )}
    </div>
  );
}

function WarrantyCard({ row }: { row: WarrantyRow }) {
  const tone =
    row.state === "expired"
      ? { bar: "bg-zinc-600", text: "text-muted-foreground" }
      : row.state === "expiring"
        ? { bar: "bg-amber-500", text: "text-amber-300" }
        : { bar: "bg-emerald-500", text: "text-emerald-300" };

  const days =
    row.state === "expired"
      ? `a expirat acum ${Math.abs(row.days_left)} zile`
      : row.days_left === 0
        ? "expiră azi"
        : `mai sunt ${row.days_left} zile`;

  return (
    <Link
      href={`/lucrari/${row.job_id}`}
      className="card-hover surface relative block overflow-hidden rounded-2xl p-4 pl-5"
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.client_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.job_title}
          </p>
        </div>
        {row.client_phone && (
          <a
            href={`tel:${row.client_phone}`}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Sună pe ${row.client_name}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone className="size-4" />
          </a>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Predată</p>
          <p className="font-medium tabular-nums">
            {formatDateShort(row.handed_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Garanție până la</p>
          <p className={`font-semibold tabular-nums ${tone.text}`}>
            {formatDateShort(row.ends_on)} · {days}
          </p>
        </div>
      </div>
    </Link>
  );
}
