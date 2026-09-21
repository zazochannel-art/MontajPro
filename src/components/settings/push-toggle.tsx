"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  currentPushState,
  disablePush,
  enablePush,
  type PushState,
} from "@/lib/push";

const EXPLANATION: Record<PushState, string> = {
  unsupported:
    "Browserul acesta nu suportă notificări push. Pe iPhone funcționează doar după ce adaugi aplicația pe ecranul principal.",
  "not-configured":
    "Notificările pe telefon cer cheile Supabase și VAPID. Până atunci, notificările apar doar în aplicație.",
  denied:
    "Ai blocat notificările pentru acest site. Le poți debloca din setările browserului.",
  enabled: "Primești notificări pe telefon chiar și cu aplicația închisă.",
  disabled:
    "Activează ca să primești lucrările de mâine și plățile restante pe telefon.",
};

/**
 * Comutatorul pentru notificările push.
 *
 * Starea vine din browser (permisiune + abonament existent), nu din setările
 * contului: același cont pe două telefoane are două răspunsuri diferite.
 */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void currentPushState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async (checked: boolean) => {
    setBusy(true);
    try {
      const next = checked ? await enablePush() : await disablePush();
      setState(next);
      if (next === "enabled") {
        toast.success("Notificări activate");
      } else if (next === "denied") {
        toast.error("Notificările sunt blocate în browser");
      } else if (checked) {
        // Cerere de activare care n-a ajuns la capăt: spunem de ce.
        toast.info(EXPLANATION[next]);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nu am putut activa notificările",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Verific notificările…
      </div>
    );
  }

  const actionable = state === "enabled" || state === "disabled";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="size-4 text-primary" /> Notificări pe telefon
          </p>
          <p className="text-xs text-muted-foreground">{EXPLANATION[state]}</p>
        </div>
        {actionable ? (
          <Switch
            checked={state === "enabled"}
            disabled={busy}
            onCheckedChange={(checked) => void toggle(checked)}
            aria-label="Notificări pe telefon"
          />
        ) : null}
      </div>

      {state === "enabled" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            new Notification("MontCraft", {
              body: "Așa arată o notificare. Mâine dimineață primești programul zilei.",
              icon: "/icons/icon-192.png",
            })
          }
        >
          Trimite una de probă
        </Button>
      )}
    </div>
  );
}
