"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { shareJob, unshareJob } from "@/lib/db/actions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Job } from "@/lib/types";

/**
 * Linkul prin care clientul își vede lucrarea.
 *
 * „Unde sunteți?” se sună fiindcă omul n-are de unde ști. Linkul îi arată
 * când e programată, dacă s-a început, ce pași s-au făcut și pozele — și
 * nimic despre bani, fiindcă funcția din bază nici nu le trimite.
 *
 * Oprirea nu e cosmetică: fără token, funcția nu mai întoarce nimic, iar
 * pozele se închid la loc în aceeași clipă.
 */
export function ShareJob({ job }: { job: Job }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isSupabaseConfigured) return null;

  const url =
    job.public_token && typeof window !== "undefined"
      ? `${window.location.origin}/lucrare/${job.public_token}`
      : null;

  const start = async () => {
    setBusy(true);
    try {
      const token = await shareJob(job.id);
      if (!token) return toast.error("Nu s-a putut face linkul");
      const link = `${window.location.origin}/lucrare/${token}`;
      const text = `Puteți urmări lucrarea „${job.title}” aici: ${link}`;
      try {
        if (navigator.share) await navigator.share({ title: job.title, text });
        else {
          await navigator.clipboard.writeText(link);
          toast.success("Link copiat — trimite-i-l clientului");
        }
      } catch {
        // Partajare anulată; tokenul rămâne făcut, linkul se vede mai jos.
      }
    } finally {
      setBusy(false);
    }
  };

  if (!url) {
    return (
      <Button variant="outline" className="w-full" loading={busy} onClick={start}>
        <Eye /> Arată-i clientului lucrarea
      </Button>
    );
  }

  return (
    <section className="space-y-2.5 rounded-2xl surface p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4 text-primary" /> Clientul vede lucrarea
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cât e programată, ce s-a făcut și pozele. Fără prețuri.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-elevated px-2.5 py-2 text-[11px] text-muted-foreground">
          {url}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Link copiat");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copiat" : "Copiază"}
        </Button>
      </div>

      <Confirm
        title="Oprești linkul?"
        description="Clientul nu va mai putea deschide pagina, iar pozele se închid la loc."
        onConfirm={async () => {
          await unshareJob(job.id);
          toast.success("Link oprit");
        }}
      >
        <Button variant="outline" size="sm">
          <EyeOff /> Oprește linkul
        </Button>
      </Confirm>
    </section>
  );
}
