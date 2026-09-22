"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  AlertTriangle,
  MapPin,
  Merge,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientDialog } from "@/components/forms/client-dialog";
import { JobCard } from "@/components/jobs/job-card";
import { AssetImage } from "@/components/photo/asset-image";
import { useRow, useStoreReady, useTable } from "@/hooks/use-data";
import { PunctualityCard } from "@/components/clients/punctuality-card";
import { deleteClient, mergeClients } from "@/lib/db/actions";
import { findDuplicates } from "@/lib/clients";
import { formatDateShort, formatMoney } from "@/lib/format";
import { useApp } from "@/lib/app-provider";
import { PAYMENT_KIND_LABELS } from "@/lib/constants";
import { initials, mapsHref, telHref } from "@/lib/utils";

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ready = useStoreReady();
  const router = useRouter();
  const { currency } = useApp();
  const client = useRow("clients", id);
  const clients = useTable("clients");
  const allJobs = useTable("jobs");
  const allPayments = useTable("payments");
  const allPhotos = useTable("job_photos");
  const [editOpen, setEditOpen] = useState(false);

  const data = useMemo(() => {
    const jobs = allJobs
      .filter((job) => job.client_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const jobIds = new Set(jobs.map((job) => job.id));
    const payments = allPayments
      .filter((payment) => payment.client_id === id || (payment.job_id && jobIds.has(payment.job_id)))
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    const photos = allPhotos.filter((photo) => photo.job_id && jobIds.has(photo.job_id));
    const total = jobs.reduce((acc, job) => acc + job.price_total, 0);
    const paid = payments.reduce((acc, payment) => acc + payment.amount, 0);
    return {
      jobs,
      payments,
      photos,
      total,
      paid,
      rest: total - paid,
      done: jobs.filter((job) => job.status === "done").length,
      active: jobs.filter((job) =>
        ["confirmed", "materials", "in_progress"].includes(job.status),
      ).length,
    };
  }, [allJobs, allPayments, allPhotos, id]);

  if (!ready) return <Skeleton className="h-96 w-full" />;
  if (!client) notFound();

  const phone = telHref(client.phone);
  const maps = mapsHref(client.address);
  // Dublura se poate repara și după ce s-a produs: cine are deja două fișe
  // pentru același om vrea să le vadă la un loc, nu să aleagă între ele.
  const duplicates = findDuplicates(clients, {
    name: client.name,
    phone: client.phone,
    excludeId: client.id,
  });
  const whatsapp = client.phone ? `https://wa.me/${client.phone.replace(/[^\d]/g, "")}` : null;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl surface p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-lg font-bold text-primary">
            {initials(client.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold">{client.name}</h2>
            {client.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
            {client.email && (
              <p className="truncate text-sm text-muted-foreground">{client.email}</p>
            )}
            {client.address && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                {client.address}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <a
            href={phone ?? "#"}
            onClick={(event) => !phone && event.preventDefault()}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent ${phone ? "" : "pointer-events-none opacity-50"}`}
          >
            <Phone className="size-4" /> Sună
          </a>
          <a
            href={whatsapp ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => !whatsapp && event.preventDefault()}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent ${whatsapp ? "" : "pointer-events-none opacity-50"}`}
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <a
            href={maps ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => !maps && event.preventDefault()}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-medium transition-colors hover:bg-accent ${maps ? "" : "pointer-events-none opacity-50"}`}
          >
            <Navigation className="size-4" /> Hartă
          </a>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Total lucrări", value: formatMoney(data.total, currency, { compact: true }) },
          { label: "Încasat", value: formatMoney(data.paid, currency, { compact: true }) },
          { label: "Finalizate", value: String(data.done) },
          { label: "Active", value: String(data.active) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl surface p-3.5">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-bold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </section>

      {client.notes && (
        <section className="rounded-2xl surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notițe
          </p>
          <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Lucrări</h3>
          <Button size="sm" variant="outline" asChild>
            <Link href="/lucrari/nou">
              <Plus /> Adaugă
            </Link>
          </Button>
        </div>
        {data.jobs.length ? (
          <div className="space-y-3">
            {data.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Plus} title="Nicio lucrare pentru acest client" />
        )}
      </section>

      <PunctualityCard jobs={data.jobs} />

      {data.payments.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Istoric plăți</h3>
          <ul className="space-y-2">
            {data.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 rounded-xl surface p-3.5"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
                  <Wallet className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {formatMoney(payment.amount, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_KIND_LABELS[payment.kind]} · {formatDateShort(payment.paid_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.photos.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Fotografii</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {data.photos.slice(0, 12).map((photo) => (
              <Link
                key={photo.id}
                href={`/lucrari/${photo.job_id}?tab=poze`}
                className="aspect-square overflow-hidden rounded-xl border border-border"
              >
                <AssetImage
                  storagePath={photo.storage_path}
                  localKey={photo.local_key}
                  alt="Fotografie lucrare"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {duplicates.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex items-start gap-2 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {duplicates[0].by === "phone"
              ? "Altcineva din agendă are același număr. Probabil e același om, cu istoricul rupt în două."
              : "Mai ai un client cu numele ăsta."}
          </p>
          <div className="flex flex-wrap gap-2">
            {duplicates.slice(0, 3).map(({ client: other }) => (
              <Confirm
                key={other.id}
                title={`Unești cu ${other.name}?`}
                description="Lucrările, plățile, ofertele, facturile și procesele-verbale trec la clientul acesta. Dublura ajunge în coș, deci se poate întoarce."
                confirmLabel="Unește"
                onConfirm={async () => {
                  const moved = await mergeClients(other.id, client.id);
                  toast.success(
                    moved
                      ? `${moved} înregistrări mutate la ${client.name}`
                      : "Clienții au fost uniți",
                  );
                }}
              >
                <Button size="sm" variant="outline">
                  <Merge /> Unește cu {other.name}
                </Button>
              </Confirm>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setEditOpen(true)}>
          <Pencil /> Editează
        </Button>
        <Confirm
          title="Ștergi clientul?"
          description="Lucrările rămân, dar nu vor mai fi legate de acest client."
          onConfirm={async () => {
            await deleteClient(client.id);
            toast.success("Client șters");
            router.replace("/clienti");
          }}
        >
          <Button variant="outline" className="text-red-400 hover:text-red-300">
            <Trash2 /> Șterge
          </Button>
        </Confirm>
      </div>

      <ClientDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
    </div>
  );
}
