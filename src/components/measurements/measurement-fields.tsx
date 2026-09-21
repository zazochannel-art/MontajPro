"use client";

import { Check, Sparkles, TriangleAlert } from "lucide-react";
import { Field, FieldRow } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { derivedValues } from "@/lib/calc";
import { stairComfort } from "@/lib/stairs";
import type { StairComfort } from "@/lib/stairs";
import { useApp } from "@/lib/app-provider";
import type { JobType, MeasurementData } from "@/lib/types";
import type {
  OtherMeasurement,
  ParquetMeasurement,
  PlinthMeasurement,
  StairsMeasurement,
} from "@/lib/types";

/**
 * Câmpurile de măsurare, pe tipuri de lucrare.
 *
 * Dimensiunile liniare sunt în centimetri — așa se măsoară pe teren. Calculele
 * derivate (suprafețe, unghi, bucăți) apar imediat sub câmpuri.
 */
export function MeasurementFields({
  kind,
  data,
  onChange,
}: {
  kind: JobType;
  data: MeasurementData;
  onChange: (data: MeasurementData) => void;
}) {
  const set = (key: string, value: number | string) =>
    onChange({ ...data, [key]: value } as MeasurementData);

  if (kind === "stairs") {
    const m = data as StairsMeasurement;
    return (
      <div className="space-y-3.5">
        <Field label="Număr trepte" htmlFor="m-steps">
          <NumberInput
            id="m-steps"
            value={m.steps ?? ""}
            onChange={(value) => set("steps", value)}
            suffix="buc"
          />
        </Field>
        <FieldRow>
          <Field label="Lățime treaptă" htmlFor="m-width">
            <NumberInput
              id="m-width"
              value={m.width ?? ""}
              onChange={(value) => set("width", value)}
              stepper={false}
              suffix="cm"
            />
          </Field>
          <Field label="Adâncime treaptă" htmlFor="m-depth">
            <NumberInput
              id="m-depth"
              value={m.depth ?? ""}
              onChange={(value) => set("depth", value)}
              stepper={false}
              suffix="cm"
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Înălțime treaptă" htmlFor="m-height">
            <NumberInput
              id="m-height"
              value={m.height ?? ""}
              onChange={(value) => set("height", value)}
              stepper={false}
              suffix="cm"
            />
          </Field>
          <Field label="Grosime" htmlFor="m-thickness">
            <NumberInput
              id="m-thickness"
              value={m.thickness ?? ""}
              onChange={(value) => set("thickness", value)}
              stepper={false}
              suffix="cm"
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Lungime totală" htmlFor="m-length">
            <NumberInput
              id="m-length"
              value={m.length ?? ""}
              onChange={(value) => set("length", value)}
              stepper={false}
              suffix="cm"
            />
          </Field>
          <Field label="Podeste" htmlFor="m-landings">
            <NumberInput
              id="m-landings"
              value={m.landings ?? ""}
              onChange={(value) => set("landings", value)}
              suffix="buc"
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field
            label="Unghi"
            htmlFor="m-angle"
            hint="Lasă gol pentru calcul automat"
          >
            <NumberInput
              id="m-angle"
              value={m.angle ?? ""}
              onChange={(value) => set("angle", value)}
              stepper={false}
              suffix="°"
            />
          </Field>
          <Field label="Rază" htmlFor="m-radius" hint="Pentru scări curbate">
            <NumberInput
              id="m-radius"
              value={m.radius ?? ""}
              onChange={(value) => set("radius", value)}
              stepper={false}
              suffix="cm"
            />
          </Field>
        </FieldRow>
      </div>
    );
  }

  if (kind === "parquet") {
    const m = data as ParquetMeasurement;
    return (
      <div className="space-y-3.5">
        <Field label="Suprafață" htmlFor="m-area">
          <NumberInput
            id="m-area"
            value={m.area ?? ""}
            onChange={(value) => set("area", value)}
            stepper={false}
            suffix="m²"
          />
        </Field>
        <FieldRow>
          <Field label="Pierdere" htmlFor="m-waste" hint="Uzual 5–10%">
            <NumberInput
              id="m-waste"
              value={m.waste_percent ?? 10}
              onChange={(value) => set("waste_percent", value)}
              step={1}
              suffix="%"
            />
          </Field>
          <Field label="Camere" htmlFor="m-rooms">
            <NumberInput
              id="m-rooms"
              value={m.rooms ?? ""}
              onChange={(value) => set("rooms", value)}
              suffix="buc"
            />
          </Field>
        </FieldRow>
        <Field label="Tip parchet" htmlFor="m-parquet-type">
          <Input
            id="m-parquet-type"
            value={m.parquet_type ?? ""}
            onChange={(event) => set("parquet_type", event.target.value)}
            placeholder="Stejar 14mm, laminat 8mm..."
          />
        </Field>
      </div>
    );
  }

  if (kind === "plinth") {
    const m = data as PlinthMeasurement;
    return (
      <div className="space-y-3.5">
        <Field label="Metri liniari" htmlFor="m-meters">
          <NumberInput
            id="m-meters"
            value={m.linear_meters ?? ""}
            onChange={(value) => set("linear_meters", value)}
            stepper={false}
            suffix="m"
          />
        </Field>
        <Field label="Tip plintă" htmlFor="m-plinth-type">
          <Input
            id="m-plinth-type"
            value={m.plinth_type ?? ""}
            onChange={(event) => set("plinth_type", event.target.value)}
            placeholder="MDF 8cm, PVC, lemn masiv..."
          />
        </Field>
        <FieldRow>
          <Field label="Colțuri exterioare" htmlFor="m-corners-outer">
            <NumberInput
              id="m-corners-outer"
              value={m.corners_outer ?? ""}
              onChange={(value) => set("corners_outer", value)}
              suffix="buc"
            />
          </Field>
          <Field label="Colțuri interioare" htmlFor="m-corners-inner">
            <NumberInput
              id="m-corners-inner"
              value={m.corners_inner ?? ""}
              onChange={(value) => set("corners_inner", value)}
              suffix="buc"
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Profile / capete" htmlFor="m-profiles">
            <NumberInput
              id="m-profiles"
              value={m.profiles ?? ""}
              onChange={(value) => set("profiles", value)}
              suffix="buc"
            />
          </Field>
          <Field label="Îmbinări" htmlFor="m-joints">
            <NumberInput
              id="m-joints"
              value={m.joints ?? ""}
              onChange={(value) => set("joints", value)}
              suffix="buc"
            />
          </Field>
        </FieldRow>
        <Field label="Lungime bucată" htmlFor="m-piece" hint="Implicit 2,4 m">
          <NumberInput
            id="m-piece"
            value={m.piece_length ?? 2.4}
            onChange={(value) => set("piece_length", value)}
            step={0.1}
            stepper={false}
            suffix="m"
          />
        </Field>
      </div>
    );
  }

  const m = data as OtherMeasurement;
  return (
    <div className="space-y-3.5">
      <Field label="Ce măsori" htmlFor="m-label">
        <Input
          id="m-label"
          value={m.label ?? ""}
          onChange={(event) => set("label", event.target.value)}
          placeholder="ex. balustradă, prag, mână curentă"
        />
      </Field>
      <FieldRow>
        <Field label="Cantitate" htmlFor="m-quantity">
          <NumberInput
            id="m-quantity"
            value={m.quantity ?? ""}
            onChange={(value) => set("quantity", value)}
            stepper={false}
          />
        </Field>
        <Field label="Unitate" htmlFor="m-unit">
          <Input
            id="m-unit"
            value={m.unit ?? ""}
            onChange={(event) => set("unit", event.target.value)}
            placeholder="m, buc, m²"
          />
        </Field>
      </FieldRow>
    </div>
  );
}

/** Panoul cu valorile calculate automat. */
export function DerivedPanel({
  kind,
  data,
}: {
  kind: JobType;
  data: MeasurementData;
}) {
  const { settings } = useApp();
  const values = derivedValues(kind, data);

  /*
   * Verdictul asupra treptei. Se pune deasupra cifrelor, nu sub ele: cifrele
   * se citesc când ai timp, iar „treptele ies prea înalte” trebuie văzut
   * înainte de a tăia lemnul.
   */
  const stairs = kind === "stairs" ? (data as StairsMeasurement) : null;
  const comfort = stairs
    ? stairComfort(
        { riser: stairs.height, tread: stairs.depth, steps: stairs.steps },
        settings?.stair_limits && Object.keys(settings.stair_limits).length
          ? settings.stair_limits
          : undefined,
      )
    : null;
  const showComfort = comfort && comfort.stepSum !== null;

  if (!values.length && !showComfort) return null;

  return (
    <div className="space-y-3">
      {showComfort && <ComfortNote comfort={comfort} />}
      {values.length > 0 && (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Sparkles className="size-3.5" /> Calculat automat
      </p>
      <dl className="grid grid-cols-2 gap-3">
        {values.map((value) => (
          <div key={value.label}>
            <dt className="text-xs text-muted-foreground">{value.label}</dt>
            <dd className="font-semibold tabular-nums">{value.value}</dd>
            {value.hint && (
              <dd className="text-[11px] text-muted-foreground">
                {value.hint}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
      )}
    </div>
  );
}

/**
 * Semaforul treptei.
 *
 * Roșu oprește, galben atrage atenția, verde confirmă. Textul e în cuvinte, nu
 * în formule: omul de pe șantier n-are nevoie să afle cum se cheamă regula, ci
 * ce are de schimbat.
 */
function ComfortNote({ comfort }: { comfort: StairComfort }) {
  const tone =
    comfort.level === "bad"
      ? {
          box: "border-red-500/30 bg-red-500/10",
          text: "text-red-200",
          icon: TriangleAlert,
          title: "Treptele nu se vor urca bine",
        }
      : comfort.level === "warn"
        ? {
            box: "border-amber-500/30 bg-amber-500/10",
            text: "text-amber-200",
            icon: TriangleAlert,
            title: "Merge, dar se simte",
          }
        : {
            box: "border-emerald-500/30 bg-emerald-500/10",
            text: "text-emerald-200",
            icon: Check,
            title: "Treptele se urcă bine",
          };
  const Icon = tone.icon;

  return (
    <div className={`rounded-2xl border p-4 ${tone.box}`}>
      <p className={`flex items-center gap-2 text-sm font-semibold ${tone.text}`}>
        <Icon className="size-4 shrink-0" />
        {tone.title}
      </p>

      {comfort.problems.length > 0 && (
        <ul className={`mt-2 space-y-1.5 text-xs ${tone.text}`}>
          {comfort.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {comfort.suggestion && (
        <p className="mt-2.5 rounded-xl bg-black/20 px-3 py-2 text-xs text-foreground">
          {comfort.suggestion.text}
        </p>
      )}

      {comfort.stepSum !== null && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Pasul: 2 × înălțime + adâncime = {comfort.stepSum} cm. Un om urcă cel
          mai comod pe la 63 cm.
        </p>
      )}
    </div>
  );
}
