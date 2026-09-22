"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { Hammer, ImageOff, Phone } from "lucide-react";
import {
  fetchPortfolio,
  portfolioPhotoUrl,
  type PublicPortfolio,
  type PublicResult,
} from "@/lib/supabase/public-pages";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/layout/logo";
import type { JobType } from "@/lib/types";

/**
 * Portofoliul, văzut de cineva care încă nu ți-e client.
 *
 * Aplicația te ajuta să faci treaba și să numeri banii, dar nu făcea nimic
 * pentru următoarea lucrare. Linkul ăsta e tot ce ai de trimis pe WhatsApp
 * omului care întreabă de preț: uite ce am lucrat.
 *
 * Nu cere cont, nu pornește aplicația, nu scrie nimic local.
 */
export default function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [result, setResult] = useState<PublicResult<PublicPortfolio> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPortfolio(token).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!result) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
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
          <p className="mt-1 text-sm text-muted-foreground">
            Poate a fost închis între timp. Cere-i unul nou celui care ți l-a
            trimis.
          </p>
        </div>
      </main>
    );
  }

  const { intro, issuer, jobs } = result.data;

  return (
    <main className="aurora grain relative mx-auto min-h-dvh max-w-2xl p-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:p-6">
      <header className="mb-6 text-center">
        <div className="flex justify-center">
          <Logo tagline />
        </div>
        {issuer.name && (
          <p className="mt-3 text-sm font-medium">{issuer.name}</p>
        )}
        {intro && (
          <p className="text-balance mt-2 text-sm text-muted-foreground">
            {intro}
          </p>
        )}
      </header>

      {jobs.length === 0 ? (
        <div className="surface rounded-2xl p-6 text-center">
          <Hammer className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Încă nu e nimic de arătat aici.
          </p>
        </div>
      ) : (
        <div className="stagger space-y-4">
          {jobs.map((job) => (
            <article key={job.id} className="surface overflow-hidden rounded-2xl">
              {job.photos.length > 0 && (
                <div
                  className={`grid gap-0.5 ${
                    job.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  }`}
                >
                  {job.photos.slice(0, 4).map((path) => {
                    const url = portfolioPhotoUrl(path);
                    if (!url) return null;
                    return (
                      <div key={path} className="relative aspect-[4/3]">
                        <Image
                          src={url}
                          alt={job.title}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 50vw, 300px"
                          className="object-cover"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="text-lg">
                    {JOB_TYPE_EMOJI[job.type as JobType] ?? "🔧"}
                  </span>
                  {job.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {JOB_TYPE_LABELS[job.type as JobType] ?? job.type}
                  {job.done_at && <> · {formatDateShort(job.done_at)}</>}
                </p>
                {job.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {job.description}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {issuer.phone && (
        <a
          href={`tel:${issuer.phone}`}
          className="surface card-hover mt-6 flex items-center justify-center gap-2 rounded-2xl p-4 font-semibold"
        >
          <Phone className="size-4 text-primary" /> {issuer.phone}
        </a>
      )}
    </main>
  );
}
