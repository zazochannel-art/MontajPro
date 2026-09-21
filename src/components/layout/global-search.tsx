"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileCheck,
  FileText,
  Hammer,
  Package,
  ReceiptText,
  Ruler,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTable } from "@/hooks/use-data";
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from "@/lib/constants";
import { formatDateShort, formatMoney, formatQuoteNumber } from "@/lib/format";
import { useApp } from "@/lib/app-provider";

interface Hit {
  id: string;
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  group: string;
}

const MAX_PER_GROUP = 5;

/**
 * Căutare peste tot dintr-un singur loc.
 *
 * Caută în memorie, deci merge și offline și răspunde instant — la câteva sute
 * de lucrări nu are rost nimic mai complicat.
 */
export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { currency } = useApp();
  const [query, setQuery] = useState("");

  const clients = useTable("clients");
  const projects = useTable("projects");
  const jobs = useTable("jobs");
  const quotes = useTable("quotes");
  const invoices = useTable("invoices");
  const materials = useTable("materials");
  const tools = useTable("tools");
  const measurements = useTable("job_measurements");
  const handovers = useTable("handovers");

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [] as Hit[];
    const has = (...values: (string | null | undefined)[]) =>
      values.some((value) => (value ?? "").toLowerCase().includes(needle));

    const result: Hit[] = [];

    for (const client of clients) {
      if (!has(client.name, client.phone, client.address, client.email)) continue;
      result.push({
        id: client.id,
        href: `/clienti/${client.id}`,
        icon: Users,
        title: client.name,
        subtitle: [client.phone, client.address].filter(Boolean).join(" · ") || "Client",
        group: "Clienți",
      });
      if (result.length > 60) break;
    }

    for (const project of projects) {
      if (!has(project.name, project.address, project.notes)) continue;
      result.push({
        id: project.id,
        href: `/proiecte/${project.id}`,
        icon: Building2,
        title: project.name,
        subtitle: project.address || "Proiect",
        group: "Proiecte",
      });
      if (result.length > 60) break;
    }

    for (const job of jobs) {
      if (!has(job.title, job.address, job.notes)) continue;
      result.push({
        id: job.id,
        href: `/lucrari/${job.id}`,
        icon: Hammer,
        title: job.title,
        subtitle: `${JOB_TYPE_LABELS[job.type]} · ${JOB_STATUS_LABELS[job.status]} · ${formatMoney(job.price_total, currency, { compact: true })}`,
        group: "Lucrări",
      });
    }

    for (const quote of quotes) {
      if (!has(quote.title, String(quote.number))) continue;
      result.push({
        id: quote.id,
        href: `/oferte/${quote.id}`,
        icon: FileText,
        title: `${formatQuoteNumber(quote.number)} ${quote.title}`,
        subtitle: formatDateShort(quote.created_at),
        group: "Oferte",
      });
    }

    for (const invoice of invoices) {
      if (!has(invoice.client_name, invoice.notes, `${invoice.series}${invoice.number}`))
        continue;
      result.push({
        id: invoice.id,
        href: `/facturi/${invoice.id}`,
        icon: ReceiptText,
        title: `${invoice.series} ${invoice.number} — ${invoice.client_name ?? "fără client"}`,
        subtitle: formatMoney(invoice.total, currency),
        group: "Facturi",
      });
    }

    for (const handover of handovers) {
      if (!has(handover.client_name, handover.work_summary, String(handover.number)))
        continue;
      result.push({
        id: handover.id,
        href: `/predare/${handover.id}`,
        icon: FileCheck,
        title: `Proces-verbal ${handover.number} — ${handover.client_name ?? "fără client"}`,
        subtitle: handover.signed_at
          ? `semnat ${formatDateShort(handover.signed_at)}`
          : "nesemnat",
        group: "Procese-verbale",
      });
    }

    for (const material of materials) {
      if (!has(material.name, material.category, material.supplier)) continue;
      result.push({
        id: material.id,
        href: "/materiale",
        icon: Package,
        title: material.name,
        subtitle: `${material.quantity} ${material.unit}`,
        group: "Materiale",
      });
    }

    for (const tool of tools) {
      if (!has(tool.name, tool.brand, tool.model)) continue;
      result.push({
        id: tool.id,
        href: "/scule",
        icon: Wrench,
        title: tool.name,
        subtitle: [tool.brand, tool.model].filter(Boolean).join(" ") || "Sculă",
        group: "Scule",
      });
    }

    for (const measurement of measurements) {
      if (!has(measurement.label, measurement.notes)) continue;
      result.push({
        id: measurement.id,
        href: measurement.job_id
          ? `/lucrari/${measurement.job_id}?tab=masuratori`
          : "/masuratori",
        icon: Ruler,
        title: measurement.label || "Măsurătoare",
        subtitle: formatDateShort(measurement.created_at),
        group: "Măsurători",
      });
    }

    return result;
  }, [query, clients, projects, jobs, quotes, invoices, materials, tools, measurements, handovers, currency]);

  const grouped = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const hit of hits) {
      const list = map.get(hit.group) ?? [];
      if (list.length < MAX_PER_GROUP) list.push(hit);
      map.set(hit.group, list);
    }
    return [...map.entries()];
  }, [hits]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Căutare</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută client, lucrare, ofertă, material…"
            className="pl-10"
          />
        </div>

        <div className="max-h-[55dvh] space-y-4 overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Scrie cel puțin două litere.
            </p>
          ) : grouped.length ? (
            grouped.map(([group, items]) => (
              <div key={group}>
                <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                <ul className="space-y-1">
                  {items.map((hit) => (
                    <li key={`${group}-${hit.id}`}>
                      <button
                        type="button"
                        onClick={() => go(hit.href)}
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <hit.icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {hit.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {hit.subtitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nimic găsit pentru „{query.trim()}”.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
