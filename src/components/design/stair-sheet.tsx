"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PAGE_TALL,
  PAGE_WIDE,
  PALETTES,
  fillOf,
  layoutSheet,
  place,
  strokeOf,
} from "@/lib/design/sheet";
import type { Finish, Palette, PlacedPane, Sheet, TextRole } from "@/lib/design/sheet";

/**
 * Planșa pe ecran.
 *
 * Foaia e deschisă la culoare, deși aplicația e întunecată. Nu e o scăpare:
 * desenul ăsta se printează și ajunge în mână, iar acolo cerneala pe hârtie e
 * singurul lucru care se vede. Culorile vin din aceeași paletă pe care o
 * citesc SVG-ul și PDF-ul, ca planșa de pe ecran și cea de pe hârtie să nu
 * înceapă să se depărteze una de alta.
 */
const TEXT_SIZE: Record<TextRole, number> = { cota: 15, numar: 13, titlu: 19 };

function drawPane(context: CanvasRenderingContext2D, placed: PlacedPane, ink: Palette) {
  const { frame, pane } = placed;

  context.strokeStyle = ink.frame;
  context.lineWidth = 1;
  context.strokeRect(frame.x + 8, frame.y + 8, frame.width - 16, frame.height - 16);

  context.fillStyle = ink.text;
  context.font = `${TEXT_SIZE.titlu}px system-ui, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(pane.title, frame.x + 22, frame.y + 34);

  for (const polygon of pane.polygons) {
    if (polygon.points.length < 2) continue;
    context.beginPath();
    polygon.points.forEach((point, index) => {
      const p = place(placed, point);
      if (index === 0) context.moveTo(p.x, p.y);
      else context.lineTo(p.x, p.y);
    });
    context.closePath();
    // Umplut în plin, ca treapta din față s-o acopere pe cea din spate.
    context.fillStyle = fillOf(ink, polygon.kind, polygon.tone, polygon.variant);
    context.fill();
    context.strokeStyle = ink.outline;
    context.lineWidth = strokeOf(ink, polygon.weight);
    context.lineJoin = "round";
    context.stroke();

    // Firul lemnului, imediat după fața lui: altfel îl acoperă următoarea față.
    if (ink.grain) {
      context.strokeStyle = ink.grain[polygon.tone];
      context.lineWidth = 0.7;
      for (const line of polygon.grain) {
        const a = place(placed, line.a);
        const b = place(placed, line.b);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }
  }

  context.strokeStyle = ink.thin;
  for (const line of pane.lines) {
    const a = place(placed, line.a);
    const b = place(placed, line.b);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.lineWidth = strokeOf(ink, line.weight);
    context.stroke();
  }

  context.fillStyle = ink.text;
  context.textBaseline = "middle";
  for (const text of pane.texts) {
    const at = place(placed, text.at);
    context.font = `${TEXT_SIZE[text.role]}px system-ui, sans-serif`;
    context.textAlign = text.anchor === "middle" ? "center" : text.anchor;
    context.fillText(text.value, at.x, at.y);
  }
}

export function StairSheet({
  sheet,
  tall,
  finish,
}: {
  sheet: Sheet;
  tall: boolean;
  finish: Finish;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /*
   * Mărirea și mutarea stau într-o singură stare.
   *
   * Ținute separat, o apropiere de degete ar cere două schimbări deodată — una
   * de zoom, una de poziție —, iar a doua ar citi poziția dinainte de prima.
   * La un deget care se mișcă de zeci de ori pe secundă, desenul ar aluneca
   * încet în lături fără ca cineva să-l fi tras.
   */
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });

  /* Gestul stă în ref: la fiecare mișcare de deget, un render ar rămâne în urmă. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** Degetul rămas, pentru mutare. Se reașază când unul se ridică. */
  const last = useRef<{ x: number; y: number } | null>(null);
  /** Depărtarea și mijlocul dintre două degete, la ultima măsurare. */
  const pinch = useRef<{ gap: number; x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ratio = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width <= 0 || height <= 0) return;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    const ink = PALETTES[finish];
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = ink.paper;
    context.fillRect(0, 0, width, height);

    const { page, panes } = layoutSheet(sheet, tall);
    // Pagina se încadrează în fereastră, iar zoom-ul se adaugă peste.
    const fit = Math.min(width / page.width, height / page.height);
    const scale = fit * view.zoom;
    context.save();
    context.translate(
      (width - page.width * scale) / 2 + view.x,
      (height - page.height * scale) / 2 + view.y,
    );
    context.scale(scale, scale);

    for (const placed of panes) drawPane(context, placed, ink);

    const size = sheet.footprint;
    context.fillStyle = ink.thin;
    context.font = "14px system-ui, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(
      `${sheet.title} — gabarit ${size.width} × ${size.run} mm, înălțime ${size.height} mm`,
      24,
      page.height - 18,
    );
    if (sheet.warnings.length) {
      context.fillStyle = ink.warn;
      context.textAlign = "right";
      context.fillText(sheet.warnings[0], page.width - 24, page.height - 18);
    }

    context.restore();
  }, [sheet, tall, finish, view]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 8;

  /** Depărtarea și mijlocul dintre primele două degete. */
  const gesture = () => {
    const fingers = [...pointers.current.values()];
    if (fingers.length < 2) return null;
    return {
      gap: Math.hypot(fingers[0].x - fingers[1].x, fingers[0].y - fingers[1].y),
      x: (fingers[0].x + fingers[1].x) / 2,
      y: (fingers[0].y + fingers[1].y) / 2,
    };
  };

  const moveBy = useCallback((dx: number, dy: number) => {
    setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }, []);

  /**
   * Mărește în jurul unui punct de pe ecran, nu în jurul mijlocului foii.
   *
   * Asta e deosebirea dintre o apropiere de degete care se simte firească și
   * una care fuge: punctul de sub degete trebuie să rămână sub degete. Mărit
   * față de mijloc, colțul la care te uiți o ia într-o parte și trebuie să
   * tragi desenul înapoi după fiecare apropiere.
   */
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const frame = wrap.getBoundingClientRect();
      if (frame.width <= 0 || frame.height <= 0) return;

      const screenX = clientX - frame.left;
      const screenY = clientY - frame.top;
      const page = tall ? PAGE_TALL : PAGE_WIDE;
      const fit = Math.min(frame.width / page.width, frame.height / page.height);

      setView((current) => {
        const zoomed = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor));
        const before = fit * current.zoom;
        const after = fit * zoomed;
        if (before <= 0) return current;

        // Punctul din foaie care stă acum sub deget.
        const sheetX = (screenX - ((frame.width - page.width * before) / 2 + current.x)) / before;
        const sheetY = (screenY - ((frame.height - page.height * before) / 2 + current.y)) / before;

        return {
          zoom: zoomed,
          x: screenX - sheetX * after - (frame.width - page.width * after) / 2,
          y: screenY - sheetY * after - (frame.height - page.height * after) / 2,
        };
      });
    },
    [tall],
  );

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-none overflow-hidden rounded-xl"
      style={{ backgroundColor: PALETTES[finish].paper }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size >= 2) {
          pinch.current = gesture();
          last.current = null;
        } else {
          last.current = { x: event.clientX, y: event.clientY };
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.current.size >= 2) {
          const now = gesture();
          const before = pinch.current;
          if (now && before) {
            // Întâi mutarea mijlocului, apoi mărirea în jurul lui: două degete
            // care se plimbă împreună trag foaia, nu doar o măresc pe loc.
            moveBy(now.x - before.x, now.y - before.y);
            if (before.gap > 0) zoomAt(now.gap / before.gap, now.x, now.y);
            pinch.current = now;
          }
          return;
        }

        const from = last.current;
        if (!from) {
          last.current = { x: event.clientX, y: event.clientY };
          return;
        }
        moveBy(event.clientX - from.x, event.clientY - from.y);
        last.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = gesture();
        /*
         * Reazemul se mută pe degetul rămas.
         *
         * Fără asta, după ce ridici un deget din apropiere, mutarea pornește de
         * la locul unde ai pus primul deget cu câteva secunde în urmă — și
         * desenul sare într-o parte cât toată distanța dintre timp.
         */
        const left = [...pointers.current.values()];
        last.current = left.length === 1 ? { ...left[0] } : null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        last.current = null;
      }}
      onWheel={(event) => {
        zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
      }}
      onDoubleClick={() => setView({ zoom: 1, x: 0, y: 0 })}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
