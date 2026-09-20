"use client";

import { useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/number-input";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { deleteFixedCost, endFixedCost, saveFixedCost } from "@/lib/db/actions";
import { fixedCostsForMonth } from "@/lib/calc";
import { formatDate, formatMoney, todayKey } from "@/lib/format";

/**
 * Cheltuielile care vin în fiecare lună, indiferent de lucrări.
 *
 * Se încheie, nu se șterg: lunile în care chiar le-ai plătit trebuie să rămână
 * cum au fost, altfel profitul de anul trecut s-ar rescrie singur.
 */
export function FixedCosts({ monthKey }: { monthKey: string }) {
  const { currency } = useApp();
  const costs = useTable("fixed_costs");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  const thisMonth = fixedCostsForMonth(costs, monthKey);
  const sorted = [...costs].sort((a, b) => {
    if (Boolean(a.ended_at) !== Boolean(b.ended_at)) return a.ended_at ? 1 : -1;
    return a.name.localeCompare(b.name, "ro");
  });

  const add = async () => {
    if (!name.trim() || amount <= 0) {
      toast.error("Scrie o denumire și o sumă");
      return;
    }
    setBusy(true);
    try {
      await saveFixedCost({ name, amount, started_at: todayKey() });
      setName("");
      setAmount(0);
      toast.success("Cheltuială fixă adăugată");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Repeat className="size-4 text-primary" /> Pe luna aceasta
          </p>
          <p className="text-xs text-muted-foreground">
            se scad din profitul lunii
          </p>
        </div>
        <p className="text-xl font-bold tabular-nums text-red-300">
          −{formatMoney(thisMonth, currency)}
        </p>
      </div>

      {sorted.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {sorted.map((cost) => (
            <li key={cost.id} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-medium ${cost.ended_at ? "text-muted-foreground line-through" : ""}`}
                >
                  {cost.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  din {formatDate(cost.started_at)}
                  {cost.ended_at ? ` până în ${formatDate(cost.ended_at)}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatMoney(cost.amount, currency)}
              </span>
              {!cost.ended_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await endFixedCost(cost.id, todayKey());
                    toast.success("Încheiată de azi");
                  }}
                >
                  Încheie
                </Button>
              )}
              <Confirm
                title="Ștergi cheltuiala fixă?"
                description="Dispare din toate lunile, inclusiv din cele trecute. Dacă doar te-ai lăsat de ea, folosește „Încheie”."
                onConfirm={async () => {
                  await deleteFixedCost(cost.id);
                  toast.success("Ștearsă");
                }}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Șterge ${cost.name}`}
                >
                  <Trash2 className="text-red-400" />
                </Button>
              </Confirm>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Repeat}
          title="Nicio cheltuială fixă"
          description="Chiria la depozit, leasingul, telefonul, asigurarea — ce plătești în fiecare lună, indiferent de lucrări."
        />
      )}

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <FieldRow>
          <Field label="Denumire" htmlFor="fixed-name">
            <Input
              id="fixed-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Chirie depozit"
            />
          </Field>
          <Field label="Pe lună" htmlFor="fixed-amount">
            <MoneyInput
              id="fixed-amount"
              value={amount}
              onChange={setAmount}
              currency={currency}
            />
          </Field>
        </FieldRow>
        <Button variant="outline" size="sm" loading={busy} onClick={add}>
          <Plus /> Adaugă
        </Button>
      </div>
    </div>
  );
}
