"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, FileSpreadsheet, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceDialog } from "@/components/forms/invoice-dialog";
import { useStoreReady, useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { formatDateShort, formatMoney } from "@/lib/format";
import { downloadCsv, invoicesCsv } from "@/lib/export";
import { sum } from "@/lib/utils";

export default function InvoicesPage() {
  const ready = useStoreReady();
  const invoices = useTable("invoices");
  const { currency } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...invoices].sort(
        (a, b) => b.issued_at.localeCompare(a.issued_at) || b.number - a.number,
      ),
    [invoices],
  );

  const unpaid = sum(sorted, (invoice) => (invoice.paid_at ? 0 : invoice.total));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Facturi"
        description={
          unpaid > 0
            ? `${formatMoney(unpaid, currency)} neachitat`
            : "Toate facturile sunt achitate"
        }
        action={
          <Button className="hidden sm:inline-flex" onClick={() => setDialogOpen(true)}>
            <Plus /> Factură nouă
          </Button>
        }
      />

      {sorted.length > 0 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            downloadCsv(
              `facturi-${new Date().getFullYear()}.csv`,
              invoicesCsv(sorted, currency),
            );
            toast.success("Export descărcat");
          }}
        >
          <FileSpreadsheet /> Export CSV pentru contabilitate
        </Button>
      )}

      {!ready ? (
        <Skeleton className="h-48 w-full" />
      ) : sorted.length ? (
        <ul className="space-y-2">
          {sorted.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/facturi/${invoice.id}`}
                className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  <ReceiptText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {invoice.series} {invoice.number}
                    </span>
                    {invoice.paid_at ? (
                      <Badge variant="success">Achitată</Badge>
                    ) : (
                      <Badge variant="warning">Neachitată</Badge>
                    )}
                  </div>
                  <p className="truncate font-medium">{invoice.client_name ?? "Fără client"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(invoice.issued_at)}
                    {invoice.due_at && ` · scadentă ${formatDateShort(invoice.due_at)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums">
                    {formatMoney(invoice.total, currency, { compact: true })}
                  </p>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Download}
          title="Nicio factură"
          description="Fă o factură dintr-o lucrare finalizată sau adaugă una manual."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> Factură nouă
            </Button>
          }
        />
      )}

      <Button
        variant="outline"
        className="w-full sm:hidden"
        size="lg"
        onClick={() => setDialogOpen(true)}
      >
        <Plus /> Factură nouă
      </Button>

      <InvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
