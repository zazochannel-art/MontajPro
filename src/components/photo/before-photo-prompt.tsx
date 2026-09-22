"use client";

import { Camera, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/components/photo/photo-input";
import { addPhoto } from "@/lib/db/actions";

/**
 * Poza „înainte”, cerută fix când contează.
 *
 * Poze se puteau face și până acum; ce lipsea era cineva care să-ți amintească
 * în clipa în care pui mâna pe scule. Peste o lună, când clientul spune că
 * ușa era întreagă, zece secunde de acum valorează cât toată discuția.
 *
 * Nu blochează nimic: cronometrul a pornit deja, iar „Mai târziu” închide
 * fereastra fără nicio urmare.
 */
export function BeforePhotoPrompt({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!jobId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fă o poză înainte să începi</DialogTitle>
          <DialogDescription>
            Peretele deja zgâriat, parchetul vechi umflat, ușa lovită. Zece
            secunde acum, și peste o lună nu mai e nimic de discutat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <PhotoInput
            folder={`jobs/${jobId}`}
            multiple
            variant="button"
            label="Deschide camera"
            onCaptured={async (asset) => {
              await addPhoto({
                job_id: jobId,
                stage: "before",
                storage_path: asset.storage_path,
                local_key: asset.local_key,
              });
              // Poza e făcută, omul are treabă: fereastra pleacă singură.
              onOpenChange(false);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            <X /> Mai târziu
          </Button>
        </div>

        <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <Camera className="mt-0.5 size-3.5 shrink-0" />
          Poza intră la „Înainte” pe lucrare. Întrebarea nu se mai pune odată ce
          lucrarea are una.
        </p>
      </DialogContent>
    </Dialog>
  );
}
