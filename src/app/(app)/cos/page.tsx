"use client";

import { useState } from "react";
import { Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreReady, useTrash } from "@/hooks/use-data";
import { restoreTrash, TRASH_LABELS } from "@/lib/trash";
import { formatDateTime } from "@/lib/format";

/**
 * Ce s-a șters în ultimele 30 de zile, cu drum înapoi.
 *
 * Ștergerile au fost dintotdeauna logice; lipsea doar butonul.
 */
export default function TrashPage() {
  const ready = useStoreReady();
  const [busy, setBusy] = useState<string | null>(null);

  const items = useTrash(30);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coș"
        description="Ce ai șters în ultimele 30 de zile"
      />

      {!ready ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl surface">
          {items.map((item) => (
            <div
              key={item.at}
              className="flex items-center justify-between gap-3 p-3.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDateTime(item.at)}
                  {item.count > 1 ? ` · ${item.count} rânduri` : ""}
                </p>
              </div>
              <Badge>{TRASH_LABELS[item.table] ?? item.table}</Badge>
              <Button
                variant="outline"
                size="sm"
                loading={busy === item.at}
                onClick={async () => {
                  setBusy(item.at);
                  try {
                    const count = await restoreTrash(item.at);
                    toast.success(
                      count > 1
                        ? `Restaurat, cu ${count} rânduri`
                        : "Restaurat",
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Undo2 /> Restaurează
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Trash2}
          title="Coșul e gol"
          description="Ce ștergi ajunge aici și se poate întoarce vreme de 30 de zile."
        />
      )}

      <p className="text-xs text-muted-foreground">
        Restaurarea aduce înapoi tot ce a fost șters în aceeași clipă — o
        lucrare vine cu măsurătorile, pozele, materialele și plățile ei.
      </p>
    </div>
  );
}
