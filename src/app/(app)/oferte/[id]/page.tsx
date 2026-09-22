"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Hammer,
  Link2,
  Pencil,
  Printer,
  Send,
  Share2,
  Trash2,
  XCircle,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfButton } from "@/components/ui/pdf-button";
import { pdfFileName } from "@/lib/pdf";
import { Confirm } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { useRow, useStoreReady, useTable } from "@/hooks/use-data";
import {
  convertQuoteToJob,
  deleteQuote,
  duplicateQuote,
  ensureQuoteLink,
  quoteTotal,
  markQuoteReminded,
  setQuoteStatus,
} from "@/lib/db/actions";
import { publicQuoteUrl } from "@/lib/supabase/public-quote";
import { RejectDialog } from "@/components/quotes/reject-dialog";
import { ExpiryNotice } from "@/components/quotes/expiry-notice";
import { REJECT_REASON_LABELS, isRejectReason } from "@/lib/quote-stats";
import { reminderText, whatsappHref } from "@/lib/order";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { QUOTE_STATUS_CLASSES, QUOTE_STATUS_LABELS } from "@/lib/constants";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatQuoteNumber,
} from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { cn } from "@/lib/utils";

/** Oferta, în forma în care o vede clientul (și în care se printează). */
export default function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const ready = useStoreReady();
  const [rejectOpen, setRejectOpen] = useState(false);
  const { currency, settings } = useApp();
  const quote = useRow("quotes", id);
  const allItems = useTable("quote_items");
  const client = useRow("clients", quote?.client_id);

  const items = useMemo(
    () =>
      allItems
        .filter((item) => item.quote_id === id)
        .sort((a, b) => a.position - b.position),
    [allItems, id],
  );

  if (!ready) return <Skeleton className="h-96 w-full" />;
  if (!quote) notFound();

  const { subtotal, total } = quoteTotal(items, quote.discount);
  const rest = total - quote.advance;

  /**
   * Trimiterea ofertei ca link: clientul o deschide în browser și o poate
   * accepta cu numele lui. Fără cloud nu există link, deci cade pe text.
   */
  const shareLink = async () => {
    const token = await ensureQuoteLink(quote.id);
    if (!token) return;
    const url = publicQuoteUrl(token);
    const text = `Ofertă ${formatQuoteNumber(quote.number)} — ${quote.title}\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Ofertă ${formatQuoteNumber(quote.number)}`,
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiat");
      }
    } catch {
      // Partajare anulată de utilizator — nu e o eroare.
    }
  };

  const share = async () => {
    const lines = [
      `OFERTĂ ${formatQuoteNumber(quote.number)}`,
      client ? `Client: ${client.name}` : null,
      `Lucrare: ${quote.title}`,
      "",
      ...items.map(
        (item) =>
          `${item.description}: ${formatNumber(item.quantity)} ${item.unit} × ${formatMoney(item.unit_price, currency)} = ${formatMoney(item.quantity * item.unit_price, currency)}`,
      ),
      "",
      `TOTAL: ${formatMoney(total, currency)}`,
      quote.advance ? `AVANS: ${formatMoney(quote.advance, currency)}` : null,
      quote.advance ? `REST: ${formatMoney(rest, currency)}` : null,
      quote.notes ? `\n${quote.notes}` : null,
      settings?.full_name ? `\n${settings.full_name}` : null,
      settings?.phone ?? null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Ofertă ${formatQuoteNumber(quote.number)}`,
          text: lines,
        });
      } else {
        await navigator.clipboard.writeText(lines);
        toast.success("Oferta a fost copiată");
      }
    } catch {
      // Utilizatorul a anulat partajarea — nu e o eroare.
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium",
            QUOTE_STATUS_CLASSES[quote.status],
          )}
        >
          {QUOTE_STATUS_LABELS[quote.status]}
        </span>
        <div className="flex-1" />
        {isSupabaseConfigured ? (
          <Button variant="outline" size="sm" onClick={shareLink}>
            <Link2 /> Trimite link
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={share}>
          <Share2 /> Trimite text
        </Button>
        <PdfButton targetId="document" filename={pdfFileName(["oferta", quote.number, quote.title])} />
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer /> Printează
        </Button>
      </div>

      {/* Documentul propriu-zis */}
      <article
        id="document"
        className="print-surface space-y-5 rounded-2xl surface p-5 sm:p-7"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              OFERTĂ {formatQuoteNumber(quote.number)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(quote.created_at)}
            </p>
            {quote.valid_until && (
              <p className="text-sm text-muted-foreground">
                Valabilă până la {formatDate(quote.valid_until)}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">
              {settings?.company || settings?.full_name || "MontCraft"}
            </p>
            {settings?.phone && (
              <p className="text-muted-foreground">{settings.phone}</p>
            )}
            {settings?.email && (
              <p className="text-muted-foreground">{settings.email}</p>
            )}
          </div>
        </header>

        <div className="grid gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Client: </span>
            <span className="font-medium">{client?.name ?? "—"}</span>
          </p>
          {client?.phone && (
            <p>
              <span className="text-muted-foreground">Telefon: </span>
              {client.phone}
            </p>
          )}
          {client?.address && (
            <p>
              <span className="text-muted-foreground">Adresă: </span>
              {client.address}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Lucrare: </span>
            <span className="font-medium">{quote.title}</span>
          </p>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(item.quantity)} {item.unit} ×{" "}
                  {formatMoney(item.unit_price, currency)}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatMoney(item.quantity * item.unit_price, currency)}
              </p>
            </div>
          ))}
        </div>

        <dl className="space-y-1.5 text-sm">
          {quote.discount > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  {formatMoney(subtotal, currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reducere</dt>
                <dd className="tabular-nums">
                  −{formatMoney(quote.discount, currency)}
                </dd>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
            <dt>TOTAL</dt>
            <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
          </div>
          {quote.advance > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">AVANS</dt>
                <dd className="tabular-nums">
                  {formatMoney(quote.advance, currency)}
                </dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>REST</dt>
                <dd className="tabular-nums">{formatMoney(rest, currency)}</dd>
              </div>
            </>
          )}
        </dl>

        {(quote.notes || settings?.quote_terms) && (
          <div className="border-t border-border pt-4 text-sm text-muted-foreground">
            {quote.notes && (
              <p className="whitespace-pre-wrap">{quote.notes}</p>
            )}
            {settings?.quote_terms && (
              <p className="mt-2 whitespace-pre-wrap">{settings.quote_terms}</p>
            )}
          </div>
        )}

        {quote.status === "sent" && (
          <p className="rounded-xl bg-background p-3 text-center text-sm text-muted-foreground">
            {quote.viewed_at ? (
              <>
                Clientul a deschis oferta
                {(quote.view_count ?? 1) > 1 ? ` de ${quote.view_count} ori` : ""}
                {quote.last_viewed_at
                  ? `, ultima dată ${formatDateTime(quote.last_viewed_at)}`
                  : ""}
                , dar n-a confirmat încă.
              </>
            ) : (
              "Status: În așteptarea confirmării"
            )}
          </p>
        )}

        {quote.accepted_by_client_at && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm text-emerald-200">
            Acceptată de client
            {quote.client_signature
              ? ` — ${quote.client_signature}`
              : ""} pe {formatDate(quote.accepted_by_client_at)}
            {quote.client_signature_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={quote.client_signature_image}
                alt="Semnătura clientului"
                className="mx-auto mt-2 h-16 rounded-lg bg-white p-1"
              />
            )}
          </p>
        )}
      </article>

      <ExpiryNotice quote={quote} />

      {quote.public_token && isSupabaseConfigured && (
        <div className="no-print flex items-center gap-2 rounded-xl surface p-3 text-xs">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {publicQuoteUrl(quote.public_token)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(
                publicQuoteUrl(quote.public_token!),
              );
              toast.success("Link copiat");
            }}
          >
            Copiază
          </Button>
        </div>
      )}

      {quote.status === "sent" && quote.public_token && (
        <div className="no-print space-y-2 rounded-xl surface p-3">
          <p className="text-xs text-muted-foreground">
            {quote.reminder_sent_at
              ? `I-ai dat ghes ultima dată pe ${formatDate(quote.reminder_sent_at)}.`
              : "Tu primești notificare că oferta stă neconfirmată; clientul nu primește nimic."}
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const text = reminderText({
                clientName: client?.name ?? null,
                number: formatQuoteNumber(quote.number),
                title: quote.title,
                url: publicQuoteUrl(quote.public_token!),
                from: settings?.company || settings?.full_name || null,
              });
              window.open(
                whatsappHref(text, client?.phone),
                "_blank",
                "noopener,noreferrer",
              );
              await markQuoteReminded(quote.id);
            }}
          >
            <MessageCircle /> Trimite un memento
          </Button>
        </div>
      )}

      <div className="no-print space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {quote.status !== "sent" && quote.status !== "accepted" && (
            <Button
              onClick={async () => {
                await setQuoteStatus(quote.id, "sent");
                toast.success("Marcată ca trimisă");
              }}
            >
              <Send /> Marchează trimisă
            </Button>
          )}
          {quote.status !== "accepted" && (
            <Button
              variant="success"
              onClick={async () => {
                await setQuoteStatus(quote.id, "accepted");
                toast.success("Ofertă acceptată");
              }}
            >
              <CheckCircle2 /> Acceptată
            </Button>
          )}
          {quote.status !== "rejected" && (
            <Button variant="outline" onClick={() => setRejectOpen(true)}>
              <XCircle /> Refuzată
            </Button>
          )}
          {quote.status === "rejected" && (
            <Button variant="outline" onClick={() => setRejectOpen(true)}>
              <XCircle />{" "}
              {isRejectReason(quote.rejected_reason)
                ? REJECT_REASON_LABELS[quote.rejected_reason]
                : "Pune un motiv"}
            </Button>
          )}
          {!quote.job_id && (
            <Button
              variant="secondary"
              onClick={async () => {
                const job = await convertQuoteToJob(quote.id);
                if (job) {
                  toast.success("Lucrare creată din ofertă");
                  router.push(`/lucrari/${job.id}`);
                }
              }}
            >
              <Hammer /> Fă lucrare
            </Button>
          )}
        </div>

        {quote.job_id && (
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/lucrari/${quote.job_id}`}>
              <Hammer /> Vezi lucrarea
            </Link>
          </Button>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/oferte/${quote.id}/editare`}>
              <Pencil /> Editează
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const copy = await duplicateQuote(quote.id);
              if (!copy) {
                toast.error("Oferta nu a putut fi duplicată");
                return;
              }
              toast.success("Ofertă duplicată");
              router.push(`/oferte/${copy.id}/editare`);
            }}
          >
            <Copy /> Duplică
          </Button>
          <Confirm
            title="Ștergi oferta?"
            onConfirm={async () => {
              await deleteQuote(quote.id);
              toast.success("Ofertă ștearsă");
              router.replace("/oferte");
            }}
          >
            <Button
              variant="outline"
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 /> Șterge
            </Button>
          </Confirm>
        </div>
      </div>

      <RejectDialog
        quoteId={quote.id}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
      />
    </div>
  );
}
