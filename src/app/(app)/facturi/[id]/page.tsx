"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { Check, Hammer, Pencil, Printer, Share2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfButton } from "@/components/ui/pdf-button";
import { pdfFileName } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";
import { Confirm } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceDialog } from "@/components/forms/invoice-dialog";
import { useRow, useStoreReady } from "@/hooks/use-data";
import { deleteInvoice, setInvoicePaid } from "@/lib/db/actions";
import { useApp } from "@/lib/app-provider";
import { formatDate, formatMoney, todayKey } from "@/lib/format";

/** Factura, în forma în care se printează sau se trimite clientului. */
export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const ready = useStoreReady();
  const { currency, settings } = useApp();
  const invoice = useRow("invoices", id);
  const [editOpen, setEditOpen] = useState(false);

  if (!ready) return <Skeleton className="h-96 w-full" />;
  if (!invoice) notFound();

  const vatValue = Math.round((invoice.total - invoice.subtotal) * 100) / 100;

  const share = async () => {
    const lines = [
      `FACTURĂ ${invoice.series} ${invoice.number}`,
      `Data: ${formatDate(invoice.issued_at)}`,
      invoice.client_name ? `Client: ${invoice.client_name}` : null,
      "",
      `Subtotal: ${formatMoney(invoice.subtotal, currency)}`,
      invoice.vat_percent > 0
        ? `TVA ${invoice.vat_percent}%: ${formatMoney(vatValue, currency)}`
        : null,
      `TOTAL: ${formatMoney(invoice.total, currency)}`,
      invoice.due_at ? `Scadență: ${formatDate(invoice.due_at)}` : null,
      invoice.notes ? `\n${invoice.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Factură", text: lines });
      else {
        await navigator.clipboard.writeText(lines);
        toast.success("Factură copiată");
      }
    } catch {
      // Partajare anulată.
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        {invoice.paid_at ? (
          <Badge variant="success">Achitată {formatDate(invoice.paid_at)}</Badge>
        ) : (
          <Badge variant="warning">Neachitată</Badge>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={share}>
          <Share2 /> Trimite
        </Button>
        <PdfButton targetId="document" filename={pdfFileName(["factura", invoice.series, invoice.number])} />
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer /> Printează
        </Button>
      </div>

      <article
        id="document"
        className="print-surface space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              FACTURĂ {invoice.series} {invoice.number}
            </h2>
            <p className="text-sm text-muted-foreground">
              Emisă: {formatDate(invoice.issued_at)}
            </p>
            {invoice.due_at && (
              <p className="text-sm text-muted-foreground">
                Scadență: {formatDate(invoice.due_at)}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">
              {settings?.company || settings?.full_name || "MontajPro"}
            </p>
            {settings?.phone && <p className="text-muted-foreground">{settings.phone}</p>}
            {settings?.email && <p className="text-muted-foreground">{settings.email}</p>}
          </div>
        </header>

        <div className="grid gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Client: </span>
            <span className="font-medium">{invoice.client_name ?? "—"}</span>
          </p>
          {invoice.client_address && (
            <p>
              <span className="text-muted-foreground">Adresă: </span>
              {invoice.client_address}
            </p>
          )}
          {invoice.client_phone && (
            <p>
              <span className="text-muted-foreground">Telefon: </span>
              {invoice.client_phone}
            </p>
          )}
        </div>

        <dl className="space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(invoice.subtotal, currency)}</dd>
          </div>
          {invoice.vat_percent > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">TVA {invoice.vat_percent}%</dt>
              <dd className="tabular-nums">{formatMoney(vatValue, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
            <dt>TOTAL</dt>
            <dd className="tabular-nums">{formatMoney(invoice.total, currency)}</dd>
          </div>
        </dl>

        {invoice.notes && (
          <p className="whitespace-pre-wrap border-t border-border pt-4 text-sm text-muted-foreground">
            {invoice.notes}
          </p>
        )}
      </article>

      <div className="no-print space-y-2">
        {invoice.paid_at ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await setInvoicePaid(invoice.id, null);
              toast.success("Marcată ca neachitată");
            }}
          >
            <Undo2 /> Marchează neachitată
          </Button>
        ) : (
          <Button
            variant="success"
            className="w-full"
            size="lg"
            onClick={async () => {
              await setInvoicePaid(invoice.id, todayKey());
              toast.success("Factură achitată");
            }}
          >
            <Check /> Marchează achitată
          </Button>
        )}

        {invoice.job_id && (
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/lucrari/${invoice.job_id}`}>
              <Hammer /> Vezi lucrarea
            </Link>
          </Button>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setEditOpen(true)}>
            <Pencil /> Editează
          </Button>
          <Confirm
            title="Ștergi factura?"
            onConfirm={async () => {
              await deleteInvoice(invoice.id);
              toast.success("Factură ștearsă");
              router.replace("/facturi");
            }}
          >
            <Button variant="outline" className="text-red-400 hover:text-red-300">
              <Trash2 /> Șterge
            </Button>
          </Confirm>
        </div>
      </div>

      <InvoiceDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} />
    </div>
  );
}
