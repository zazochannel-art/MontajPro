"use client";

import { Ruler, Scaling, Trash2, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { measureAll, totalArea } from "@/lib/design/measure";
import { formatMeasure } from "@/lib/design/measure";
import {
  STAIR_KIND_LABELS,
  removeStep,
  splitEdge,
  type DesignDoc,
} from "@/lib/design/model";
import { cn } from "@/lib/utils";
import type { CanvasSelection } from "./design-canvas";

/**
 * Ce s-a citit din fotografie, și cât e de crezut.
 *
 * Încrederea nu e o cifră pusă ca să arate bine: iese din cât de tari sunt
 * muchiile găsite, cât de regulat sunt așezate și câte sunt (vezi
 * `design/detect.ts`). De aceea are voie să stea pe ecran.
 */
export function DetectionCard({ doc }: { doc: DesignDoc }) {
  const detection = doc.detection;
  if (!detection) return null;

  const percent = Math.round(detection.confidence * 100);
  const tone =
    detection.confidence >= 0.7
      ? "text-emerald-300"
      : detection.confidence >= 0.5
        ? "text-amber-300"
        : "text-red-300";

  return (
    <section className="surface space-y-2 rounded-2xl p-4">
      <h3 className="text-sm font-semibold">Ce s-a citit din fotografie</h3>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Trepte detectate</dt>
          <dd className="tabular-nums">{detection.steps}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Tip scară</dt>
          <dd>{STAIR_KIND_LABELS[detection.kind]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Unghi aproximativ</dt>
          <dd className="tabular-nums">{detection.angle}°</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Încredere</dt>
          <dd className={cn("font-semibold tabular-nums", tone)}>{percent}%</dd>
        </div>
      </dl>

      {detection.warning && (
        <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-300">
          {detection.warning}
        </p>
      )}
    </section>
  );
}

/**
 * Starea calibrării — cel mai important rând de pe ecran.
 *
 * Cât timp desenul nu e calibrat, cifrele lui sunt proporții scoase din
 * pixelii unei poze. Se spune pe față, cu galben, fiindcă cineva taie lemn
 * după ele.
 */
export function ScaleCard({
  doc,
  onCalibrate,
  onClear,
}: {
  doc: DesignDoc;
  onCalibrate: () => void;
  onClear: () => void;
}) {
  const area = totalArea(doc);

  return (
    <section className="surface space-y-2.5 rounded-2xl p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Scaling className="size-4 text-primary" /> Scară
      </h3>

      {doc.scale === null ? (
        <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-300">
          Desenul nu e calibrat. Cifrele de mai jos sunt proporții, nu
          milimetri — dintr-o fotografie nu se poate ști mărimea reală.
        </p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground text-xs">
            O unitate de desen = {doc.scale.toFixed(2)} mm
          </p>
          {area.m2 !== null && (
            <p className="text-xs text-muted-foreground">
              Suprafața treptelor:{" "}
              <strong className="text-foreground tabular-nums">{area.m2} m²</strong>
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCalibrate}>
          <Ruler /> Setează dimensiune de referință
        </Button>
        {doc.scale !== null && (
          <Button variant="ghost" size="sm" onClick={onClear} aria-label="Șterge calibrarea">
            <Trash2 />
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * Măsurile fiecărei trepte, citite din geometrie.
 *
 * Nu sunt câmpuri de completat, ci rezultate: se schimbă singure când tragi un
 * colț. Mărimea reală se pune o singură dată, prin calibrare — altfel ar trebui
 * scrisă de paisprezece ori și tot n-ar fi legată de desen.
 */
export function StepList({
  doc,
  selection,
  onSelect,
  onDocChange,
}: {
  doc: DesignDoc;
  selection: CanvasSelection;
  onSelect: (selection: CanvasSelection) => void;
  onDocChange: (doc: DesignDoc) => void;
}) {
  const rows = measureAll(doc);
  if (!rows.length) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Treptele</h3>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl surface">
        {rows.map((row) => {
          const active = row.step.id === selection.stepId;
          return (
            <li key={row.step.id}>
              <button
                type="button"
                onClick={() => onSelect({ stepId: row.step.id, pointId: null })}
                className={cn(
                  "flex w-full items-center justify-between gap-3 p-3 text-left transition-colors",
                  active ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary-soft">
                    {row.step.index}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatMeasure(doc, row.width)} × {formatMeasure(doc, row.depth)}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {row.angle}°
                </span>
              </button>

              {active && (
                <div className="flex flex-wrap gap-2 border-t border-border p-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDocChange(splitEdge(doc, row.step.id, 0))}
                  >
                    <Waypoints /> Rupe muchia din față
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onDocChange(removeStep(doc, row.step.id));
                      onSelect({ stepId: null, pointId: null });
                    }}
                  >
                    <Trash2 /> Șterge treapta
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {doc.scale === null && (
        <p className="text-[11px] text-muted-foreground">
          Măsurile sunt în unități de desen. Calibrează ca să devină milimetri.
        </p>
      )}
    </section>
  );
}

/** Cotele scrise pe desen, cu posibilitatea de a le șterge. */
export function DimensionList({
  doc,
  onDocChange,
}: {
  doc: DesignDoc;
  onDocChange: (doc: DesignDoc) => void;
}) {
  if (!doc.dimensions.length) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Cote</h3>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl surface">
        {doc.dimensions.map((dimension) => {
          const from = doc.points[dimension.from];
          const to = doc.points[dimension.to];
          const length =
            from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
          return (
            <li
              key={dimension.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span className="text-sm tabular-nums">
                {dimension.label?.trim() || formatMeasure(doc, length)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Șterge cota"
                onClick={() =>
                  onDocChange({
                    ...doc,
                    dimensions: doc.dimensions.filter((row) => row.id !== dimension.id),
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Eticheta care spune, scurt, dacă desenul e de crezut la milimetru. */
export function ScaleBadge({ doc }: { doc: DesignDoc }) {
  if (doc.scale === null) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-300">
        Estimativ — necalibrat
      </Badge>
    );
  }
  return <Badge variant="outline">Calibrat</Badge>;
}
