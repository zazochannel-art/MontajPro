"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  FlaskConical,
  Hammer,
  Smartphone,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-provider";
import { useTable } from "@/hooks/use-data";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { metaGet, metaSet } from "@/lib/db/idb";
import { hasDemoData, seedDemoData } from "@/lib/db/demo";

const DISMISS_KEY = "onboarding:dismissed";

interface Step {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  href: string;
  done: boolean;
}

/**
 * Primii pași, pe un cont gol.
 *
 * Aplicația are douăzeci și ceva de pagini. Pe un cont nou toate sunt goale,
 * iar omul nu are de unde să știe cu care începe — așa că i le arătăm pe
 * primele patru, în ordinea în care contează: cine ești (apare pe ofertă), cu
 * cât lucrezi (fără asta calculatorul nu spune nimic), primul client, prima
 * lucrare.
 *
 * Cardul dispare singur când pașii sunt gata. Nu insistă: se poate închide.
 */
export function FirstRun() {
  const { settings, ready } = useApp();
  const clients = useTable("clients");
  const jobs = useTable("jobs");
  const { canInstall, installed, isIOS, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void metaGet<boolean>(DISMISS_KEY).then((value) => {
      if (!cancelled) setDismissed(Boolean(value));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(async () => {
    await metaSet(DISMISS_KEY, true);
    setDismissed(true);
  }, []);

  const demo = useCallback(async () => {
    setBusy(true);
    try {
      await seedDemoData();
      toast.success("Date demo încărcate", {
        description: "Sunt marcate ca demo și le poți șterge din Setări.",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  if (!ready || !settings || dismissed !== false) return null;

  const rates = settings.default_rates;
  const hasRates = Object.values(rates ?? {}).some((value) => Number(value) > 0);

  const steps: Step[] = [
    {
      id: "profil",
      label: "Completează-ți datele",
      hint: "Numele și telefonul tău apar pe ofertă și pe factură.",
      icon: User,
      href: "/setari",
      done: Boolean(settings.full_name || settings.company),
    },
    {
      id: "tarife",
      label: "Pune-ți tarifele",
      hint: "Cât iei pe treaptă, pe m², pe metru liniar și pe oră.",
      icon: Wallet,
      href: "/setari",
      done: hasRates,
    },
    {
      id: "client",
      label: "Adaugă primul client",
      hint: "Nume și telefon — restul se completează pe parcurs.",
      icon: Users,
      href: "/clienti",
      done: clients.length > 0,
    },
    {
      id: "lucrare",
      label: "Deschide prima lucrare",
      hint: "De aici pornesc măsurătorile, pozele, materialele și banii.",
      icon: Hammer,
      href: "/lucrari/nou",
      done: jobs.length > 0,
    },
  ];

  if ((canInstall || isIOS) && !installed) {
    steps.push({
      id: "instalare",
      label: "Pune aplicația pe ecranul principal",
      hint: isIOS
        ? "Din Safari: Partajează → Adaugă pe ecranul principal."
        : "Se deschide ca o aplicație și merge și fără internet.",
      icon: Smartphone,
      href: "/setari",
      done: false,
    });
  }

  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  const next = steps.find((step) => !step.done);
  const emptyAccount = !clients.length && !jobs.length && !hasDemoData();

  return (
    <section className="surface relative space-y-3 overflow-hidden rounded-2xl p-4 pl-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Hai să pornim</h3>
          <p className="text-xs text-muted-foreground">
            {doneCount} din {steps.length} — durează câteva minute.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void dismiss()}
          aria-label="Ascunde primii pași"
        >
          <X />
        </Button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((step) => {
          const Icon = step.icon;
          const isNext = step.id === next?.id;
          const body = (
            <>
              <span
                className={
                  step.done
                    ? "flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"
                    : "flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                }
              >
                {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={
                    step.done
                      ? "block text-sm text-muted-foreground line-through"
                      : "block text-sm font-medium"
                  }
                >
                  {step.label}
                </span>
                {isNext && (
                  <span className="block text-xs text-muted-foreground">{step.hint}</span>
                )}
              </span>
              {!step.done && (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );

          if (step.done) {
            return (
              <li key={step.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                {body}
              </li>
            );
          }

          if (step.id === "instalare" && canInstall) {
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => void install()}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-muted/60"
                >
                  {body}
                </button>
              </li>
            );
          }

          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/60"
              >
                {body}
              </Link>
            </li>
          );
        })}
      </ul>

      {emptyAccount && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => void demo()}
          disabled={busy}
        >
          <FlaskConical /> Vezi cum arată cu date de test
        </Button>
      )}
    </section>
  );
}
