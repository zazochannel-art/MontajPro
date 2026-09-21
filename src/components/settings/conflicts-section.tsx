"use client";

import { useCallback, useEffect, useState } from "react";
import { GitMerge, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  applyConflict,
  dismissConflict,
  listConflicts,
  type Conflict,
} from "@/lib/conflicts";
import { TRASH_LABELS } from "@/lib/trash";
import { formatDateTime } from "@/lib/format";

/** Cum se cheamă rândul, fără să-l căutăm în store. */
function titleOf(conflict: Conflict): string {
  const row = conflict.remote;
  for (const key of ["title", "name", "label", "client_name"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return TRASH_LABELS[conflict.table] ?? conflict.table;
}

/**
 * Ciocnirile de sincronizare.
 *
 * Secțiunea apare doar când există ceva: pe un singur telefon nu se ciocnește
 * nimic niciodată, iar un titlu gol în Setări ar fi o întrebare fără răspuns.
 */
export function ConflictsSection() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setConflicts(await listConflicts());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listConflicts().then((list) => {
      if (!cancelled) setConflicts(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!conflicts.length) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <GitMerge className="size-4 text-amber-300" /> Modificări neaplicate
      </h3>
      <p className="text-xs text-muted-foreground">
        Ai schimbat aceleași lucruri pe două dispozitive. Am păstrat ce ai scris
        aici, dar versiunea venită de pe celălalt n-a dispărut — o poți lua.
      </p>

      <ul className="space-y-2">
        {conflicts.map((conflict) => (
          <li
            key={`${conflict.table}:${conflict.id}`}
            className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2"
          >
            <span className="min-w-0 flex-1 text-xs">
              <span className="block truncate font-medium">
                {TRASH_LABELS[conflict.table] ?? conflict.table}: {titleOf(conflict)}
              </span>
              <span className="text-muted-foreground">
                {formatDateTime(conflict.at)}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await applyConflict(conflict.table, conflict.id);
                  await refresh();
                  toast.success("Versiunea de pe celălalt dispozitiv a fost luată");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ia-o
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Renunță la versiunea de pe celălalt dispozitiv"
              disabled={busy}
              onClick={async () => {
                await dismissConflict(conflict.table, conflict.id);
                await refresh();
              }}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
