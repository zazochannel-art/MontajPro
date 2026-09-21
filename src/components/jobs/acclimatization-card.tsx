"use client";

import { Thermometer, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acclimatizationFor, DEFAULT_HOURS } from "@/lib/acclimatization";
import { updateJob } from "@/lib/db/actions";
import { useApp } from "@/lib/app-provider";
import { useMinuteTick } from "@/hooks/use-data";
import type { Job } from "@/lib/types";

const WEEKDAYS = [
  "duminică",
  "luni",
  "marți",
  "miercuri",
  "joi",
  "vineri",
  "sâmbătă",
];

/** „joi la 14:00” — cum spune omul, nu cum scrie calendarul. */
function whenText(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${WEEKDAYS[date.getDay()]} la ${hh}:${mm}`;
}

/**
 * Ceasul de aclimatizare, pe lucrare.
 *
 * Apare doar la parchet: scara și plintele nu au nevoie să stea în cameră.
 * Cât timp nu s-a adus nimic, e un singur buton; după, e un răspuns.
 */
export function AcclimatizationCard({ job }: { job: Job }) {
  const { settings } = useApp();
  // Reîmprospătează singur textul, ca „mai sunt 3 ore" să nu rămână în urmă.
  useMinuteTick();

  if (job.type !== "parquet") return null;

  const hours = settings?.acclimatization_hours ?? DEFAULT_HOURS;
  const state = acclimatizationFor(job, hours);

  if (!state) {
    return (
      <div className="surface rounded-2xl p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Thermometer className="size-4 text-sky-300" />
          Aclimatizarea materialului
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Parchetul trebuie să stea {hours} de ore în camera în care se
          montează. Montat prea devreme, se umflă peste câteva luni.
        </p>
        <Button
          variant="outline"
          className="mt-3 w-full"
          onClick={async () => {
            await updateJob(job.id, {
              material_delivered_at: new Date().toISOString(),
            });
            toast.success("Am pornit ceasul");
          }}
        >
          Materialul a ajuns la client
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 surface ${
        state.ready ? "" : ""
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${
          state.ready ? "bg-emerald-500" : "bg-sky-500"
        }`}
      />
      <p className="flex items-center gap-2 pl-1 text-sm font-semibold">
        <Thermometer
          className={`size-4 ${state.ready ? "text-emerald-300" : "text-sky-300"}`}
        />
        {state.ready ? "Materialul e gata de montat" : "Materialul se aclimatizează"}
      </p>

      <p className="mt-1 pl-1 text-xs text-muted-foreground">
        {state.ready
          ? `A stat cele ${hours} de ore cerute. Poți monta.`
          : `Poți monta de ${whenText(state.readyAt)} — mai sunt ${state.hoursLeft} ${
              state.hoursLeft === 1 ? "oră" : "ore"
            }.`}
      </p>

      <button
        type="button"
        onClick={async () => {
          await updateJob(job.id, { material_delivered_at: null });
          toast.success("Am șters ceasul");
        }}
        className="mt-2 inline-flex items-center gap-1.5 pl-1 text-[11px] text-muted-foreground underline-offset-4 hover:underline"
      >
        <Undo2 className="size-3" /> Nu, n-a ajuns încă
      </button>
    </div>
  );
}
