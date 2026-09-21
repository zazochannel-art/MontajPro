"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientDialog } from "@/components/forms/client-dialog";
import { useZodForm } from "@/hooks/use-zod-form";
import { quoteSchema } from "@/lib/schemas";
import { saveQuote, quoteTotal, type QuoteItemInput } from "@/lib/db/actions";
import { useClients, useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { clearCalcDraft, peekCalcDraft } from "@/lib/calc-draft";
import { formatMoney } from "@/lib/format";
import { JOB_TYPE_LABELS, UNITS } from "@/lib/constants";
import {
  allPositions,
  CUSTOM_POSITION,
  findPosition,
  matchPosition,
  positionGroups,
  TRAVEL_UNIT,
  type Position,
} from "@/lib/price-list";
import type { JobType, Quote } from "@/lib/types";
import { uid } from "@/lib/utils";

const GROUP_LABELS: Record<JobType | "any", string> = {
  ...JOB_TYPE_LABELS,
  any: "Oriunde",
};

/** Linia din formular ține minte poziția aleasă; în bază nu pleacă. */
type ItemRow = QuoteItemInput & { key: string; item_id: string | null };

/** Formularul ofertei — aceleași câmpuri la creare și la editare. */
export function QuoteForm({ quote }: { quote?: Quote | null }) {
  const router = useRouter();
  const { currency, settings } = useApp();
  const clients = useClients();
  const allItems = useTable("quote_items");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const positions = useMemo(() => allPositions(settings), [settings]);
  const groups = useMemo(() => positionGroups(positions), [positions]);

  // Ciorna din calculator, dacă există; e citită o singură dată, la montare.
  const [draft] = useState(() => (quote ? null : peekCalcDraft()));

  const [items, setItems] = useState<ItemRow[]>(() => {
    /**
     * O linie veche ține doar denumirea. Dacă aceasta e a unei poziții, o
     * arătăm aleasă; altfel linia e scrisă de mână, iar gol înseamnă nimic ales.
     */
    const resolve = (description: string, known?: string | null): string | null => {
      if (known) return known;
      const matched = matchPosition(positions, description);
      if (matched) return matched.id;
      return description.trim() ? CUSTOM_POSITION : null;
    };

    if (quote) {
      return allItems
        .filter((item) => item.quote_id === quote.id)
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          key: item.id,
          id: item.id,
          item_id: resolve(item.description),
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
        }));
    }
    const fromCalculator = peekCalcDraft();
    if (fromCalculator) {
      return fromCalculator.lines.map((line) => ({
        key: uid(),
        item_id: resolve(line.description, line.item_id),
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
      }));
    }
    return [
      {
        key: uid(),
        item_id: null,
        description: "",
        quantity: 1,
        unit: "buc",
        unit_price: 0,
      },
    ];
  });

  const form = useZodForm(quoteSchema, {
    title: quote?.title ?? (draft ? "Ofertă lucrare" : ""),
    client_id: quote?.client_id ?? null,
    valid_until: quote?.valid_until ?? "",
    advance: quote?.advance ?? 0,
    discount: quote?.discount ?? 0,
    notes: quote?.notes ?? "",
  });

  useEffect(() => {
    if (!draft) return;
    clearCalcDraft();
    toast.success("Calculul a fost preluat în ofertă");
  }, [draft]);

  const { subtotal, total } = quoteTotal(items, form.values.discount ?? 0);

  const update = (key: string, patch: Partial<ItemRow>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );

  /** Alegerea poziției aduce cu ea denumirea, unitatea și prețul din setări. */
  const choosePosition = (key: string, value: string) => {
    if (value === CUSTOM_POSITION) {
      update(key, { item_id: CUSTOM_POSITION });
      return;
    }
    const position = findPosition(positions, value);
    if (!position) return;
    update(key, {
      item_id: position.id,
      description: position.name,
      unit: position.unit,
      unit_price: position.price,
    });
  };

  const option = (position: Position) => (
    <SelectItem key={position.id} value={position.id}>
      {position.name}
      <span className="text-muted-foreground">
        {" · "}
        {position.price > 0
          ? `${formatMoney(position.price, currency)}/${position.unit}`
          : "fără preț"}
      </span>
    </SelectItem>
  );

  const onSubmit = form.handleSubmit(async (data) => {
    const valid = items.filter((item) => item.description.trim());
    if (!valid.length) {
      toast.error("Adaugă cel puțin o linie în ofertă");
      return;
    }
    const saved = await saveQuote(
      { id: quote?.id, ...data, status: quote?.status },
      valid,
    );
    if (!saved) {
      toast.error("Oferta nu a putut fi salvată");
      return;
    }
    toast.success(quote ? "Ofertă actualizată" : "Ofertă creată");
    router.replace(`/oferte/${saved.id}`);
  });

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4 pb-4">
        <div className="space-y-3.5 rounded-2xl surface p-4">
          <Field label="Titlu" error={form.errors.title} required>
            <Input
              value={form.values.title}
              onChange={(event) => form.set("title", event.target.value)}
              placeholder="Montaj scară stejar"
            />
          </Field>

          <Field label="Client">
            <div className="flex gap-2">
              <Select
                value={form.values.client_id ?? "none"}
                onValueChange={(value) =>
                  form.set("client_id", value === "none" ? null : value)
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Alege clientul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Fără client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Client nou"
                onClick={() => setClientDialogOpen(true)}
              >
                <Plus />
              </Button>
            </div>
          </Field>

          <Field label="Valabilă până la">
            <Input
              type="date"
              value={form.values.valid_until ?? ""}
              onChange={(event) => form.set("valid_until", event.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Servicii și materiale</h3>
          {items.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl surface p-3.5"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    value={item.item_id ?? ""}
                    onValueChange={(value) => choosePosition(item.key, value)}
                  >
                    <SelectTrigger className="h-10" aria-label="Poziție">
                      <SelectValue placeholder="Alege poziția">
                        {item.item_id === CUSTOM_POSITION
                          ? item.description || "Altceva"
                          : findPosition(positions, item.item_id ?? "")?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectGroup key={group.kind}>
                          <SelectLabel>{GROUP_LABELS[group.kind]}</SelectLabel>
                          {group.items.map(option)}
                        </SelectGroup>
                      ))}
                      <SelectGroup>
                        <SelectItem value={CUSTOM_POSITION}>
                          Altceva — scriu eu
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Șterge linia"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((row) => row.key !== item.key),
                    )
                  }
                >
                  <X className="text-muted-foreground" />
                </Button>
              </div>

              {item.item_id === CUSTOM_POSITION && (
                <Input
                  value={item.description}
                  onChange={(event) =>
                    update(item.key, { description: event.target.value })
                  }
                  placeholder="Descriere linie"
                  className="mt-2.5 h-10"
                />
              )}

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <Field label="Cant.">
                  <NumberInput
                    value={item.quantity}
                    onChange={(value) => update(item.key, { quantity: value })}
                    stepper={false}
                  />
                  {item.unit === TRAVEL_UNIT && item.quantity > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        update(item.key, { quantity: item.quantity * 2 })
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      dus-întors
                    </button>
                  )}
                </Field>
                <Field label="Unitate">
                  <Select
                    value={item.unit}
                    onValueChange={(value) => update(item.key, { unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* O poziție proprie poate avea orice unitate; dacă nu e
                          în listă, o adăugăm ca să nu rămână selectorul gol. */}
                      {(UNITS.includes(item.unit) || !item.unit
                        ? UNITS
                        : [...UNITS, item.unit]
                      ).map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Preț">
                  <NumberInput
                    value={item.unit_price}
                    onChange={(value) =>
                      update(item.key, { unit_price: value })
                    }
                    stepper={false}
                  />
                </Field>
              </div>

              <p className="mt-2 text-right text-sm font-semibold tabular-nums">
                {formatMoney(item.quantity * item.unit_price, currency)}
              </p>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() =>
              setItems((current) => [
                ...current,
                {
                  key: uid(),
                  item_id: null,
                  description: "",
                  quantity: 1,
                  unit: "buc",
                  unit_price: 0,
                },
              ])
            }
          >
            <Plus /> Adaugă linie
          </Button>
        </div>

        <div className="space-y-3.5 rounded-2xl surface p-4">
          <FieldRow>
            <Field label="Reducere">
              <MoneyInput
                value={form.values.discount}
                onChange={(value) => form.set("discount", value)}
                currency={currency}
              />
            </Field>
            <Field label="Avans cerut">
              <MoneyInput
                value={form.values.advance}
                onChange={(value) => form.set("advance", value)}
                currency={currency}
              />
            </Field>
          </FieldRow>

          <Field label="Condiții / notițe">
            <Textarea
              value={form.values.notes ?? ""}
              onChange={(event) => form.set("notes", event.target.value)}
              placeholder="Termen de execuție, garanție, condiții de plată..."
            />
          </Field>

          <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">
                {formatMoney(subtotal, currency)}
              </dd>
            </div>
            {(form.values.discount ?? 0) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reducere</dt>
                <dd className="tabular-nums text-red-300">
                  −{formatMoney(form.values.discount ?? 0, currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums text-primary">
                {formatMoney(total, currency)}
              </dd>
            </div>
            {(form.values.advance ?? 0) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rest după avans</dt>
                <dd className="tabular-nums">
                  {formatMoney(total - (form.values.advance ?? 0), currency)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="sticky bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-10 flex gap-2 lg:static">
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="flex-1"
            onClick={() => router.back()}
          >
            Anulează
          </Button>
          <Button
            type="submit"
            size="xl"
            className="flex-[2]"
            loading={form.submitting}
          >
            <Check /> {quote ? "Salvează" : "Creează oferta"}
          </Button>
        </div>
      </form>

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSaved={(id) => form.set("client_id", id)}
      />
    </>
  );
}
