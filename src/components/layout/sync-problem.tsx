"use client";

import { useState } from "react";
import { RefreshCw, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-provider";

/**
 * De ce n-a mers sincronizarea.
 *
 * Mesajul venea de la server de la bun început — `syncNow` îl punea pe starea
 * sincronizării — dar nu-l afișa nimeni. Insigna se făcea roșie și atât, iar
 * tu nu aveai cum ști dacă e semnalul, sesiunea expirată sau altceva.
 *
 * Bara stă până se repară sau până o închizi tu: o eroare de sincronizare
 * care dispare singură după trei secunde e o eroare pe care n-ai citit-o.
 */
export function SyncProblem() {
  const { syncStatus, syncError, sync, online } = useApp();
  const [hidden, setHidden] = useState<string | null>(null);

  if (syncStatus !== "error" || !syncError) return null;
  // Închisă o dată, rămâne închisă cât timp e aceeași eroare. Una nouă are
  // altceva de spus, deci se arată din nou.
  if (hidden === syncError) return null;

  return (
    <div className="no-print mx-3 mb-3 space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:mx-4 lg:mx-8">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-200">
            Datele n-au ajuns în cloud
          </p>
          {/*
            * Mesajul brut de la server, nu o traducere aproximativă: dacă
            * ceri ajutor, ăsta e rândul care spune ce s-a întâmplat.
            */}
          <p className="mt-0.5 break-words text-xs text-red-200/80">{syncError}</p>
          <p className="mt-1 text-xs text-red-200/70">
            Lucrările sunt în siguranță pe telefon și pleacă singure la
            următoarea încercare reușită.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(syncError)}
          aria-label="Închide"
          className="shrink-0 rounded-lg p-1 text-red-200/70 transition-colors hover:bg-red-500/15 hover:text-red-200"
        >
          <X className="size-4" />
        </button>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={!online}
        onClick={() => void sync()}
      >
        <RefreshCw /> Încearcă din nou
      </Button>
    </div>
  );
}
