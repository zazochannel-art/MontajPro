"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { saveHandover } from "@/lib/db/actions";
import { useJobs } from "@/hooks/use-data";
import { todayKey } from "@/lib/format";
import { JOB_TYPE_LABELS } from "@/lib/constants";
import type { Handover } from "@/lib/types";

/**
 * Procesul-verbal pornește de la lucrare: clientul, adresa și descrierea vin
 * de acolo, ca omul să nu scrie de două ori ce a scris deja.
 */
export function HandoverDialog({
  open,
  onOpenChange,
  jobId,
  handover,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  handover?: Handover | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <HandoverForm
          jobId={jobId}
          handover={handover}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function HandoverForm({
  jobId,
  handover,
  onOpenChange,
}: {
  jobId: string;
  handover?: Handover | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const jobs = useJobs();
  const job = jobs.find((row) => row.id === jobId);

  const [handedAt, setHandedAt] = useState(handover?.handed_at ?? todayKey());
  const [summary, setSummary] = useState(
    handover?.work_summary ??
      (job ? `${JOB_TYPE_LABELS[job.type]} — ${job.title}` : ""),
  );
  const [warranty, setWarranty] = useState(handover?.warranty_months ?? 24);
  const [notes, setNotes] = useState(handover?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await saveHandover({
        id: handover?.id,
        job_id: jobId,
        handed_at: handedAt,
        work_summary: summary,
        warranty_months: warranty || null,
        notes,
      });
      if (!saved) {
        toast.error("Procesul-verbal nu a putut fi creat");
        return;
      }
      toast.success(handover ? "Proces-verbal actualizat" : "Proces-verbal creat");
      onOpenChange(false);
      if (!handover) router.push(`/predare/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {handover ? "Editează procesul-verbal" : "Proces-verbal de predare"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-3.5">
        <FieldRow>
          <Field label="Data predării" htmlFor="handover-date">
            <Input
              id="handover-date"
              type="date"
              value={handedAt}
              onChange={(event) => setHandedAt(event.target.value)}
            />
          </Field>
          <Field label="Garanție" htmlFor="handover-warranty">
            <NumberInput
              id="handover-warranty"
              value={warranty}
              onChange={setWarranty}
              step={6}
              suffix="luni"
            />
          </Field>
        </FieldRow>

        <Field
          label="S-au executat"
          htmlFor="handover-summary"
          hint="Ce scrie aici ajunge pe hârtia semnată de client"
        >
          <Textarea
            id="handover-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Montaj scară stejar, 15 trepte, balustradă..."
          />
        </Field>

        <Field label="Observații" htmlFor="handover-notes">
          <Textarea
            id="handover-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ce nu intră în garanție, recomandări de întreținere..."
          />
        </Field>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anulează
          </Button>
          <Button type="submit" loading={saving}>
            {handover ? "Salvează" : "Creează"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
