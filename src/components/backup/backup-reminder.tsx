"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-provider";
import {
  backupStatus,
  downloadBackup,
  snoozeReminder,
  type BackupStatus,
} from "@/lib/backup";

/**
 * Mementoul de backup.
 *
 * Copia locală o face aplicația singură, dar ea stă pe același telefon: dacă
 * telefonul se pierde, se pierde cu tot cu ea. Singurul lucru care scapă de
 * asta e un fișier descărcat, iar browserul nu descarcă fără o apăsare de om.
 * De aceea aplicația întreabă — o dată la două săptămâni, și se poate amâna.
 */
export function BackupReminder() {
  const { ready, mode } = useApp();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void backupStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      await downloadBackup();
      setStatus(await backupStatus());
      toast.success("Backup descărcat", {
        description: "Ține-l undeva în afara telefonului: mail, drive, laptop.",
      });
    } catch {
      toast.error("Backup-ul n-a putut fi creat");
    } finally {
      setBusy(false);
    }
  }, []);

  const later = useCallback(async () => {
    await snoozeReminder();
    setStatus(await backupStatus());
  }, []);

  if (!status?.due) return null;

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold">Fă-ți o copie a datelor</p>
          <p className="text-xs text-muted-foreground">
            {status.lastDownload
              ? `Ultimul backup descărcat a fost acum ${status.days} zile.`
              : "N-ai descărcat încă niciun backup."}{" "}
            {mode === "local"
              ? "Datele stau doar pe acest telefon."
              : "Un fișier descărcat te scapă și de o greșeală de sincronizare."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void download()} disabled={busy}>
            Descarcă acum
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void later()}>
            <X /> Mai târziu
          </Button>
        </div>
      </div>
    </section>
  );
}
