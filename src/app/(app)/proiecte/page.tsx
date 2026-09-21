"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectDialog } from "@/components/forms/project-dialog";
import { useClients, useProjects, useStoreReady, useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { formatMoney } from "@/lib/format";

/** Proiectele: mai multe lucrări sub același acoperiș. */
export default function ProjectsPage() {
  const ready = useStoreReady();
  const projects = useProjects();
  const clients = useClients();
  const jobs = useTable("jobs");
  const payments = useTable("payments");
  const { currency } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects
      .filter(
        (project) =>
          !needle ||
          project.name.toLowerCase().includes(needle) ||
          (project.address ?? "").toLowerCase().includes(needle),
      )
      .map((project) => {
        const own = jobs.filter((job) => job.project_id === project.id);
        const ids = new Set(own.map((job) => job.id));
        const price = own.reduce((acc, job) => acc + job.price_total, 0);
        const paid = payments
          .filter((payment) => payment.job_id && ids.has(payment.job_id))
          .reduce((acc, payment) => acc + payment.amount, 0);
        return {
          project,
          jobs: own.length,
          done: own.filter((job) => job.status === "done").length,
          price,
          rest: price - paid,
          client: clients.find((client) => client.id === project.client_id),
        };
      });
  }, [projects, jobs, payments, clients, query]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Proiecte"
        description="Un bloc, o scară, o casă — lucrările care merg împreună"
        action={
          <Button className="hidden sm:inline-flex" onClick={() => setOpen(true)}>
            <Plus /> Proiect nou
          </Button>
        }
      />

      {projects.length > 4 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută după nume sau adresă"
            className="pl-10"
            type="search"
          />
        </div>
      )}

      {!ready ? (
        <div className="space-y-3">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : rows.length ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.project.id}>
              <Link
                href={`/proiecte/${row.project.id}`}
                className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.project.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.client?.name ?? row.project.address ?? "Fără client"}
                    {row.jobs > 0 && ` · ${row.done}/${row.jobs} gata`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums">
                    {formatMoney(row.price, currency, { compact: true })}
                  </p>
                  {row.rest > 0.5 && (
                    <p className="text-xs text-amber-300">
                      rest {formatMoney(row.rest, currency, { compact: true })}
                    </p>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Building2}
          title={query ? "Niciun proiect găsit" : "Niciun proiect încă"}
          description={
            query
              ? "Încearcă altă căutare."
              : "Când iei o scară de bloc, pune apartamentele sub un proiect: le vezi la un loc și știi cât ai încasat din toată scara."
          }
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus /> Proiect nou
            </Button>
          }
        />
      )}

      <ProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
