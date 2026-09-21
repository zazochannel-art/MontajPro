"use client";

import {
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/lib/app-provider";
import { cn } from "@/lib/utils";

/**
 * Indicatorul de sincronizare. Pe șantier contează să vezi dintr-o privire
 * dacă datele au ajuns în cloud sau așteaptă semnal.
 */
export function SyncBadge({ className }: { className?: string }) {
  const { syncStatus, pendingChanges, online, sync, mode } = useApp();

  const state = !online
    ? {
        icon: WifiOff,
        label: pendingChanges ? `${pendingChanges} în așteptare` : "Offline",
        tone: "text-amber-300",
      }
    : mode === "local"
      ? { icon: CloudOff, label: "Mod local", tone: "text-muted-foreground" }
      : syncStatus === "syncing"
        ? { icon: Loader2, label: "Se sincronizează", tone: "text-primary" }
        : syncStatus === "error"
          ? {
              icon: TriangleAlert,
              label: "Eroare sincronizare",
              tone: "text-red-300",
            }
          : pendingChanges > 0
            ? {
                icon: RefreshCw,
                label: `${pendingChanges} de trimis`,
                tone: "text-amber-300",
              }
            : { icon: Check, label: "Sincronizat", tone: "text-emerald-300" };

  const Icon = state.icon;

  return (
    <button
      type="button"
      onClick={() => void sync()}
      title={state.label}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium shadow-[var(--lift)] transition-[background-color,border-color,transform] duration-[--dur-1] ease-[--ease-out] hover:border-border-strong hover:bg-accent active:scale-95",
        state.tone,
        className,
      )}
    >
      {syncStatus === "syncing" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-current opacity-10 [animation:breathe_1.6s_ease-in-out_infinite]"
        />
      )}
      <Icon
        className={cn("size-3.5", syncStatus === "syncing" && "animate-spin")}
      />
      <span className="hidden sm:inline">{state.label}</span>
    </button>
  );
}
