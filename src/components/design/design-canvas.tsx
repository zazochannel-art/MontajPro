"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bounds,
  movePoint,
  moveStep,
  stepPoints,
  type DesignDoc,
} from "@/lib/design/model";
import { distance } from "@/lib/design/measure";
import { formatMeasure } from "@/lib/design/measure";

/**
 * Canvasul desenului: fotografia dedesubt, geometria deasupra.
 *
 * Desenul NU se redă ca imagine. La fiecare cadru se parcurg punctele și se
 * trag linii între ele — de aceea un colț tras cu degetul chiar mută colțul, nu
 * mută pixeli. Fără asta, tot restul (cote care se actualizează, suprafață,
 * plan de debitare) n-ar avea de unde ieși.
 *
 * Două sisteme de coordonate, ca să nu se amestece: **desen**, în care trăiesc
 * punctele, și **ecran**, în care sunt degetele. `toScreen` și `toDesign` sunt
 * singurul drum între ele.
 */

export type ViewMode = "foto" | "desen" | "comparare";
export type Tool = "muta" | "cota" | "calibrare";

export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export interface CanvasSelection {
  stepId: string | null;
  pointId: string | null;
}

/** Cât de aproape de un punct trebuie apăsat ca să fie prins, în pixeli de ecran. */
/** Capetele măririi, ca desenul să nu poată fi pierdut de pe ecran. */
const MIN_SCALE = 0.02;
const MAX_SCALE = 40;

const GRAB = 18;
/** Raza punctelor de control, tot în pixeli de ecran. */
const HANDLE = 6;

const INK = {
  /** Conturul treptelor: linia principală. */
  main: "#06B6D4",
  /** Treapta selectată. */
  active: "#8B5CF6",
  /** Cote și linii secundare. */
  detail: "#A1A1AA",
  handle: "#FAFAFA",
  text: "#FAFAFA",
};

export function DesignCanvas({
  doc,
  photo,
  mode,
  overlay,
  tool,
  selection,
  onSelectionChange,
  onDocChange,
  onCalibrationPick,
  onDimensionPick,
}: {
  doc: DesignDoc;
  photo: HTMLImageElement | null;
  mode: ViewMode;
  /** Cât de tare se vede desenul peste fotografie, în modul Comparare. */
  overlay: number;
  tool: Tool;
  selection: CanvasSelection;
  onSelectionChange: (selection: CanvasSelection) => void;
  onDocChange: (doc: DesignDoc, commit: boolean) => void;
  onCalibrationPick: (a: string, b: string) => void;
  onDimensionPick: (a: string, b: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 });
  const [picked, setPicked] = useState<string[]>([]);

  /*
   * Starea gestului stă într-un ref, nu în state: la fiecare mișcare de deget
   * ar însemna o randare, iar desenul ar rămâne în urma degetului.
   */
  const drag = useRef<{
    kind: "point" | "step" | "pan";
    id: string | null;
    lastX: number;
    lastY: number;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  const toScreen = useCallback(
    (x: number, y: number) => ({ x: x * view.scale + view.tx, y: y * view.scale + view.ty }),
    [view],
  );
  const toDesign = useCallback(
    (x: number, y: number) => ({ x: (x - view.tx) / view.scale, y: (y - view.ty) / view.scale }),
    [view],
  );

  /** Încadrează desenul (sau fotografia) în fereastră. */
  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const box = bounds(doc);
    const width = box ? box.maxX - box.minX : photo?.naturalWidth ?? 0;
    const height = box ? box.maxY - box.minY : photo?.naturalHeight ?? 0;
    if (width <= 0 || height <= 0) {
      setView({ scale: 1, tx: 0, ty: 0 });
      return;
    }

    const pad = 32;
    const scale = Math.min(
      (wrap.clientWidth - pad * 2) / width,
      (wrap.clientHeight - pad * 2) / height,
    );
    const minX = box ? box.minX : 0;
    const minY = box ? box.minY : 0;
    setView({
      scale,
      tx: (wrap.clientWidth - width * scale) / 2 - minX * scale,
      ty: (wrap.clientHeight - height * scale) / 2 - minY * scale,
    });
  }, [doc, photo]);

  /*
   * La prima fotografie sau primul desen, se încadrează singur.
   *
   * Încadrarea se face un cadru mai târziu, nu în corpul efectului: are nevoie
   * de mărimea reală a ferestrei, iar aceea se știe abia după ce browserul a
   * așezat elementele. E și singurul fel în care React nu se plânge de o
   * schimbare de stare pornită dintr-un efect.
   */
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    if (!photo && Object.keys(doc.points).length === 0) return;
    fitted.current = true;
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [doc, photo, fit]);

  /* ----------------------------- desenarea ------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ratio = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Fotografia, în modurile în care se vede.
    if (photo && mode !== "desen") {
      ctx.save();
      ctx.globalAlpha = mode === "comparare" ? 1 : 1;
      const topLeft = toScreen(0, 0);
      ctx.drawImage(
        photo,
        topLeft.x,
        topLeft.y,
        photo.naturalWidth * view.scale,
        photo.naturalHeight * view.scale,
      );
      ctx.restore();
    }

    if (mode === "foto") return;

    ctx.save();
    ctx.globalAlpha = mode === "comparare" ? overlay : 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const step of [...doc.steps].sort((a, b) => a.index - b.index)) {
      const points = stepPoints(doc, step);
      if (points.length < 2) continue;
      const active = step.id === selection.stepId;

      ctx.beginPath();
      points.forEach((point, position) => {
        const screen = toScreen(point.x, point.y);
        if (position === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.closePath();
      // Linia principală e groasă; treapta selectată se vede și mai bine.
      ctx.strokeStyle = active ? INK.active : INK.main;
      ctx.lineWidth = active ? 3 : 2;
      ctx.stroke();

      // Numărul treptei, în mijlocul ei.
      const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      const middle = toScreen(cx, cy);
      ctx.fillStyle = INK.text;
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(step.index), middle.x, middle.y);

      // Punctele de control apar doar pe treapta aleasă, ca desenul să rămână
      // curat cât timp doar te uiți la el.
      if (!active) continue;
      for (const point of points) {
        const screen = toScreen(point.x, point.y);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, HANDLE, 0, Math.PI * 2);
        ctx.fillStyle = point.id === selection.pointId ? INK.active : INK.handle;
        ctx.fill();
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Cotele: linii subțiri, cu măsura scrisă deasupra.
    ctx.strokeStyle = INK.detail;
    ctx.lineWidth = 1;
    ctx.font = "500 11px system-ui, sans-serif";
    for (const dimension of doc.dimensions) {
      const from = doc.points[dimension.from];
      const to = doc.points[dimension.to];
      if (!from || !to) continue;
      const length = distance(from, to);
      if (length <= 0) continue;

      const nx = (-(to.y - from.y) / length) * dimension.offset;
      const ny = ((to.x - from.x) / length) * dimension.offset;
      const a = toScreen(from.x + nx, from.y + ny);
      const b = toScreen(to.x + nx, to.y + ny);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.fillStyle = INK.detail;
      ctx.fillText(
        dimension.label?.trim() || formatMeasure(doc, length),
        (a.x + b.x) / 2,
        (a.y + b.y) / 2 - 6,
      );
    }

    // Punctele alese pentru calibrare sau pentru o cotă nouă.
    for (const id of picked) {
      const point = doc.points[id];
      if (!point) continue;
      const screen = toScreen(point.x, point.y);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, HANDLE + 3, 0, Math.PI * 2);
      ctx.strokeStyle = INK.active;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }, [doc, photo, mode, overlay, selection, view, toScreen, picked]);

  /* ----------------------------- gesturi --------------------------- */

  /** Punctul de sub deget, dacă e vreunul destul de aproape. */
  const pointAt = useCallback(
    (x: number, y: number): string | null => {
      let best: string | null = null;
      let bestDistance = GRAB;
      for (const point of Object.values(doc.points)) {
        const screen = toScreen(point.x, point.y);
        const away = Math.hypot(screen.x - x, screen.y - y);
        if (away < bestDistance) {
          bestDistance = away;
          best = point.id;
        }
      }
      return best;
    },
    [doc.points, toScreen],
  );

  /** Treapta sub deget: se caută poligonul care cuprinde punctul. */
  const stepAt = useCallback(
    (x: number, y: number): string | null => {
      const target = toDesign(x, y);
      for (const step of [...doc.steps].reverse()) {
        const points = stepPoints(doc, step);
        if (points.length < 3) continue;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          const a = points[i];
          const b = points[j];
          const crosses = a.y > target.y !== b.y > target.y;
          if (
            crosses &&
            target.x < ((b.x - a.x) * (target.y - a.y)) / (b.y - a.y) + a.x
          ) {
            inside = !inside;
          }
        }
        if (inside) return step.id;
      }
      return null;
    },
    [doc, toDesign],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    pointers.current.set(event.pointerId, { x, y });

    // Două degete: se apropie sau se depărtează, deci zoom. Nimic nu se mută.
    if (pointers.current.size === 2) {
      drag.current = null;
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
      return;
    }

    const hitPoint = pointAt(x, y);

    if (tool === "calibrare" || tool === "cota") {
      if (!hitPoint) return;
      const next = [...picked, hitPoint];
      if (next.length === 2) {
        setPicked([]);
        if (tool === "calibrare") onCalibrationPick(next[0], next[1]);
        else onDimensionPick(next[0], next[1]);
      } else {
        setPicked(next);
      }
      return;
    }

    if (hitPoint) {
      const owner =
        doc.steps.find((step) => step.points.includes(hitPoint))?.id ?? selection.stepId;
      onSelectionChange({ stepId: owner, pointId: hitPoint });
      drag.current = { kind: "point", id: hitPoint, lastX: x, lastY: y };
      return;
    }

    const hitStep = stepAt(x, y);
    if (hitStep) {
      onSelectionChange({ stepId: hitStep, pointId: null });
      drag.current = { kind: "step", id: hitStep, lastX: x, lastY: y };
      return;
    }

    onSelectionChange({ stepId: null, pointId: null });
    drag.current = { kind: "pan", id: null, lastX: x, lastY: y };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x, y });
    }

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = spread / pinch.current;
      pinch.current = spread;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      setView((current) => {
        /*
         * Mărirea are capete.
         *
         * Fără ele, o apropiere de degete grăbită duce scara la o miime de
         * pixel — desenul dispare de pe ecran și nu mai ai de ce să-l tragi
         * înapoi, fiindcă nu se mai vede nimic de apucat.
         */
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
        const real = scale / current.scale;
        return {
          scale,
          tx: midX - (midX - current.tx) * real,
          ty: midY - (midY - current.ty) * real,
        };
      });
      return;
    }

    const state = drag.current;
    if (!state) return;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    state.lastX = x;
    state.lastY = y;

    if (state.kind === "pan") {
      setView((current) => ({ ...current, tx: current.tx + dx, ty: current.ty + dy }));
      return;
    }

    // Cât timp degetul e pe ecran, schimbarea nu intră în istoric: altfel
    // „anulează” ar da înapoi un pixel odată.
    if (state.kind === "point" && state.id) {
      const point = doc.points[state.id];
      if (!point) return;
      onDocChange(
        movePoint(doc, state.id, point.x + dx / view.scale, point.y + dy / view.scale),
        false,
      );
      return;
    }
    if (state.kind === "step" && state.id) {
      onDocChange(moveStep(doc, state.id, dx / view.scale, dy / view.scale), false);
    }
  };

  const endGesture = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const state = drag.current;
    drag.current = null;

    /*
     * Dacă rămâne un deget pe ecran, el preia mutarea.
     *
     * Altfel, după o apropiere de degete, ridici unul și celălalt nu mai face
     * nimic: trebuie să-l ridici și pe el și să atingi din nou. Pe un ecran
     * mic, unde tocmai ai mărit ca să vezi o treaptă, asta se simte ca și cum
     * s-ar fi blocat desenul.
     */
    const left = [...pointers.current.values()];
    if (!state && left.length === 1) {
      drag.current = { kind: "pan", id: null, lastX: left[0].x, lastY: left[0].y };
    }
    // Abia la ridicarea degetului se scrie în istoric: o mișcare = un pas.
    if (state && state.kind !== "pan") onDocChange(doc, true);
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const factor = Math.exp(-event.deltaY * 0.002);
    setView((current) => ({
      scale: current.scale * factor,
      tx: x - (x - current.tx) * factor,
      ty: y - (y - current.ty) * factor,
    }));
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setView((current) => ({ ...current })));
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative size-full touch-none overflow-hidden rounded-2xl bg-[#09090B]">
      <canvas
        ref={canvasRef}
        className="size-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onWheel={onWheel}
      />
      <button
        type="button"
        onClick={fit}
        className="absolute bottom-3 right-3 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs backdrop-blur transition-colors hover:bg-accent"
      >
        Încadrează
      </button>
    </div>
  );
}
