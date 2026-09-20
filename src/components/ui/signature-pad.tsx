"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Eraser } from "lucide-react";
import { Button } from "./button";

/**
 * Semnătura clientului, desenată cu degetul.
 *
 * Iese un PNG ca data URL, suficient de mic cât să stea în rândul
 * procesului-verbal și să se sincronizeze odată cu el.
 *
 * Pânza se desenează la rezoluția ecranului (`devicePixelRatio`), altfel linia
 * iese pixelată pe telefon; coordonatele rămân în puncte CSS.
 */
export function SignaturePad({
  onDone,
  busy,
}: {
  onDone: (dataUrl: string) => void | Promise<void>;
  busy?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  /** Mărimea reală se pune la montare: pânza nu se redimensionează singură. */
  const attach = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#FAFAFA";
  }, []);

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = pointAt(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = pointAt(event);
    context.lineTo(x, y);
    context.stroke();
    if (!hasInk) setHasInk(true);
  };

  const stop = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  return (
    <div className="space-y-2.5">
      <canvas
        ref={attach}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        aria-label="Zonă de semnătură"
        className="h-40 w-full touch-none rounded-xl border border-dashed border-border bg-background"
      />
      <p className="text-center text-xs text-muted-foreground">
        Semnează cu degetul în casetă
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={clear} disabled={!hasInk}>
          <Eraser /> Șterge
        </Button>
        <Button
          type="button"
          disabled={!hasInk}
          loading={busy}
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            void onDone(canvas.toDataURL("image/png"));
          }}
        >
          <Check /> Confirmă
        </Button>
      </div>
    </div>
  );
}
