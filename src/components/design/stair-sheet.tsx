"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { layoutSheet, place } from "@/lib/design/sheet";
import type { PlacedPane, Sheet, TextRole, Weight } from "@/lib/design/sheet";

/**
 * Planșa pe ecran.
 *
 * Foaia e albă, deși aplicația e întunecată. Nu e o scăpare: desenul ăsta se
 * printează și ajunge în mână pe șantier, iar acolo negru pe alb e singurul
 * lucru care se vede. Tot din motivul ăsta desenează exact ce scrie și SVG-ul
 * — aceeași descriere, același cod de așezare — ca planșa de pe telefon și cea
 * de pe hârtie să nu fie două desene diferite.
 */
const INK = {
  line: "#09090b",
  thin: "#52525b",
  frame: "#d4d4d8",
  text: "#18181b",
  paper: "#ffffff",
  warn: "#b45309",
};

const TEXT_SIZE: Record<TextRole, number> = { cota: 15, numar: 13, titlu: 19 };

function strokeOf(weight: Weight): number {
  return weight === "main" ? 2 : 0.6;
}

function drawPane(context: CanvasRenderingContext2D, placed: PlacedPane) {
  const { frame, pane } = placed;

  context.strokeStyle = INK.frame;
  context.lineWidth = 1;
  context.strokeRect(frame.x + 8, frame.y + 8, frame.width - 16, frame.height - 16);

  context.fillStyle = INK.text;
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
    // Umplut cu alb, ca treapta din față s-o acopere pe cea din spate.
    context.fillStyle = INK.paper;
    context.fill();
    context.strokeStyle = INK.line;
    context.lineWidth = strokeOf(polygon.weight);
    context.lineJoin = "round";
    context.stroke();
  }

  context.strokeStyle = INK.thin;
  for (const line of pane.lines) {
    const a = place(placed, line.a);
    const b = place(placed, line.b);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.lineWidth = strokeOf(line.weight);
    context.stroke();
  }

  context.fillStyle = INK.text;
  context.textBaseline = "middle";
  for (const text of pane.texts) {
    const at = place(placed, text.at);
    context.font = `${TEXT_SIZE[text.role]}px system-ui, sans-serif`;
    context.textAlign = text.anchor === "middle" ? "center" : text.anchor;
    context.fillText(text.value, at.x, at.y);
  }
}

export function StairSheet({ sheet, tall }: { sheet: Sheet; tall: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  /* Gestul stă în ref: la fiecare mișcare de deget, un render ar rămâne în urmă. */
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

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
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = INK.paper;
    context.fillRect(0, 0, width, height);

    const { page, panes } = layoutSheet(sheet, tall);
    // Pagina se încadrează în fereastră, iar zoom-ul se adaugă peste.
    const fit = Math.min(width / page.width, height / page.height);
    const scale = fit * zoom;
    context.save();
    context.translate(
      (width - page.width * scale) / 2 + pan.x,
      (height - page.height * scale) / 2 + pan.y,
    );
    context.scale(scale, scale);

    for (const placed of panes) drawPane(context, placed);

    const size = sheet.footprint;
    context.fillStyle = INK.thin;
    context.font = "14px system-ui, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(
      `${sheet.title} — gabarit ${size.width} × ${size.run} mm, înălțime ${size.height} mm`,
      24,
      page.height - 18,
    );
    if (sheet.warnings.length) {
      context.fillStyle = INK.warn;
      context.textAlign = "right";
      context.fillText(sheet.warnings[0], page.width - 24, page.height - 18);
    }

    context.restore();
  }, [sheet, tall, zoom, pan]);

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

  const spread = () => {
    const values = [...pointers.current.values()];
    if (values.length < 2) return null;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-none overflow-hidden rounded-xl bg-white"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 2) pinch.current = spread();
        else drag.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.current.size === 2) {
          const now = spread();
          if (now && pinch.current) {
            setZoom((value) => Math.min(6, Math.max(0.4, value * (now / pinch.current!))));
            pinch.current = now;
          }
          return;
        }

        const from = drag.current;
        if (!from) return;
        setPan((value) => ({
          x: value.x + (event.clientX - from.x),
          y: value.y + (event.clientY - from.y),
        }));
        drag.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        if (pointers.current.size === 0) drag.current = null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        drag.current = null;
      }}
      onWheel={(event) => {
        setZoom((value) => Math.min(6, Math.max(0.4, value * (event.deltaY < 0 ? 1.1 : 0.9))));
      }}
      onDoubleClick={() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
