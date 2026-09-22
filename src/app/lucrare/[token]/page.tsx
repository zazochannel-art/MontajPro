"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { Check, HardHat, ImageOff, MapPin, Phone } from "lucide-react";
import {
  fetchJob,
  jobPhotoUrl,
  type PublicJob,
  type PublicResult,
} from "@/lib/supabase/public-pages";
import {
  JOB_STATUS_LABELS,
  JOB_TYPE_EMOJI,
  JOB_TYPE_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/layout/logo";
import type { JobStatus, JobType } from "@/lib/types";

/**
 * Lucrarea, văzută de client.
 *
 * Omul sună „unde sunteți?” fiindcă n-are de unde ști. Pagina asta îi spune
 * exact atât cât îl privește: când e programată, dacă s-a început, ce s-a
 * făcut și cum arată. Niciun preț, niciun profit, nicio altă lucrare — baza
 * nici nu le trimite.
 *
 * Nu cere cont și nu scrie nimic local.
 */
export default function PublicJobPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [result, setResult] = useState<PublicResult<PublicJob> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchJob(token).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!result) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (result.state !== "ok") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
            <ImageOff className="size-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Linkul nu mai e bun</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Lucrarea nu mai e partajată. Cereți un link nou de la cel care v-a
            trimis acesta.
          </p>
        </div>
      </main>
    );
  }

  const job = result.data;
  const done = job.tasks.filter((task) => task.done).length;

  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-4 p-4 pb-12 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <header className="flex items-center justify-between gap-3">
        <Logo />
        {job.issuer.phone && (
          <a
            href={`tel:${job.issuer.phone}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1.5 text-sm"
          >
            <Phone className="size-3.5" /> Sună
          </a>
        )}
      </header>

      <section className="space-y-2 rounded-2xl surface p-4">
        <p className="text-xs text-muted-foreground">
          {job.issuer.name ?? "Executant"}
        </p>
        <h1 className="text-xl font-bold tracking-tight">
          {JOB_TYPE_EMOJI[job.type as JobType] ?? "🔧"} {job.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {JOB_TYPE_LABELS[job.type as JobType] ?? "Lucrare"}
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">
          <HardHat className="size-3.5" />
          {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
        </p>
        {job.address && (
          <p className="flex items-start gap-1.5 pt-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" /> {job.address}
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-2xl surface p-4">
        <h2 className="text-sm font-semibold">Când</h2>
        <dl className="space-y-1.5 text-sm">
          <Row
            label="Programată"
            value={
              job.scheduled_date
                ? `${formatDate(job.scheduled_date)}${job.scheduled_time ? `, ora ${job.scheduled_time}` : ""}`
                : "Încă nu s-a fixat ziua"
            }
          />
          {job.start_date && (
            <Row label="Începută" value={formatDate(job.start_date)} />
          )}
          {job.end_date && (
            <Row label="Terminată" value={formatDate(job.end_date)} />
          )}
        </dl>
      </section>

      {job.tasks.length > 0 && (
        <section className="space-y-2.5 rounded-2xl surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Ce s-a făcut</h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {done}/{job.tasks.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {job.tasks.map((task, index) => (
              <li key={`${task.title}-${index}`} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                    task.done
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-elevated text-muted-foreground"
                  }`}
                >
                  {task.done ? <Check className="size-3" /> : null}
                </span>
                <span
                  className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}
                >
                  {task.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {job.photos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Cum arată</h2>
          <div className="grid grid-cols-2 gap-2">
            {job.photos.map((photo) => {
              const url = jobPhotoUrl(photo.path);
              if (!url) return null;
              return (
                <div
                  key={photo.path}
                  className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <Image
                    src={url}
                    alt={job.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 288px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Pagina se actualizează singură pe măsură ce lucrarea înaintează.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
