"use client";

import { AlertTriangle, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMFORT, TURNS, TURN_LABELS, derive } from "@/lib/design/stair-spec";
import type { StairSpec, Turn } from "@/lib/design/stair-spec";
import type { DesignDetection } from "@/lib/design/model";

/**
 * Cifrele scării, într-un formular.
 *
 * Fără butoanele de plus și minus: două pătrate de 48 px de-o parte și de alta
 * mănâncă tot câmpul într-o coloană de panou, iar cifra rămâne tăiată. Pe o
 * înălțime de 2800 mm nici n-ar avea rost — nimeni nu apasă de 280 de ori.
 *
 * Fiecare cifră schimbă desenul pe loc: nu e niciun buton „aplică”, fiindcă
 * omul învârte de numărul de trepte tocmai ca să vadă ce iese. Sub formular
 * stau cifrele care ies din celelalte — înălțimea treptei, unghiul, formula
 * pasului — ca să se vadă dacă scara se urcă, nu doar dacă încape.
 */
export function StairForm({
  spec,
  onChange,
  detection,
  onFromPhoto,
}: {
  spec: StairSpec;
  onChange: (spec: StairSpec) => void;
  detection: DesignDetection | null;
  onFromPhoto: () => void;
}) {
  const info = derive(spec);
  const set = <K extends keyof StairSpec>(key: K, value: StairSpec[K]) =>
    onChange({ ...spec, [key]: value });

  return (
    <div className="space-y-4">
      {detection && detection.steps >= 2 && (
        <Button variant="secondary" className="w-full" onClick={onFromPhoto}>
          <Sparkles className="size-4" />
          Ia cifrele din fotografie ({detection.steps} trepte)
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Înălțime totală">
          <NumberInput
            value={spec.totalRise}
            onChange={(value) => set("totalRise", value)}
            stepper={false}
            step={10}
            min={300}
            max={8000}
            suffix="mm"
          />
        </Field>
        <Field label="Număr de trepte">
          <NumberInput
            value={spec.steps}
            onChange={(value) => set("steps", value)}
            stepper={false}
            min={2}
            max={60}
          />
        </Field>
        <Field label="Adâncime treaptă">
          <NumberInput
            value={spec.tread}
            onChange={(value) => set("tread", value)}
            stepper={false}
            step={5}
            min={120}
            max={500}
            suffix="mm"
          />
        </Field>
        <Field label="Lățime scară">
          <NumberInput
            value={spec.width}
            onChange={(value) => set("width", value)}
            stepper={false}
            step={10}
            min={400}
            max={2500}
            suffix="mm"
          />
        </Field>
      </div>

      <div
        className={
          info.warnings.length
            ? "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
            : "rounded-lg border border-border bg-muted/40 p-3"
        }
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <Derived label="Înălțime treaptă" value={`${info.rise} mm`} ok={inRange(info.rise, COMFORT.rise)} />
          <Derived label="Unghi urcare" value={`${info.angle}°`} ok />
          <Derived
            label="Formula pasului"
            value={`${info.stepFormula}`}
            ok={inRange(info.stepFormula, COMFORT.formula)}
          />
        </div>
        {info.warnings.map((warning) => (
          <p key={warning} className="mt-2 flex gap-1.5 text-xs text-amber-500">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{warning}</span>
          </p>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Grosime blat">
          <NumberInput
            value={spec.thickness}
            onChange={(value) => set("thickness", value)}
            stepper={false}
            min={15}
            max={120}
            suffix="mm"
          />
        </Field>
        <Field label="Ieșire nas">
          <NumberInput
            value={spec.nosing}
            onChange={(value) => set("nosing", value)}
            stepper={false}
            min={0}
            max={Math.round(spec.tread / 2)}
            suffix="mm"
          />
        </Field>
        <Field label="Contratreaptă">
          <NumberInput
            value={spec.riserThickness}
            onChange={(value) => set("riserThickness", value)}
            stepper={false}
            min={8}
            max={60}
            suffix="mm"
          />
        </Field>
      </div>

      <label className="flex items-center justify-between rounded-lg border border-border p-3">
        <span className="text-sm">
          Cu contratreaptă
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Fără ea, golul dintre trepte rămâne deschis.
          </span>
        </span>
        <Switch
          checked={spec.closedRisers}
          onCheckedChange={(on) => set("closedRisers", on)}
        />
      </label>

      <Field label="Cot">
        <Select value={spec.turn} onValueChange={(value) => set("turn", value as Turn)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TURNS.map((turn) => (
              <SelectItem key={turn} value={turn}>
                {TURN_LABELS[turn]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {spec.turn !== "fara" && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="După treapta">
            <NumberInput
              value={spec.turnAfter}
              onChange={(value) => set("turnAfter", value)}
              stepper={false}
              min={1}
              max={Math.max(1, spec.steps - 2)}
            />
          </Field>
          <Field label="Trepte în evantai">
            <NumberInput
              value={spec.winders}
              onChange={(value) => set("winders", value)}
              stepper={false}
              min={1}
              max={Math.max(1, spec.steps - spec.turnAfter - 1)}
            />
          </Field>
          <Field label="Întoarcere">
            <NumberInput
              value={spec.turnAngle}
              onChange={(value) => set("turnAngle", value)}
              stepper={false}
              step={15}
              min={15}
              max={180}
              suffix="°"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function inRange(value: number, band: { min: number; max: number }): boolean {
  return value >= band.min && value <= band.max;
}

function Derived({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={ok ? "text-sm font-semibold" : "text-sm font-semibold text-amber-500"}>
        {value}
      </p>
    </div>
  );
}

/** Butonul care învârte scara în vederea 3D. Un sfert de tură la o apăsare. */
export function SpinButton({ onSpin }: { onSpin: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onSpin}>
      <RotateCw className="size-4" />
      Rotește
    </Button>
  );
}
