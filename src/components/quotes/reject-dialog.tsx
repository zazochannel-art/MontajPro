"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setQuoteStatus } from "@/lib/db/actions";
import {
  REJECT_REASONS,
  REJECT_REASON_LABELS,
  type RejectReason,
} from "@/lib/quote-stats";

/**
 * De ce n-a ieșit oferta.
 *
 * Întrebarea se pune o singură dată, în clipa refuzului, cât mai știi
 * răspunsul. Peste o lună, când te uiți în rapoarte, „prea scump” de cinci
 * ori la rând îți spune ce să faci; „refuzată” de cinci ori nu spune nimic.
 *
 * Se poate și sări peste: un motiv inventat e mai rău decât unul lipsă.
 */
export function RejectDialog({
  quoteId,
  open,
  onOpenChange,
}: {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [chosen, setChosen] = useState<RejectReason | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setChosen(null);
    onOpenChange(false);
  };

  const save = async (reason: RejectReason | null) => {
    setSaving(true);
    try {
      await setQuoteStatus(quoteId, "rejected", reason);
      toast.success("Ofertă refuzată");
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>De ce n-a ieșit?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Peste o lună n-o să-ți mai amintești. Iar cinci refuzuri pe același
          motiv îți spun ce să schimbi la a șasea ofertă.
        </p>

        <div className="grid gap-2">
          {REJECT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              aria-pressed={chosen === reason}
              onClick={() => setChosen(reason)}
              className={
                chosen === reason
                  ? "rounded-xl border border-primary/40 bg-primary/12 p-3 text-left text-sm font-medium text-primary transition-transform duration-[--dur-1] active:scale-[0.98]"
                  : "rounded-xl border border-border bg-background p-3 text-left text-sm transition-[background-color,transform] duration-[--dur-1] hover:bg-accent active:scale-[0.98]"
              }
            >
              {REJECT_REASON_LABELS[reason]}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => void save(null)}>
            Fără motiv
          </Button>
          <Button disabled={!chosen} loading={saving} onClick={() => void save(chosen)}>
            Salvează
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
