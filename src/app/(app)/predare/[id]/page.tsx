"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Pencil,
  Printer,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfButton } from "@/components/ui/pdf-button";
import { pdfFileName } from "@/lib/pdf";
import { Badge } from "@/components/ui/badge";
import { Confirm } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePad } from "@/components/ui/signature-pad";
import { AssetImage } from "@/components/photo/asset-image";
import { HandoverDialog } from "@/components/forms/handover-dialog";
import { useRow, useStoreReady, useTable } from "@/hooks/use-data";
import {
  clearHandoverSignature,
  deleteHandover,
  shareHandover,
  signHandover,
} from "@/lib/db/actions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useApp } from "@/lib/app-provider";
import { formatDate, formatDateTime } from "@/lib/format";

/** Procesul-verbal de predare, în forma în care se semnează și se printează. */
export default function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const ready = useStoreReady();
  const { settings } = useApp();
  const handover = useRow("handovers", id);
  const job = useRow("jobs", handover?.job_id);
  const photos = useTable("job_photos");
  const [editOpen, setEditOpen] = useState(false);
  const [signer, setSigner] = useState("");
  const [signing, setSigning] = useState(false);
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!ready) return <Skeleton className="h-96 w-full" />;
  if (!handover) notFound();

  /*
   * Semnat e semnat, fie pe telefonul tău, fie prin link de pe al lui. Ce
   * ține minte baza sunt două coloane diferite, ca să se vadă pe unde a
   * venit semnătura; pagina le arată la fel.
   */
  const signature = handover.signature ?? handover.client_signature_image;
  const signedAt = handover.signed_at ?? handover.signed_by_client_at;
  const remote = !handover.signature && !!handover.client_signature_image;

  const afterPhotos = photos
    .filter((photo) => photo.job_id === handover.job_id && photo.stage === "after")
    .slice(0, 6);

  const share = async () => {
    const lines = [
      `PROCES-VERBAL DE PREDARE-PRIMIRE nr. ${handover.number}`,
      `Data: ${formatDate(handover.handed_at)}`,
      job ? `Lucrare: ${job.title}` : null,
      handover.client_name ? `Beneficiar: ${handover.client_name}` : null,
      handover.work_summary ? `\n${handover.work_summary}` : null,
      handover.warranty_months
        ? `\nGaranție: ${handover.warranty_months} luni`
        : null,
      handover.signed_at
        ? `\nSemnat de ${handover.signer_name ?? "beneficiar"} la ${formatDateTime(handover.signed_at)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share)
        await navigator.share({ title: "Proces-verbal de predare", text: lines });
      else {
        await navigator.clipboard.writeText(lines);
        toast.success("Proces-verbal copiat");
      }
    } catch {
      // Partajare anulată.
    }
  };

  /*
   * Linkul de semnat de pe telefonul clientului.
   *
   * Omul nu e mereu lângă tine când termini: pune gresia, pleci, iar el vine
   * seara. Linkul îi arată procesul-verbal și îi ia semnătura de acolo, fără
   * să-i dai telefonul tău din mână și fără cont.
   */
  const sendToClient = async () => {
    setLinking(true);
    try {
      const token = await shareHandover(handover.id);
      if (!token) return toast.error("Nu s-a putut face linkul");
      const url = `${window.location.origin}/predare-client/${token}`;
      const text = `Procesul-verbal pentru ${job?.title ?? "lucrare"}. Îl puteți citi și semna aici: ${url}`;
      try {
        if (navigator.share) await navigator.share({ title: "Proces-verbal de predare", text });
        else {
          await navigator.clipboard.writeText(url);
          toast.success("Link copiat — trimite-i-l clientului");
        }
      } catch {
        // Partajare anulată; tokenul rămâne făcut, linkul se vede mai jos.
      }
    } finally {
      setLinking(false);
    }
  };

  const publicUrl =
    handover.public_token && typeof window !== "undefined"
      ? `${window.location.origin}/predare-client/${handover.public_token}`
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        {signedAt ? (
          <Badge variant="success">Semnat {formatDate(signedAt)}</Badge>
        ) : (
          <Badge variant="warning">Nesemnat</Badge>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={share}>
          <Share2 /> Trimite
        </Button>
        {!signature && isSupabaseConfigured && (
          <Button size="sm" loading={linking} onClick={sendToClient}>
            <Link2 /> Semnează clientul
          </Button>
        )}
        <PdfButton targetId="document" filename={pdfFileName(["proces-verbal", handover.number])} />
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer /> Printează
        </Button>
      </div>

      <article
        id="document"
        className="print-surface space-y-5 rounded-2xl surface p-5 sm:p-7"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              PROCES-VERBAL DE PREDARE-PRIMIRE
            </h2>
            <p className="text-sm text-muted-foreground">
              nr. {handover.number} · {formatDate(handover.handed_at)}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">
              {settings?.company || settings?.full_name || "Executant"}
            </p>
            {settings?.phone && (
              <p className="text-muted-foreground">{settings.phone}</p>
            )}
          </div>
        </header>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Beneficiar
            </dt>
            <dd className="font-medium">
              {handover.client_name || "Fără client"}
            </dd>
            {handover.client_phone && (
              <dd className="text-sm text-muted-foreground">
                {handover.client_phone}
              </dd>
            )}
            {handover.client_address && (
              <dd className="text-sm text-muted-foreground">
                {handover.client_address}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Lucrarea
            </dt>
            <dd className="font-medium">{job?.title ?? "Lucrare ștearsă"}</dd>
            {handover.warranty_months ? (
              <dd className="text-sm text-muted-foreground">
                Garanție {handover.warranty_months} luni de la predare
              </dd>
            ) : null}
          </div>
        </dl>

        {handover.work_summary && (
          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
              S-au executat
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">
              {handover.work_summary}
            </p>
          </section>
        )}

        {afterPhotos.length > 0 && (
          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
              Lucrarea la predare
            </h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {afterPhotos.map((photo) => (
                <AssetImage
                  key={photo.id}
                  storagePath={photo.storage_path}
                  localKey={photo.local_key}
                  alt={photo.caption ?? "Fotografie la predare"}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {handover.notes && (
          <p className="whitespace-pre-wrap rounded-xl bg-background p-3 text-sm text-muted-foreground">
            {handover.notes}
          </p>
        )}

        <section className="border-t border-border pt-4">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
            Beneficiarul confirmă primirea lucrării
          </h3>
          {signature ? (
            <div className="mt-2 space-y-1.5">
              {/* Semnătura e un PNG desenat pe telefon, nu un fișier din
                  Storage: de aceea merge un <img> simplu. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signature}
                alt="Semnătura beneficiarului"
                className="h-28 w-full rounded-xl border border-border bg-background object-contain"
              />
              <p className="text-sm">
                <strong>
                  {handover.signer_name || handover.client_name || "Beneficiar"}
                </strong>
                <span className="text-muted-foreground">
                  {" · "}
                  {signedAt ? formatDateTime(signedAt) : null}
                  {remote ? " · semnat prin link" : null}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Documentul nu este încă semnat.
            </p>
          )}
        </section>
      </article>

      {publicUrl && !signature && (
        <div className="no-print flex items-center gap-2 rounded-xl surface p-3 text-xs">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {publicUrl}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(publicUrl);
              setCopied(true);
              toast.success("Link copiat");
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copiat" : "Copiază"}
          </Button>
        </div>
      )}

      {!signature && (
        <section className="no-print space-y-3 rounded-2xl surface p-4">
          <h3 className="text-sm font-semibold">Semnătura clientului</h3>
          <p className="text-xs text-muted-foreground">
            Semnează aici, pe telefonul tău, sau trimite-i linkul de mai sus.
          </p>
          <Field label="Numele celui care semnează">
            <Input
              value={signer}
              onChange={(event) => setSigner(event.target.value)}
              placeholder={handover.client_name ?? "Nume și prenume"}
            />
          </Field>
          <SignaturePad
            busy={signing}
            onDone={async (dataUrl) => {
              setSigning(true);
              try {
                await signHandover(
                  handover.id,
                  dataUrl,
                  signer || handover.client_name || "",
                );
                toast.success("Proces-verbal semnat");
              } finally {
                setSigning(false);
              }
            }}
          />
        </section>
      )}

      <div className="no-print flex flex-wrap gap-2">
        {job && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/lucrari/${job.id}`}>
              Lucrarea <ExternalLink />
            </Link>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil /> Editează
        </Button>
        {handover.signature && (
          <Confirm
            title="Ștergi semnătura?"
            description="Documentul rămâne, dar va trebui semnat din nou."
            onConfirm={async () => {
              await clearHandoverSignature(handover.id);
              toast.success("Semnătură ștearsă");
            }}
          >
            <Button variant="outline" size="sm">
              Șterge semnătura
            </Button>
          </Confirm>
        )}
        <div className="flex-1" />
        <Confirm
          title="Ștergi procesul-verbal?"
          onConfirm={async () => {
            await deleteHandover(handover.id);
            toast.success("Proces-verbal șters");
            router.replace(job ? `/lucrari/${job.id}` : "/lucrari");
          }}
        >
          <Button variant="outline" size="sm">
            <Trash2 className="text-red-400" /> Șterge
          </Button>
        </Confirm>
      </div>

      <HandoverDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        jobId={handover.job_id}
        handover={handover}
      />
    </div>
  );
}
