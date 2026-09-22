"use client";

import { useState } from "react";
import { HardHat, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/number-input";
import { Field } from "@/components/ui/field";
import { useApp } from "@/lib/app-provider";
import { useCrewLedger } from "@/hooks/use-data";
import { payCrewMember } from "@/lib/db/actions";
import { formatDuration, formatMoney } from "@/lib/format";
import { totalOwed } from "@/lib/crew";
import type { CrewLine } from "@/lib/crew";

/**
 * Cât îi datorezi echipei.
 *
 * Nu e un raport, e o listă de plătit: omul căruia îi datorezi cel mai mult
 * stă primul. Cine n-are tarif pus apare cu orele lui și cu zero lei — cifra
 * lipsă se vede, în loc să fie ghicită.
 */
export function CrewLedger() {
  const { currency } = useApp();
  const lines = useCrewLedger();
  const [paying, setPaying] = useState<CrewLine | null>(null);

  if (!lines.length) return null;
  const owed = totalOwed(lines);

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-semibold">Echipa</h2>
        {owed > 0 && (
          <p className="text-sm font-semibold tabular-nums text-amber-300">
            {formatMoney(owed, currency)} de dat
          </p>
        )}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl surface">
        {lines.map((line) => (
          <div key={line.member_id} className="flex items-center gap-3 p-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted-foreground">
              <HardHat className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{line.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(line.minutes)}
                {line.rate > 0 ? (
                  <> · {formatMoney(line.rate, currency)}/oră</>
                ) : (
                  <> · fără tarif pus</>
                )}
                {line.paid > 0 && <> · dat {formatMoney(line.paid, currency)}</>}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={`font-semibold tabular-nums ${
                  line.owed > 0 ? "text-amber-300" : "text-muted-foreground"
                }`}
              >
                {formatMoney(line.owed, currency)}
              </p>
              {line.owed > 0 && (
                <button
                  type="button"
                  onClick={() => setPaying(line)}
                  className="text-[11px] text-primary underline-offset-4 hover:underline"
                >
                  Plătește
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {lines.some((line) => line.rate <= 0) && (
        <p className="text-xs text-muted-foreground">
          Pune tarifele în Setări → Echipă, ca orele să se transforme în bani și
          să intre în profitul lucrărilor.
        </p>
      )}

      <PayDialog
        line={paying}
        currency={currency}
        onClose={() => setPaying(null)}
      />
    </section>
  );
}

function PayDialog({
  line,
  currency,
  onClose,
}: {
  line: CrewLine | null;
  currency: string;
  onClose: () => void;
}) {
  // Suma pornește de la cât datorezi, dar se poate schimba: plățile parțiale
  // sunt regula, nu excepția.
  const [amount, setAmount] = useState(0);

  return (
    <Dialog
      open={!!line}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Plătește {line?.name}</DialogTitle>
          <DialogDescription>
            Intră ca o cheltuială obișnuită, legată de el — nu inventăm un al
            doilea fel de a scoate bani din buzunar.
          </DialogDescription>
        </DialogHeader>

        <Field label="Suma">
          <MoneyInput
            value={amount || line?.owed || 0}
            onChange={setAmount}
            currency={currency}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button
            onClick={async () => {
              if (!line) return;
              const value = amount || line.owed;
              const row = await payCrewMember({
                member_id: line.member_id,
                member_name: line.name,
                amount: value,
              });
              if (row) {
                toast.success(`${formatMoney(value, currency)} către ${line.name}`);
                setAmount(0);
                onClose();
              }
            }}
          >
            <Wallet /> Am plătit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
