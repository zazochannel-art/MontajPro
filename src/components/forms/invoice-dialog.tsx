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
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveInvoice } from "@/lib/db/actions";
import { useClients, useJobs } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { addDaysToKey, formatMoney, todayKey } from "@/lib/format";
import type { Invoice } from "@/lib/types";

/** Factura pornește de la o lucrare: prețul și clientul vin de acolo. */
export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  defaultJobId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  defaultJobId?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <InvoiceForm
          invoice={invoice}
          defaultJobId={defaultJobId}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function InvoiceForm({
  invoice,
  defaultJobId,
  onOpenChange,
}: {
  invoice?: Invoice | null;
  defaultJobId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { currency, settings } = useApp();
  const jobs = useJobs();
  const clients = useClients();

  const initialJob = invoice?.job_id ?? defaultJobId;
  const sourceJob = jobs.find((job) => job.id === initialJob);

  const [jobId, setJobId] = useState<string | null>(initialJob);
  const [clientId, setClientId] = useState<string | null>(
    invoice?.client_id ?? sourceJob?.client_id ?? null,
  );
  const [series, setSeries] = useState(invoice?.series ?? "MP");
  const [issuedAt, setIssuedAt] = useState(invoice?.issued_at ?? todayKey());
  const [dueAt, setDueAt] = useState(
    invoice?.due_at ?? addDaysToKey(todayKey(), 14),
  );
  const [subtotal, setSubtotal] = useState(
    invoice?.subtotal ?? sourceJob?.price_total ?? 0,
  );
  const [vat, setVat] = useState(
    invoice?.vat_percent ?? settings?.vat_percent ?? 0,
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const total = Math.round(subtotal * (1 + vat / 100) * 100) / 100;

  /** Alegerea lucrării completează clientul și suma. */
  const pickJob = (value: string) => {
    const id = value === "none" ? null : value;
    setJobId(id);
    const job = jobs.find((row) => row.id === id);
    if (job) {
      setClientId(job.client_id);
      setSubtotal(job.price_total);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (subtotal <= 0) {
      toast.error("Suma trebuie să fie mai mare ca 0");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveInvoice({
        id: invoice?.id,
        job_id: jobId,
        client_id: clientId,
        series,
        issued_at: issuedAt,
        due_at: dueAt,
        subtotal,
        vat_percent: vat,
        notes,
        paid_at: invoice?.paid_at ?? null,
      });
      toast.success(invoice ? "Factură actualizată" : "Factură creată");
      onOpenChange(false);
      if (saved && !invoice) router.push(`/facturi/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {invoice ? "Editează factura" : "Factură nouă"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Lucrare" hint="Completează clientul și suma">
          <Select value={jobId ?? "none"} onValueChange={pickJob}>
            <SelectTrigger>
              <SelectValue placeholder="Fără lucrare" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Fără lucrare</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Client">
          <Select
            value={clientId ?? "none"}
            onValueChange={(value) =>
              setClientId(value === "none" ? null : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Fără client" />
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
        </Field>

        <FieldRow>
          <Field label="Serie" htmlFor="invoice-series">
            <Input
              id="invoice-series"
              value={series}
              onChange={(event) => setSeries(event.target.value.toUpperCase())}
              maxLength={6}
            />
          </Field>
          <Field label="Data" htmlFor="invoice-date">
            <Input
              id="invoice-date"
              type="date"
              value={issuedAt}
              onChange={(event) => setIssuedAt(event.target.value)}
            />
          </Field>
        </FieldRow>

        <Field label="Scadență" htmlFor="invoice-due">
          <Input
            id="invoice-due"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </Field>

        <Field label="Sumă fără TVA" htmlFor="invoice-subtotal">
          <MoneyInput
            id="invoice-subtotal"
            value={subtotal}
            onChange={setSubtotal}
            currency={currency}
          />
        </Field>

        <Field label="TVA" htmlFor="invoice-vat">
          <NumberInput
            id="invoice-vat"
            value={vat}
            onChange={setVat}
            step={1}
            suffix="%"
          />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-background p-3.5">
          <span className="text-sm text-muted-foreground">Total de plată</span>
          <span className="text-lg font-bold tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </div>

        <Field label="Notițe" htmlFor="invoice-notes">
          <Textarea
            id="invoice-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Condiții de plată, detalii bancare..."
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
            Salvează
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
