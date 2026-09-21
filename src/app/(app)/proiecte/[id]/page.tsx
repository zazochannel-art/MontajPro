"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { Hammer, MapPin, Pencil, Plus, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCard } from "@/components/jobs/job-card";
import { ProjectDialog } from "@/components/forms/project-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useClientName,
  useProjectSummary,
  useRow,
  useStoreReady,
  useTable,
} from "@/hooks/use-data";
import { deleteProject, setJobProject } from "@/lib/db/actions";
import { useApp } from "@/lib/app-provider";
import { formatMoney } from "@/lib/format";

/** Pagina proiectului: lucrările lui și banii lor, la un loc. */
export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const ready = useStoreReady();
  const project = useRow("projects", id);
  const summary = useProjectSummary(id);
  const clientName = useClientName(project?.client_id);
  const allJobs = useTable("jobs");
  const { currency } = useApp();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState("");

  // Lucrările care n-au încă un acoperiș — candidatele de adăugat.
  const loose = useMemo(
    () =>
      allJobs
        .filter((job) => !job.project_id && !job.archived_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [allJobs],
  );

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.name}
        description={
          summary.jobs.length
            ? `${summary.done}/${summary.jobs.length} lucrări gata`
            : "Încă fără lucrări"
        }
      />

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-4" /> {clientName}
          </span>
          {project.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {project.address}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold tabular-nums">
              {formatMoney(summary.price, currency, { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Încasat</p>
            <p className="font-bold tabular-nums text-emerald-300">
              {formatMoney(summary.paid, currency, { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rest</p>
            <p
              className={
                summary.rest > 0.5
                  ? "font-bold tabular-nums text-amber-300"
                  : "font-bold tabular-nums"
              }
            >
              {formatMoney(summary.rest, currency, { compact: true })}
            </p>
          </div>
        </div>

        {project.notes && (
          <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">
            {project.notes}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setEditing(true)}
          >
            <Pencil /> Editează
          </Button>
          <Confirm
            title="Ștergi proiectul?"
            description="Lucrările rămân întregi, cu banii și pozele lor — doar ies de sub proiect."
            onConfirm={async () => {
              await deleteProject(project.id);
              toast.success("Proiect șters");
              router.replace("/proiecte");
            }}
          >
            <Button variant="outline" className="text-red-400 hover:text-red-300">
              <Trash2 /> Șterge
            </Button>
          </Confirm>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Lucrări</h2>
          <Button asChild size="sm" variant="outline">
            <Link href={`/lucrari/nou?proiect=${project.id}`}>
              <Plus /> Lucrare nouă
            </Link>
          </Button>
        </div>

        {summary.jobs.length ? (
          <div className="space-y-3">
            {summary.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Hammer}
            title="Niciun apartament încă"
            description="Adaugă o lucrare nouă sau mută una existentă sub proiect."
          />
        )}

        {loose.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Mută o lucrare existentă sub acest proiect:
            </p>
            <Select
              value={adding}
              onValueChange={async (value) => {
                setAdding("");
                await setJobProject(value, project.id);
                toast.success("Lucrare mutată în proiect");
              }}
            >
              <SelectTrigger aria-label="Alege lucrarea de mutat">
                <SelectValue placeholder="Alege lucrarea" />
              </SelectTrigger>
              <SelectContent>
                {loose.slice(0, 30).map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      <ProjectDialog
        open={editing}
        onOpenChange={setEditing}
        project={project}
      />
    </div>
  );
}
