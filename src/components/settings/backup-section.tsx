"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, History, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { importData } from "@/lib/db/actions";
import {
  backupStatus,
  downloadBackup,
  restoreSnapshot,
  snapshots,
  takeSnapshot,
  type BackupStatus,
  type SnapshotMeta,
} from "@/lib/backup";
import { formatDateTime } from "@/lib/format";

/**
 * Backup: fișierul descărcat și copiile locale.
 *
 * Două lucruri diferite, deși poartă același nume. Copia locală, luată singură
 * o dată pe zi, te scoate dintr-un import greșit. Fișierul descărcat e singurul
 * care supraviețuiește telefonului pierdut — de aceea apare mai întâi, cu
 * data ultimei descărcări la vedere.
 */
export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [copies, setCopies] = useState<SnapshotMeta[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [next, list] = await Promise.all([backupStatus(), snapshots()]);
    setStatus(next);
    setCopies(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([backupStatus(), snapshots()]).then(([next, list]) => {
      if (cancelled) return;
      setStatus(next);
      setCopies(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      await downloadBackup();
      await refresh();
      toast.success("Backup descărcat", {
        description: "Pune-l undeva în afara telefonului: mail, drive, laptop.",
      });
    } catch {
      toast.error("Backup-ul n-a putut fi creat");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        // O copie locală chiar înainte de import: dacă fișierul nu era cel
        // bun, drumul înapoi există.
        await takeSnapshot(true);
        const text = await file.text();
        const count = await importData(JSON.parse(text));
        await refresh();
        toast.success(`${count} înregistrări importate`);
      } catch {
        toast.error("Fișierul nu a putut fi citit");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <section className="space-y-3 rounded-2xl surface p-4">
      <h3 className="text-sm font-semibold">Backup</h3>
      <p className="text-xs text-muted-foreground">
        {status?.lastDownload
          ? `Ultimul fișier descărcat: ${formatDateTime(status.lastDownload)}.`
          : "N-ai descărcat încă niciun fișier."}{" "}
        Fișierul e singurul care rămâne dacă pierzi telefonul.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => void download()} disabled={busy}>
          <Download /> Export
        </Button>
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload /> Import
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />

      <div className="space-y-2 border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="size-3.5" /> Copii locale, luate singure o dată pe
          zi. Stau pe acest telefon.
        </p>
        {copies.length ? (
          <ul className="space-y-1.5">
            {copies.map((copy) => (
              <li
                key={copy.at}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2"
              >
                <span className="min-w-0 text-xs">
                  <span className="block truncate">{formatDateTime(copy.at)}</span>
                  <span className="text-muted-foreground">
                    {copy.rows} înregistrări
                  </span>
                </span>
                <Confirm
                  title="Revii la această copie?"
                  description="Datele din copie se adaugă peste cele de acum. Ce ai creat între timp și nu e în copie rămâne pe loc."
                  confirmLabel="Revino"
                  onConfirm={async () => {
                    try {
                      const count = await restoreSnapshot(copy.at);
                      toast.success(`${count} înregistrări restaurate`);
                    } catch {
                      toast.error("Copia nu a putut fi citită");
                    }
                  }}
                >
                  <Button variant="ghost" size="sm">
                    <RotateCcw /> Revino
                  </Button>
                </Confirm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Prima copie se ia după ce ai ceva de salvat.
          </p>
        )}
      </div>
    </section>
  );
}
