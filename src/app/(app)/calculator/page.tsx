"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  FileText,
  Hammer,
  History,
  Plus,
  Save,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJobs, useTable } from "@/hooks/use-data";
import { buildJobRows, priceHistory } from "@/lib/reports";
import { useApp } from "@/lib/app-provider";
import { calcTotal, lineTotal, type CalcLine, type CalcSeed } from "@/lib/calc";
import { formatMoney, formatNumber } from "@/lib/format";
import { JOB_TYPE_LABELS } from "@/lib/constants";
import {
  allPositions,
  builtinId,
  CUSTOM_POSITION,
  everyPriceUnset,
  findPosition,
  groupedPositions,
  TRAVEL_UNIT,
  type Position,
} from "@/lib/price-list";
import type { DefaultRates, JobType } from "@/lib/types";
import { updateJob } from "@/lib/db/actions";
import { clearCalcSeed, peekCalcSeed, saveCalcDraft } from "@/lib/calc-draft";
import { uid } from "@/lib/utils";

/**
 * Cantitățile cu care pornește fiecare tip de lucrare. Prețurile nu stau aici:
 * vin din setări, prin pozițiile din `price-list.ts`.
 */
const PRESETS: Record<JobType, { key: keyof DefaultRates; quantity: number }[]> = {
  stairs: [
    { key: "stair_step", quantity: 15 },
    { key: "stair_riser", quantity: 0 },
    { key: "landing", quantity: 1 },
    { key: "railing", quantity: 1 },
  ],
  parquet: [{ key: "parquet_m2", quantity: 85 }],
  plinth: [{ key: "plinth_m", quantity: 75 }],
  other: [],
};

function lineFrom(position: Position | undefined, quantity: number): CalcLine {
  if (!position) {
    return {
      id: uid(),
      item_id: null,
      description: "",
      quantity,
      unit: "buc",
      unit_price: 0,
    };
  }
  return {
    id: uid(),
    item_id: position.id,
    description: position.name,
    quantity,
    unit: position.unit,
    unit_price: position.price,
  };
}

function presetLines(kind: JobType, positions: Position[]): CalcLine[] {
  const entries = PRESETS[kind];
  if (!entries.length) return [lineFrom(undefined, 1)];
  return entries.map(({ key, quantity }) =>
    lineFrom(findPosition(positions, builtinId(key)), quantity),
  );
}

/** Aceleași poziții, dar cu cantitățile venite dintr-o măsurătoare. */
function seedLines(seed: CalcSeed, positions: Position[]): CalcLine[] {
  const lines: CalcLine[] = [];
  for (const [key, quantity] of Object.entries(seed.quantities)) {
    const position = findPosition(positions, builtinId(key as keyof DefaultRates));
    if (position) lines.push(lineFrom(position, Number(quantity) || 0));
  }
  if (seed.custom) {
    lines.push({
      id: uid(),
      item_id: CUSTOM_POSITION,
      description: seed.custom.description,
      quantity: seed.custom.quantity,
      unit: seed.custom.unit,
      unit_price: 0,
    });
  }
  return lines.length ? lines : presetLines(seed.kind, positions);
}

export default function CalculatorPage() {
  const router = useRouter();
  const { currency, settings } = useApp();
  const jobs = useJobs();
  const allJobs = useTable("jobs");
  const materials = useTable("job_materials");
  const expenses = useTable("expenses");
  const measurements = useTable("job_measurements");
  const positions = useMemo(() => allPositions(settings), [settings]);

  // Cantitățile venite dintr-o măsurătoare; citite o singură dată, la montare.
  const [seed] = useState(() => peekCalcSeed());

  const [kind, setKind] = useState<JobType>(seed?.kind ?? "stairs");
  const [lines, setLines] = useState<CalcLine[]>(() =>
    seed ? seedLines(seed, positions) : presetLines("stairs", positions),
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [targetJob, setTargetJob] = useState<string>("new");

  // Cât ai luat de fapt pe unitate, la lucrările terminate de același tip.
  // Cifra exista în Rapoarte; aici stă în clipa în care chiar contează.
  const history = useMemo(
    () =>
      priceHistory(
        buildJobRows({
          jobs: allJobs,
          materials,
          expenses,
          sessions: [],
          measurements,
        }),
        kind,
      ),
    [allJobs, materials, expenses, measurements, kind],
  );

  const total = useMemo(() => calcTotal(lines), [lines]);
  const { matching, rest } = useMemo(
    () => groupedPositions(positions, kind),
    [positions, kind],
  );
  const noRates = everyPriceUnset(positions);

  useEffect(() => {
    if (!seed) return;
    clearCalcSeed();
    toast.success(
      seed.from
        ? `Cantitățile din „${seed.from}” au fost preluate`
        : "Cantitățile din măsurătoare au fost preluate",
    );
  }, [seed]);

  const switchKind = (next: JobType) => {
    setKind(next);
    setLines(presetLines(next, positions));
  };

  const update = (id: string, patch: Partial<CalcLine>) =>
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );

  /** Alegerea poziției aduce cu ea unitatea și prețul din setări. */
  const choosePosition = (line: CalcLine, value: string) => {
    if (value === CUSTOM_POSITION) {
      update(line.id, { item_id: CUSTOM_POSITION });
      return;
    }
    const position = findPosition(positions, value);
    if (!position) return;
    update(line.id, {
      item_id: position.id,
      description: position.name,
      unit: position.unit,
      unit_price: position.price,
    });
  };

  const addLine = () => setLines((current) => [...current, lineFrom(undefined, 1)]);

  const removeLine = (id: string) =>
    setLines((current) => current.filter((line) => line.id !== id));

  const usableLines = lines.filter((line) => line.description.trim() && lineTotal(line) > 0);

  const saveToJob = async () => {
    if (!usableLines.length) {
      toast.error("Adaugă cel puțin o linie cu preț");
      return;
    }
    if (targetJob === "new") {
      saveCalcDraft({ kind, lines: usableLines, total });
      router.push("/lucrari/nou");
      return;
    }
    await updateJob(targetJob, { price_total: total });
    toast.success("Prețul a fost salvat în lucrare");
    setSaveOpen(false);
    router.push(`/lucrari/${targetJob}`);
  };

  const toQuote = () => {
    if (!usableLines.length) {
      toast.error("Adaugă cel puțin o linie cu preț");
      return;
    }
    saveCalcDraft({ kind, lines: usableLines, total });
    router.push("/oferte/nou");
  };

  const option = (position: Position) => (
    <SelectItem key={position.id} value={position.id}>
      {position.name}
      <span className="text-muted-foreground">
        {" · "}
        {position.price > 0 ? `${formatMoney(position.price, currency)}/${position.unit}` : "fără preț"}
      </span>
    </SelectItem>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Calculator preț"
        description="Alege poziția, pune cantitatea — prețul vine din setări"
      />

      {noRates && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-200">
          <Settings2 className="mt-0.5 size-4 shrink-0" />
          <p>
            Încă n-ai niciun tarif pus, deci prețurile pornesc de la zero.{" "}
            <Link href="/setari" className="font-medium underline underline-offset-2">
              Pune-le o dată în Setări
            </Link>{" "}
            și apoi vin singure aici.
          </p>
        </div>
      )}

      <Tabs value={kind} onValueChange={(value) => switchKind(value as JobType)}>
        <TabsList>
          <TabsTrigger value="stairs">Scări</TabsTrigger>
          <TabsTrigger value="parquet">Parchet</TabsTrigger>
          <TabsTrigger value="plinth">Plintă</TabsTrigger>
          <TabsTrigger value="other">Altceva</TabsTrigger>
        </TabsList>

        <TabsContent value={kind}>
          <div className="space-y-3">
            {history && (
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
                <History className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  La ultimele {history.jobs} lucrări de acest fel ai luat în
                  medie{" "}
                  <strong className="text-foreground">
                    {formatMoney(history.perUnit, currency)}
                  </strong>{" "}
                  pe {history.unit}.
                </span>
              </p>
            )}
            {lines.map((line) => (
              <div key={line.id} className="rounded-2xl surface p-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={line.item_id ?? ""}
                      onValueChange={(value) => choosePosition(line, value)}
                    >
                      <SelectTrigger
                        className="h-10"
                        aria-label="Poziție"
                      >
                        <SelectValue placeholder="Alege poziția">
                          {line.item_id === CUSTOM_POSITION
                            ? line.description || "Altceva"
                            : findPosition(positions, line.item_id ?? "")?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {matching.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>{JOB_TYPE_LABELS[kind]}</SelectLabel>
                            {matching.map(option)}
                          </SelectGroup>
                        )}
                        {rest.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Alte poziții</SelectLabel>
                            {rest.map(option)}
                          </SelectGroup>
                        )}
                        <SelectGroup>
                          <SelectItem value={CUSTOM_POSITION}>Altceva — scriu eu</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Șterge linia"
                    onClick={() => removeLine(line.id)}
                  >
                    <X className="text-muted-foreground" />
                  </Button>
                </div>

                {line.item_id === CUSTOM_POSITION && (
                  <Input
                    value={line.description}
                    onChange={(event) => update(line.id, { description: event.target.value })}
                    placeholder="Denumire serviciu"
                    className="mt-2.5 h-10"
                  />
                )}

                <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <Field label="Cantitate">
                    <NumberInput
                      value={line.quantity}
                      onChange={(value) => update(line.id, { quantity: value })}
                      stepper={false}
                      suffix={line.unit}
                    />
                    {line.unit === TRAVEL_UNIT && line.quantity > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          update(line.id, { quantity: line.quantity * 2 })
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        dus-întors ({line.quantity * 2} {TRAVEL_UNIT})
                      </button>
                    )}
                  </Field>
                  <span className="pb-3 text-muted-foreground">×</span>
                  <Field label="Preț unitar">
                    <NumberInput
                      value={line.unit_price}
                      onChange={(value) => update(line.id, { unit_price: value })}
                      stepper={false}
                      suffix={currency}
                    />
                  </Field>
                </div>

                <p className="mt-2.5 text-right text-sm">
                  <span className="text-muted-foreground">
                    {formatNumber(line.quantity)} {line.unit} × {formatMoney(line.unit_price, currency)} ={" "}
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(lineTotal(line), currency)}
                  </span>
                </p>
              </div>
            ))}

            <Button variant="outline" className="w-full" size="lg" onClick={addLine}>
              <Plus /> Adaugă serviciu
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-10 space-y-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-2xl lg:static">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calculator className="size-4" /> TOTAL {JOB_TYPE_LABELS[kind].toUpperCase()}
          </span>
          <span className="text-2xl font-bold tabular-nums text-primary">
            {formatMoney(total, currency)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={toQuote}>
            <FileText /> Fă ofertă
          </Button>
          <Button size="lg" onClick={() => setSaveOpen(true)}>
            <Save /> Salvează
          </Button>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unde salvezi calculul?</DialogTitle>
          </DialogHeader>
          <Field label="Lucrare">
            <Select value={targetJob} onValueChange={setTargetJob}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Lucrare nouă</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className="text-sm text-muted-foreground">
            Prețul total <strong>{formatMoney(total, currency)}</strong> va fi pus pe lucrare.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Anulează
            </Button>
            <Button onClick={saveToJob}>
              <Hammer /> Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
