"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addPhoto } from "@/lib/db/actions";
import { stampText, storeImage } from "@/lib/storage";
import { useApp } from "@/lib/app-provider";
import { cn } from "@/lib/utils";

/** Culorile de desen: cu ce se scrie pe o poză de șantier ca să se vadă. */
const COLORS = [
  { value: "#06B6D4", label: "Bleu" },
  { value: "#EF4444", label: "Roșu" },
  { value: "#FAFAFA", label: "Alb" },
  { value: "#18181B", label: "Negru" },
];

/** Coala goală, când nu e nicio poză de desenat peste. */
const BLANK = { width: 1200, height: 1600 };
const MAX_SIDE = 1600;

interface Stroke {
  color: string;
  points: { x: number; y: number }[];
}

export function SketchDialog({
  open,
  onOpenChange,
  jobId,
  measurementId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  measurementId?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <Sketch
          jobId={jobId}
          measurementId={measurementId}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Schița: cotele desenate cu degetul peste o poză.
 *
 * O scară cu formă ciudată nu încape în câmpuri. Maistrul o desenează oricum
 * pe o bucată de carton, care se pierde până la montaj. Aici desenul rămâne
 * lângă măsurătoare, în aceeași lucrare.
 *
 * Fără poză merge la fel de bine: o coală albă e tot ce trebuie pentru o
 * schiță făcută în mașină, înainte să urci la etaj.
 */
function Sketch({
  jobId,
  measurementId,
  onOpenChange,
}: {
  jobId: string | null;
  measurementId?: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { userId, settings } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef<Stroke | null>(null);

  const [size, setSize] = useState(BLANK);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [hasImage, setHasImage] = useState(false);

  /** Linia are grosime pe măsura pânzei, ca să se vadă la fel pe orice poză. */
  const lineWidth = Math.max(3, Math.round(Math.max(size.width, size.height) / 260));

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (imageRef.current) {
      context.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = lineWidth;

    const all = drawingRef.current ? [...strokes, drawingRef.current] : strokes;
    for (const stroke of all) {
      if (!stroke.points.length) continue;
      context.strokeStyle = stroke.color;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
      // Un punct singur n-ar desena nimic cu `stroke`; îl închidem pe el însuși.
      if (stroke.points.length === 1) {
        context.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y);
      }
      context.stroke();
    }
  }, [strokes, lineWidth]);

  useEffect(() => {
    paint();
  }, [paint, size]);

  /** Încarcă poza aleasă și potrivește pânza după ea. */
  const loadImage = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("imagine invalidă"));
        image.src = url;
      });
      const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
      imageRef.current = image;
      setHasImage(true);
      setStrokes([]);
      setSize({
        width: Math.round(image.width * scale),
        height: Math.round(image.height * scale),
      });
    } catch {
      toast.error("Poza nu a putut fi deschisă");
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  /** Punctul apăsat, tradus din ecran în pixelii pânzei. */
  const pointOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointOf(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = { color, points: [point] };
    paint();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = pointOf(event);
    if (!point) return;
    drawingRef.current.points.push(point);
    // Desenăm direct: o stare nouă la fiecare mișcare de deget ar sufoca
    // randarea exact când omul trage linia.
    paint();
  };

  const onPointerUp = () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke?.points.length) setStrokes((current) => [...current, stroke]);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes.length) {
      toast.error("Desenează ceva mai întâi");
      return;
    }
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("fără imagine");
      const file = new File([blob], "schita.jpg", { type: "image/jpeg" });
      const asset = await storeImage(
        file,
        "sketches",
        userId,
        stampText(settings?.photo_stamp),
      );
      await addPhoto({
        job_id: jobId,
        measurement_id: measurementId ?? null,
        // Schița se face înainte de lucrare, la măsurat.
        stage: "before",
        storage_path: asset.storage_path,
        local_key: asset.local_key,
        caption: "Schiță",
      });
      toast.success("Schiță salvată");
      onOpenChange(false);
    } catch {
      toast.error("Schița nu a putut fi salvată");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Schiță</DialogTitle>
        <DialogDescription>
          Desenează cotele cu degetul. Peste o poză sau pe o coală albă.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="w-full touch-none rounded-xl border border-border bg-white"
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
          aria-label="Suprafața de desen"
        />

        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-label={item.label}
              onClick={() => setColor(item.value)}
              className={cn(
                "size-8 rounded-full border-2 transition-transform",
                color === item.value
                  ? "border-primary scale-110"
                  : "border-border",
              )}
              style={{ backgroundColor: item.value }}
            />
          ))}

          <span className="flex-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Înapoi o linie"
            disabled={!strokes.length}
            onClick={() => setStrokes((current) => current.slice(0, -1))}
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Șterge tot desenul"
            disabled={!strokes.length}
            onClick={() => setStrokes([])}
          >
            <Eraser />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus /> {hasImage ? "Altă poză" : "Poză"}
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadImage(file);
            event.target.value = "";
          }}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Renunță
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Salvează schița
        </Button>
      </DialogFooter>
    </>
  );
}
