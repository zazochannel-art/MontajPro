"use client";

import { useState } from "react";
import { CalendarClock, Check, Plus, Trash2, Undo2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Confirm } from "@/components/ui/confirm";
import { useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import {
  deleteInstallment,
  planInstallments,
  saveInstallment,
  settleInstallment,
  unsettleInstallment,
} from "@/lib/db/actions";
import { formatDate, formatMoney, todayKey } from "@/lib/format";
import { daysUntil } from "@/lib/calc";
import type { Job } from "@/lib/types";

/**
 * Scadențarul lucrării.
 *
 * „Avans” și „rest” nu descriu cum vin banii în realitate: la semnare, la
 * comanda materialului, la predare. Tranșele sunt un plan; încasarea rămâne o
 * plată adevărată, iar legătura dintre ele spune care plan s-a împlinit.
 */
export function Installments({ job }: { job: Job }) {
  const { currency } = useApp();
  const rows = useTable("installments")
    .filter((row) => row.job_id === job.id)
    .sort((a, b) => a.position - b.position);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const planned = rows.reduce((acc, row) => acc + row.amount, 0);
  const settled = rows
    .filter((row) => row.payment_id)
    .reduce((acc, row) => acc + row.amount, 0);

  const add = async () => {
    if (amount <= 0) {
      toast.error("Pune o sumă");
      return;
    }
    setBusy(true);
    try {
      await saveInstallment({
        job_id: job.id,
        label: label || "Tranșă",
        amount,
        due_date: dueDate || null,
      });
      setLabel("");
      setAmount(0);
      setDueDate("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4 text-primary" /> Scadențar
        </h3>
        {rows.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatMoney(settled, currency)} din {formatMoney(planned, currency)}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            Nicio tranșă planificată. Fără ele, îți amintești tu când e de cerut
            banii.
          </p>
          {job.price_total > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={async () => {
                const added = await planInstallments(job.id);
                if (added) toast.success("Scadențar propus — editează-l cum vrei");
              }}
            >
              <Wand2 /> Împarte în 30% / 40% / 30%
            </Button>
          )}
        </>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const days = row.due_date ? daysUntil(row.due_date) : null;
            const late = !row.payment_id && days !== null && days < 0;
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.due_date ? formatDate(row.due_date) : "fără termen"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(row.amount, currency)}
                </span>
                {row.payment_id ? (
                  <>
                    <Badge variant="success">Încasată</Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Anulează încasarea pentru ${row.label}`}
                      onClick={async () => {
                        await unsettleInstallment(row.id);
                        toast.success("Încasare anulată");
                      }}
                    >
                      <Undo2 className="text-muted-foreground" />
                    </Button>
                  </>
                ) : (
                  <>
                    {late && <Badge variant="warning">Întârziată</Badge>}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await settleInstallment(row.id, {
                          method: "cash",
                          paid_at: todayKey(),
                        });
                        toast.success("Încasare înregistrată");
                      }}
                    >
                      <Check /> Am luat
                    </Button>
                    <Confirm
                      title="Ștergi tranșa?"
                      onConfirm={() => deleteInstallment(row.id)}
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Șterge ${row.label}`}
                      >
                        <Trash2 className="text-red-400" />
                      </Button>
                    </Confirm>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <FieldRow>
          <Field label="Tranșă" htmlFor="installment-label">
            <Input
              id="installment-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="La predare"
            />
          </Field>
          <Field label="Sumă" htmlFor="installment-amount">
            <MoneyInput
              id="installment-amount"
              value={amount}
              onChange={setAmount}
              currency={currency}
            />
          </Field>
        </FieldRow>
        <Field label="Scadență" htmlFor="installment-due">
          <Input
            id="installment-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>
        <Button variant="outline" size="sm" loading={busy} onClick={add}>
          <Plus /> Adaugă tranșă
        </Button>
      </div>
    </section>
  );
}
