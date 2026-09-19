"use client";

import { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, Phone, ShieldCheck } from "lucide-react";
import {
  acceptPublicQuote,
  fetchPublicQuote,
  type PublicQuote,
  type PublicQuoteResult,
} from "@/lib/supabase/public-quote";
import { formatDate, formatMoney, formatNumber, formatQuoteNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Pagina pe care o deschide clientul.
 *
 * Nu cere cont, nu pornește aplicația și nu scrie nimic local. Are un singur
 * lucru de făcut: să arate oferta clar și să permită un „Accept" care rămâne
 * scris, cu nume și oră.
 */
export default function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [result, setResult] = useState<PublicQuoteResult | null>(null);
  const [signer, setSigner] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicQuote(token).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = useCallback(async () => {
    setAccepting(true);
    try {
      const next = await acceptPublicQuote(token, signer);
      setResult(next);
    } finally {
      setAccepting(false);
    }
  }, [token, signer]);

  if (!result) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (result.state !== "ok") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Oferta nu este disponibilă</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.state === "no-backend"
              ? "Linkul funcționează doar când aplicația este conectată la cloud."
              : result.state === "error"
                ? result.message
                : "Linkul este greșit, oferta a fost retrasă sau a expirat. Cere-i montatorului unul nou."}
          </p>
        </div>
      </main>
    );
  }

  return <QuoteDocument quote={result.quote} signer={signer} onSigner={setSigner} onAccept={accept} accepting={accepting} />;
}

function QuoteDocument({
  quote,
  signer,
  onSigner,
  onAccept,
  accepting,
}: {
  quote: PublicQuote;
  signer: string;
  onSigner: (value: string) => void;
  onAccept: () => void;
  accepting: boolean;
}) {
  const currency = quote.currency;
  const subtotal = quote.items.reduce(
    (acc, item) => acc + item.quantity * item.unit_price,
    0,
  );
  const total = Math.max(0, subtotal - quote.discount);
  const rest = total - quote.advance;
  const accepted = quote.status === "accepted";

  return (
    <main className="mx-auto min-h-dvh max-w-2xl p-4 sm:p-6">
      <article className="print-surface space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              OFERTĂ {formatQuoteNumber(quote.number)}
            </h1>
            <p className="text-sm text-muted-foreground">{formatDate(quote.created_at)}</p>
            {quote.valid_until && (
              <p className="text-sm text-muted-foreground">
                Valabilă până la {formatDate(quote.valid_until)}
              </p>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{quote.issuer.name || "MontajPro"}</p>
            {quote.issuer.phone && (
              <a
                href={`tel:${quote.issuer.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Phone className="size-3" />
                {quote.issuer.phone}
              </a>
            )}
          </div>
        </header>

        <div className="grid gap-1 text-sm">
          {quote.client && (
            <p>
              <span className="text-muted-foreground">Client: </span>
              <span className="font-medium">{quote.client.name}</span>
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Lucrare: </span>
            <span className="font-medium">{quote.title}</span>
          </p>
        </div>

        <div className="space-y-2">
          {quote.items.map((item, index) => (
            <div
              key={`${item.description}-${index}`}
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
                <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reducere</dt>
                <dd className="tabular-nums">−{formatMoney(quote.discount, currency)}</dd>
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
                <dt className="text-muted-foreground">Avans la confirmare</dt>
                <dd className="tabular-nums">{formatMoney(quote.advance, currency)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Rest la finalizare</dt>
                <dd className="tabular-nums">{formatMoney(rest, currency)}</dd>
              </div>
            </>
          )}
        </dl>

        {quote.notes && (
          <p className="whitespace-pre-wrap border-t border-border pt-4 text-sm text-muted-foreground">
            {quote.notes}
          </p>
        )}
      </article>

      {accepted ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
          <div className="text-sm">
            <p className="font-medium text-emerald-200">Ofertă acceptată</p>
            <p className="text-emerald-200/80">
              {quote.client_signature ? `Confirmată de ${quote.client_signature}` : "Confirmată"}
              {quote.accepted_by_client_at && ` · ${formatDate(quote.accepted_by_client_at)}`}
            </p>
            <p className="mt-1 text-emerald-200/70">
              Montatorul a fost anunțat. Te va contacta pentru programare.
            </p>
          </div>
        </div>
      ) : (
        <div className="no-print mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Dacă prețul îți convine, confirmă aici. Confirmarea ajunge direct la montator.
          </p>
          <Field label="Numele tău" htmlFor="signer">
            <Input
              id="signer"
              value={signer}
              onChange={(event) => onSigner(event.target.value)}
              placeholder="Ion Popescu"
              autoComplete="name"
            />
          </Field>
          <Button
            size="xl"
            className="w-full"
            onClick={onAccept}
            disabled={accepting || signer.trim().length < 3}
          >
            {accepting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Accept oferta
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Confirmarea se înregistrează cu numele și ora, nu cere cont.
          </p>
        </div>
      )}
    </main>
  );
}
