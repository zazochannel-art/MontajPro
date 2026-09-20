"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileCheck, PenLine } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreReady, useTable } from "@/hooks/use-data";
import { formatDate } from "@/lib/format";

/**
 * Toate procesele-verbale, într-un loc.
 *
 * Până acum se ajungea la ele doar din lucrare — ceea ce merge o săptămână și
 * nu mai merge deloc peste un an, când îți cere cineva hârtia.
 */
export default function HandoversPage() {
  const ready = useStoreReady();
  const handovers = useTable("handovers");
  const jobs = useTable("jobs");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...handovers]
      .filter((row) => {
        if (!needle) return true;
        const job = jobs.find((item) => item.id === row.job_id);
        return [row.client_name, row.work_summary, job?.title, String(row.number)]
          .some((value) => (value ?? "").toLowerCase().includes(needle));
      })
      .sort((a, b) => b.handed_at.localeCompare(a.handed_at));
  }, [handovers, jobs, query]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Procese-verbale"
        description="Hârtiile de predare, cu semnătura clientului"
      />

      {handovers.length > 0 && (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Caută după client, lucrare sau număr"
          aria-label="Caută proces-verbal"
        />
      )}

      {!ready ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((row) => {
            const job = jobs.find((item) => item.id === row.job_id);
            return (
              <Link
                key={row.id}
                href={`/predare/${row.id}`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    nr. {row.number} — {row.client_name || "fără client"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {job?.title ?? "Lucrare ștearsă"} · {formatDate(row.handed_at)}
                    {row.warranty_months
                      ? ` · garanție ${row.warranty_months} luni`
                      : ""}
                  </p>
                </div>
                {row.signed_at ? (
                  <Badge variant="success">Semnat</Badge>
                ) : (
                  <Badge variant="warning">
                    <PenLine className="size-3" /> Nesemnat
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FileCheck}
          title={query ? "Niciun rezultat" : "Niciun proces-verbal"}
          description={
            query
              ? "Încearcă alt cuvânt."
              : "Se fac din fila Finanțe a unei lucrări, când o predai clientului."
          }
        />
      )}
    </div>
  );
}
