"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientDialog } from "@/components/forms/client-dialog";
import { DictateButton } from "@/components/ui/dictate-button";
import { useZodForm } from "@/hooks/use-zod-form";
import { jobSchema } from "@/lib/schemas";
import { saveJob } from "@/lib/db/actions";
import {
  JOB_STATUS_LABELS,
  JOB_TYPE_EMOJI,
  JOB_TYPE_LABELS,
} from "@/lib/constants";
import { JOB_STATUSES, JOB_TYPES } from "@/lib/types";
import type { Job, JobStatus, JobType } from "@/lib/types";
import { useApp } from "@/lib/app-provider";
import { useClients, useProjects, useTable } from "@/hooks/use-data";
import { dayLoad } from "@/lib/route";
import { formatDuration } from "@/lib/format";
import { clearCalcDraft, peekCalcDraft } from "@/lib/calc-draft";
import { JOB_TYPE_UNIT } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Formularul de lucrare — folosit atât la creare, cât și la editare. */
export function JobForm({
  job,
  projectId,
}: {
  job?: Job | null;
  /** Când vii din pagina unui proiect, lucrarea se naște sub el. */
  projectId?: string | null;
}) {
  const router = useRouter();
  const { currency } = useApp();
  const clients = useClients();
  const projects = useProjects();
  const allJobs = useTable("jobs");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  // Când vii din calculator, tipul și prețul sunt deja calculate.
  const [draft] = useState(() => (job ? null : peekCalcDraft()));

  const form = useZodForm(jobSchema, {
    title:
      job?.title ??
      (draft ? `Montaj ${JOB_TYPE_LABELS[draft.kind].toLowerCase()}` : ""),
    client_id: job?.client_id ?? null,
    project_id: job?.project_id ?? projectId ?? null,
    type: (job?.type ?? draft?.kind ?? "stairs") as JobType,
    status: (job?.status ?? "quote") as JobStatus,
    address: job?.address ?? "",
    scheduled_date: job?.scheduled_date ?? "",
    scheduled_time: job?.scheduled_time ?? "",
    estimated_hours: job?.estimated_hours ?? 0,
    price_total: job?.price_total ?? draft?.total ?? 0,
    advance: 0,
    notes:
      job?.notes ??
      (draft
        ? draft.lines
            .map(
              (line) =>
                `${line.description}: ${line.quantity} ${line.unit || JOB_TYPE_UNIT[draft.kind]} × ${line.unit_price}`,
            )
            .join("\n")
        : ""),
  });

  useEffect(() => {
    if (!draft) return;
    clearCalcDraft();
    toast.success("Calculul a fost preluat");
  }, [draft]);

  // Ce mai e programat în ziua aleasă. Avertizarea la programare valorează mai
  // mult decât descoperirea la șapte dimineața.
  const sameDay = dayLoad(
    allJobs.filter(
      (row) =>
        row.id !== job?.id &&
        Boolean(form.values.scheduled_date) &&
        row.scheduled_date === form.values.scheduled_date,
    ),
  );

  const onSubmit = form.handleSubmit(async (data) => {
    const saved = await saveJob({ id: job?.id, ...data });
    if (!saved) {
      toast.error("Lucrarea nu a putut fi salvată");
      return;
    }
    toast.success(job ? "Lucrare actualizată" : "Lucrare creată");
    router.replace(`/lucrari/${saved.id}`);
  });

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5 pb-4">
        <div className="space-y-3.5 rounded-2xl surface p-4">
          <Field label="Tip lucrare">
            <div className="grid grid-cols-4 gap-2">
              {JOB_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    form.set("type", type);
                    if (!form.values.title)
                      form.set(
                        "title",
                        `Montaj ${JOB_TYPE_LABELS[type].toLowerCase()}`,
                      );
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors",
                    form.values.type === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  <span className="text-xl">{JOB_TYPE_EMOJI[type]}</span>
                  {JOB_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Titlu"
            htmlFor="job-title"
            error={form.errors.title}
            required
          >
            <Input
              id="job-title"
              value={form.values.title}
              onChange={(event) => form.set("title", event.target.value)}
              placeholder="Montaj scară stejar"
            />
          </Field>

          <Field label="Client">
            <div className="flex gap-2">
              <Select
                value={form.values.client_id ?? "none"}
                onValueChange={(value) => {
                  form.set("client_id", value === "none" ? null : value);
                  const client = clients.find((row) => row.id === value);
                  if (client?.address && !form.values.address)
                    form.set("address", client.address);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Alege clientul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Fără client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Client nou"
                onClick={() => setClientDialogOpen(true)}
              >
                <Plus />
              </Button>
            </div>
          </Field>

          {projects.length > 0 && (
            <Field
              label="Proiect"
              htmlFor="job-project"
              hint="Pentru un bloc cu mai multe apartamente."
            >
              <Select
                value={form.values.project_id ?? "none"}
                onValueChange={(value) => {
                  form.set("project_id", value === "none" ? null : value);
                  const project = projects.find((row) => row.id === value);
                  if (project?.address && !form.values.address)
                    form.set("address", project.address);
                }}
              >
                <SelectTrigger id="job-project">
                  <SelectValue placeholder="Fără proiect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Fără proiect</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Adresă" htmlFor="job-address">
            <Input
              id="job-address"
              value={form.values.address ?? ""}
              onChange={(event) => form.set("address", event.target.value)}
              placeholder="str. Ismail 45, Chișinău"
            />
          </Field>
        </div>

        <div className="space-y-3.5 rounded-2xl surface p-4">
          <FieldRow>
            <Field label="Data" htmlFor="job-date">
              <Input
                id="job-date"
                type="date"
                value={form.values.scheduled_date ?? ""}
                onChange={(event) =>
                  form.set("scheduled_date", event.target.value)
                }
              />
            </Field>
            <Field label="Ora" htmlFor="job-time">
              <Input
                id="job-time"
                type="time"
                value={form.values.scheduled_time ?? ""}
                onChange={(event) =>
                  form.set("scheduled_time", event.target.value)
                }
              />
            </Field>
          </FieldRow>

          {sameDay.jobs.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Mai ai {sameDay.jobs.length}{" "}
                {sameDay.jobs.length === 1 ? "lucrare" : "lucrări"} în ziua asta
                {sameDay.hours > 0 && `, ${formatDuration(Math.round(sameDay.hours * 60))} estimate`}
                {sameDay.long && " — e o zi cam plină"}.
              </span>
            </p>
          )}

          <Field
            label="Durată estimată"
            htmlFor="job-hours"
            hint="În ore — folosită în calendar"
          >
            <NumberInput
              id="job-hours"
              value={form.values.estimated_hours ?? 0}
              onChange={(value) => form.set("estimated_hours", value)}
              step={0.5}
              suffix="ore"
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.values.status}
              onValueChange={(value) => form.set("status", value as JobStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {JOB_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="space-y-3.5 rounded-2xl surface p-4">
          <Field
            label="Preț total"
            htmlFor="job-price"
            error={form.errors.price_total}
            required
          >
            <MoneyInput
              id="job-price"
              value={form.values.price_total}
              onChange={(value) => form.set("price_total", value)}
              currency={currency}
            />
          </Field>

          {!job && (
            <Field
              label="Avans primit"
              htmlFor="job-advance"
              hint="Se înregistrează ca plată"
            >
              <MoneyInput
                id="job-advance"
                value={form.values.advance ?? 0}
                onChange={(value) => form.set("advance", value)}
                currency={currency}
              />
            </Field>
          )}

          <Field label="Notițe" htmlFor="job-notes">
            <div className="flex items-start gap-2">
              <Textarea
                id="job-notes"
                value={form.values.notes ?? ""}
                onChange={(event) => form.set("notes", event.target.value)}
                placeholder="Detalii despre lucrare, cerințe speciale..."
                className="flex-1"
              />
              <DictateButton
                onText={(text) =>
                  form.set(
                    "notes",
                    [form.values.notes, text].filter(Boolean).join(" "),
                  )
                }
              />
            </div>
          </Field>
        </div>

        <div className="sticky bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-10 flex gap-2 lg:static">
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="flex-1"
            onClick={() => router.back()}
          >
            Anulează
          </Button>
          <Button
            type="submit"
            size="xl"
            className="flex-[2]"
            loading={form.submitting}
          >
            <Check /> {job ? "Salvează" : "Creează lucrarea"}
          </Button>
        </div>
      </form>

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSaved={(id) => form.set("client_id", id)}
      />
    </>
  );
}
