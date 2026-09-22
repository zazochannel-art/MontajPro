"use client";

import { useState } from "react";
import { CalendarClock, Check, Copy, ImageIcon, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { useApp } from "@/lib/app-provider";
import { setPublicLink, updateSettings } from "@/lib/db/actions";
import { useAllJobs } from "@/hooks/use-data";

/**
 * Linkurile pe care le dai altora.
 *
 * Amândouă se opresc dintr-o apăsare, iar oprirea nu e cosmetică: fără token,
 * funcția din bază nu mai întoarce nimic, iar pozele portofoliului se închid la
 * loc în aceeași clipă.
 */
export function PublicLinks() {
  const { settings } = useApp();
  const jobs = useAllJobs();
  const inPortfolio = jobs.filter((job) => job.in_portfolio && !job.deleted_at).length;

  if (!settings) return null;

  return (
    <section className="space-y-4 rounded-2xl surface p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4 text-primary" /> Linkuri publice
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cine are linkul vede; cine nu, nu. Oprindu-l, linkul moare pe loc.
        </p>
      </div>

      <LinkRow
        icon={ImageIcon}
        title="Portofoliul"
        hint={
          inPortfolio
            ? `${inPortfolio} ${inPortfolio === 1 ? "lucrare marcată" : "lucrări marcate"} pentru portofoliu.`
            : "Nicio lucrare marcată încă. Bifează „în portofoliu” pe lucrările finalizate."
        }
        token={settings.portfolio_token}
        path="lucrari-publice"
        onToggle={(on) => setPublicLink("portfolio_token", on)}
      />

      {settings.portfolio_token && (
        <Field label="Un rând despre tine" hint="Apare sub nume, pe pagina publică.">
          <Textarea
            value={settings.portfolio_intro ?? ""}
            onChange={(event) =>
              void updateSettings({ portfolio_intro: event.target.value })
            }
            placeholder="Montez scări, parchet și plinte de zece ani, în Chișinău și împrejurimi."
          />
        </Field>
      )}

      <LinkRow
        icon={CalendarClock}
        title="Calendarul"
        hint="Se abonează o dată, apoi lucrările apar singure în agenda telefonului. Fără prețuri și fără clienți."
        token={settings.calendar_token}
        path="api/calendar"
        onToggle={(on) => setPublicLink("calendar_token", on)}
      />
    </section>
  );
}

function LinkRow({
  icon: Icon,
  title,
  hint,
  token,
  path,
  onToggle,
}: {
  icon: typeof Link2;
  title: string;
  hint: string;
  token: string | null;
  path: string;
  onToggle: (on: boolean) => Promise<string | null>;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/${path}/${token}`
      : "";

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Icon className="size-4 text-muted-foreground" /> {title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Switch
          checked={!!token}
          onCheckedChange={(on) => {
            void onToggle(on).then(() => {
              toast.success(on ? "Link pornit" : "Link oprit");
            });
          }}
          aria-label={`Pornește linkul pentru ${title.toLowerCase()}`}
        />
      </div>

      {url && (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-elevated px-2.5 py-2 text-[11px] text-muted-foreground">
            {url}
          </code>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Copiază linkul"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                toast.success("Link copiat");
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                toast.error("Nu s-a putut copia");
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      )}
    </div>
  );
}
