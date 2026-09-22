"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, FileCheck, ShieldCheck } from "lucide-react";
import {
  fetchHandover,
  signHandover,
  type PublicHandover,
  type PublicResult,
} from "@/lib/supabase/public-pages";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePad } from "@/components/ui/signature-pad";

/**
 * Procesul-verbal, citit și semnat de client pe telefonul lui.
 *
 * Până acum semna pe telefonul tău, deci trebuia să fiți amândoi acolo în
 * aceeași clipă. Acum termini lucrarea, trimiți linkul, iar omul semnează când
 * ajunge acasă.
 *
 * Se semnează o singură dată — ca o hârtie.
 */
export default function PublicHandoverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [result, setResult] = useState<PublicResult<PublicHandover> | null>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchHandover(token).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!result) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (result.state !== "ok") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
            <FileCheck className="size-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Documentul nu a fost găsit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Linkul poate fi greșit sau închis. Cere-i altul celui care ți l-a
            trimis.
          </p>
        </div>
      </main>
    );
  }

  const handover = result.data;
  const signed = !!handover.signed_by_client_at;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl p-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:p-6">
      <article className="print-surface surface space-y-5 rounded-2xl p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Proces-verbal de predare
            </h1>
            <p className="text-sm text-muted-foreground">
              nr. {handover.number} · {formatDate(handover.handed_at)}
            </p>
          </div>
          <FileCheck className="mt-1 size-5 shrink-0 text-primary" />
        </header>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Executant</dt>
            <dd className="font-medium">{handover.issuer.name ?? "—"}</dd>
            {handover.issuer.phone && (
              <dd className="text-sm text-muted-foreground">
                {handover.issuer.phone}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Beneficiar</dt>
            <dd className="font-medium">{handover.client_name ?? "—"}</dd>
            {handover.client_address && (
              <dd className="text-sm text-muted-foreground">
                {handover.client_address}
              </dd>
            )}
          </div>
        </dl>

        {(handover.work_summary || handover.job_title) && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ce s-a executat
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm">
              {handover.work_summary || handover.job_title}
            </p>
          </section>
        )}

        {handover.warranty_months ? (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Garanție {handover.warranty_months} luni de la predare.
          </p>
        ) : null}

        {handover.notes && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Observații
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {handover.notes}
            </p>
          </section>
        )}

        <section className="border-t border-border pt-4">
          {signed ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="size-4" /> Semnat pe{" "}
                {formatDate(handover.signed_by_client_at!)}
              </p>
              {handover.client_signature_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={handover.client_signature_image}
                  alt="Semnătura clientului"
                  className="h-24 w-full rounded-xl bg-white object-contain"
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Semnează primirea</h2>
              <p className="text-xs text-muted-foreground">
                Semnătura confirmă că lucrarea a fost predată așa cum scrie mai
                sus. Se pune o singură dată.
              </p>
              {/*
                * Panoul de semnat își are propriul buton de confirmare: omul
                * desenează, apoi apasă, iar semnătura pleacă direct.
                */}
              <SignaturePad
                busy={signing}
                onDone={async (dataUrl) => {
                  setSigning(true);
                  const next = await signHandover(token, dataUrl);
                  setResult(next);
                  setSigning(false);
                }}
              />
            </div>
          )}
        </section>
      </article>
    </main>
  );
}
