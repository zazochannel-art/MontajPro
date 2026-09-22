"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Globe, ImageIcon, Images, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssetImage } from "@/components/photo/asset-image";
import { useAllJobs, useTable } from "@/hooks/use-data";
import { setJobInPortfolio, updateJob } from "@/lib/db/actions";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-provider";
import { JOB_TYPE_EMOJI, JOB_TYPE_LABELS } from "@/lib/constants";
import { JOB_TYPES } from "@/lib/types";
import type { Job, JobType } from "@/lib/types";
import { formatDate } from "@/lib/format";

type Filter = JobType | "all";

/** Portofoliul: lucrările finalizate, cu „înainte” și „după”. */
export default function PortfolioPage() {
  const { settings } = useApp();
  const jobs = useAllJobs();
  const photos = useTable("job_photos");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Job | null>(null);
  const [description, setDescription] = useState("");

  const entries = useMemo(() => {
    const done = jobs.filter((job) => job.status === "done");
    return done
      .filter((job) => filter === "all" || job.type === filter)
      .map((job) => {
        const jobPhotos = photos.filter((photo) => photo.job_id === job.id);
        return {
          job,
          before: jobPhotos.filter((photo) => photo.stage === "before"),
          after: jobPhotos.filter((photo) => photo.stage === "after"),
          during: jobPhotos.filter((photo) => photo.stage === "during"),
        };
      })
      .sort((a, b) =>
        (b.job.end_date ?? b.job.updated_at).localeCompare(a.job.end_date ?? a.job.updated_at),
      );
  }, [jobs, photos, filter]);

  const counts = useMemo(() => {
    const done = jobs.filter((job) => job.status === "done");
    const result = { all: done.length } as Record<Filter, number>;
    for (const type of JOB_TYPES) {
      result[type] = done.filter((job) => job.type === type).length;
    }
    return result;
  }, [jobs]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portofoliu"
        description="Lucrările finalizate — dovada meseriei tale"
      />

      <PublicHint
        shown={jobs.filter((job) => job.in_portfolio && !job.deleted_at).length}
        linkOn={!!settings?.portfolio_token}
      />

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Toate", count: counts.all },
          ...JOB_TYPES.map((type) => ({
            value: type as Filter,
            label: JOB_TYPE_LABELS[type],
            count: counts[type],
          })),
        ]}
      />

      {entries.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map(({ job, before, after, during }) => (
            <article
              key={job.id}
              className="overflow-hidden rounded-2xl surface"
            >
              <div className="grid grid-cols-2 gap-px bg-border">
                <div className="relative aspect-[4/3] bg-muted">
                  {before[0] ? (
                    <AssetImage
                      storagePath={before[0].storage_path}
                      localKey={before[0].local_key}
                      alt={`Înainte — ${job.title}`}
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Camera className="size-5" />
                      <span className="text-[10px]">fără „înainte”</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    ÎNAINTE
                  </span>
                </div>
                <div className="relative aspect-[4/3] bg-muted">
                  {after[0] ? (
                    <AssetImage
                      storagePath={after[0].storage_path}
                      localKey={after[0].local_key}
                      alt={`După — ${job.title}`}
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <Camera className="size-5" />
                      <span className="text-[10px]">fără „după”</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    DUPĂ
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {JOB_TYPE_EMOJI[job.type]} {job.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {JOB_TYPE_LABELS[job.type]} · {formatDate(job.end_date ?? job.updated_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Editează descrierea"
                    onClick={() => {
                      setEditing(job);
                      setDescription(job.portfolio_description ?? "");
                    }}
                  >
                    <Pencil />
                  </Button>
                </div>

                {job.portfolio_description && (
                  <p className="text-sm text-muted-foreground">{job.portfolio_description}</p>
                )}

                {/*
                  * Bifa care hotărăște ce se vede prin linkul public. Fără ea,
                  * linkul din Setări arată o pagină goală: funcția din bază
                  * întoarce doar lucrările bifate aici.
                  */}
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-2.5">
                  <span className="flex items-center gap-2 text-xs">
                    <Globe className="size-3.5 text-muted-foreground" />
                    <span className={job.in_portfolio ? "font-medium" : "text-muted-foreground"}>
                      {job.in_portfolio ? "Se vede public" : "Doar pentru tine"}
                    </span>
                  </span>
                  <Switch
                    checked={!!job.in_portfolio}
                    aria-label={`Arată „${job.title}” în portofoliul public`}
                    onCheckedChange={(on) => {
                      void setJobInPortfolio(job.id, on).then(() => {
                        toast.success(
                          on ? "Intră în portofoliul public" : "Scoasă din portofoliul public",
                        );
                      });
                    }}
                  />
                </label>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Images className="size-3.5" />
                    {before.length + after.length + during.length} poze
                  </span>
                  <Link
                    href={`/lucrari/${job.id}?tab=poze`}
                    className="text-xs text-primary hover:underline"
                  >
                    Vezi lucrarea
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="Portofoliu gol"
          description="Finalizează o lucrare și adaugă poze „înainte” și „după” — apar automat aici."
          action={
            <Button asChild variant="outline">
              <Link href="/lucrari">Vezi lucrările</Link>
            </Button>
          }
        />
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descriere pentru portofoliu</DialogTitle>
          </DialogHeader>
          <Field label="Descriere" hint="Ce ai făcut, cu ce materiale, în cât timp">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Scară din stejar masiv, 15 trepte, finisaj ulei natural. Montaj în 2 zile."
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Anulează
            </Button>
            <Button
              onClick={async () => {
                if (editing) {
                  await updateJob(editing.id, { portfolio_description: description.trim() || null });
                  toast.success("Descriere salvată");
                }
                setEditing(null);
              }}
            >
              Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Cum stau cele două lucruri care fac linkul public să arate ceva.
 *
 * Linkul pornit fără nicio lucrare bifată duce la o pagină goală, iar
 * lucrările bifate fără link pornit nu se văd nicăieri. Rândul ăsta spune
 * limpede care dintre cele două lipsește.
 */
function PublicHint({ shown, linkOn }: { shown: number; linkOn: boolean }) {
  if (linkOn && shown > 0) {
    return (
      <p className="flex items-start gap-2 rounded-xl surface p-3 text-xs text-muted-foreground">
        <Globe className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>
          {shown} {shown === 1 ? "lucrare se vede" : "lucrări se văd"} prin linkul
          public.{" "}
          <Link href="/setari" className="text-primary hover:underline">
            Linkul
          </Link>
        </span>
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
      <Globe className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {linkOn
          ? "Linkul public e pornit, dar n-ai bifat nicio lucrare — cine îl deschide vede o pagină goală. Bifează mai jos ce vrei să arăți."
          : shown > 0
            ? `Ai ${shown} ${shown === 1 ? "lucrare bifată" : "lucrări bifate"}, dar linkul public e oprit, deci nu le vede nimeni.`
            : "Bifează lucrările pe care vrei să le arăți, apoi pornește linkul public din Setări."}{" "}
        <Link href="/setari" className="underline underline-offset-2">
          Setări
        </Link>
      </span>
    </p>
  );
}
