"use client";

import { useCallback, useRef, useState } from "react";
import {
  Camera,
  FileDown,
  ImageDown,
  Loader2,
  Plus,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  DesignCanvas,
  type CanvasSelection,
  type Tool,
  type ViewMode,
} from "@/components/design/design-canvas";
import {
  DetectionCard,
  DimensionList,
  ScaleBadge,
  ScaleCard,
  StepList,
} from "@/components/design/design-tools";
import { detectStairs } from "@/lib/design/detect";
import {
  addDimension,
  emptyDesign,
  isEmpty,
  rotate,
  scaleBy,
  type DesignDoc,
} from "@/lib/design/model";
import { scaleFrom } from "@/lib/design/measure";
import { downloadPdf, downloadPng, downloadSvg } from "@/lib/design/export";
import { saveDesign } from "@/lib/db/actions";
import { cn } from "@/lib/utils";

/**
 * Design: fotografia unei scări, transformată în desen tehnic.
 *
 * Ce face pagina, spus cinstit: citește muchiile din fotografie cu procesare de
 * imagine — gri, înmuiere, Sobel, transformată Hough — și scoate din ele
 * treptele. Nu e o rețea neuronală și nu cere internet; merge în casa scării,
 * fără semnal, ceea ce pentru un montator contează mai mult.
 *
 * Rezultatul e geometrie, nu imagine: puncte care se trag cu degetul, trepte
 * care se adaugă și se șterg, cote legate de puncte. De aceea desenul poate fi
 * corectat înainte de a fi folosit la măsurători sau la debitat — și de aceea
 * din el se poate socoti mai târziu suprafața și materialul.
 *
 * Și lucrul de care atârnă tot: dintr-o poză nu se poate ști mărimea reală.
 * Până la calibrare, fiecare cifră de pe ecran e o proporție și scrie asta.
 */

/** Cât de mare intră fotografia în memorie. Peste atât, se micșorează. */
const MAX_PHOTO = 2000;

type Busy = "none" | "loading" | "detecting";

export default function DesignPage() {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [pixels, setPixels] = useState<{ data: Uint8ClampedArray; width: number; height: number } | null>(null);
  const [doc, setDoc] = useState<DesignDoc>(emptyDesign());
  const [history, setHistory] = useState<DesignDoc[]>([]);
  const [mode, setMode] = useState<ViewMode>("comparare");
  const [overlay, setOverlay] = useState(0.9);
  const [tool, setTool] = useState<Tool>("muta");
  const [selection, setSelection] = useState<CanvasSelection>({ stepId: null, pointId: null });
  const [busy, setBusy] = useState<Busy>("none");
  const [title, setTitle] = useState("Desen scară");
  const [calibration, setCalibration] = useState<{ a: string; b: string } | null>(null);
  /*
   * Pe telefon, canvasul trebuie să ia cât mai mult din ecran: desenul se
   * corectează cu degetul, iar un panou lipit lângă el ar lăsa geometria pe
   * o fâșie. Uneltele se trag de jos, când e nevoie de ele. Pe desktop
   * steagul nu contează — acolo panoul stă mereu la vedere.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [realMm, setRealMm] = useState(1000);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  /** O schimbare cu intrare în istoric, sau una din timpul unui gest. */
  const change = useCallback(
    (next: DesignDoc, commit = true) => {
      if (commit) setHistory((past) => [...past.slice(-30), doc]);
      setDoc(next);
    },
    [doc],
  );

  const undo = () => {
    setHistory((past) => {
      if (!past.length) return past;
      setDoc(past[past.length - 1]);
      return past.slice(0, -1);
    });
  };

  /* ----------------------------- fotografia ------------------------ */

  const loadPhoto = async (file: File) => {
    setBusy("loading");
    try {
      const bitmap = await createImageBitmap(file);
      const factor = Math.min(1, MAX_PHOTO / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * factor);
      const height = Math.round(bitmap.height * factor);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("fără canvas");
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();

      const image = new Image();
      image.src = canvas.toDataURL("image/jpeg", 0.92);
      await new Promise((resolve) => {
        image.onload = resolve;
      });

      setPixels({ data: context.getImageData(0, 0, width, height).data, width, height });
      setPhoto(image);
      setDoc(emptyDesign());
      setHistory([]);
      setSelection({ stepId: null, pointId: null });
      setMode("foto");
    } catch {
      /*
       * Cel mai des e un HEIC pe un telefon care nu-l poate deschide singur.
       * Se spune ce e de făcut, nu doar că „n-a mers”.
       */
      toast.error(
        "Fotografia nu a putut fi citită. Dacă e HEIC, salvează-o ca JPG și încearcă din nou.",
      );
    } finally {
      setBusy("none");
    }
  };

  /* ----------------------------- citirea --------------------------- */

  const generate = async () => {
    if (!pixels) return;
    setBusy("detecting");
    // Un cadru, ca butonul să apuce să arate că lucrează înainte de socoteală.
    await new Promise((resolve) => setTimeout(resolve, 16));
    try {
      const result = detectStairs(pixels.data, pixels.width, pixels.height);
      setHistory((past) => [...past.slice(-30), doc]);
      setDoc(result.doc);
      setSelection({ stepId: null, pointId: null });
      setMode("comparare");

      if (result.detection.steps > 0) {
        toast.success(`${result.detection.steps} trepte detectate`);
      } else {
        toast.warning("Nu s-au găsit trepte în fotografie");
      }
    } finally {
      setBusy("none");
    }
  };

  /* ----------------------------- unelte ---------------------------- */

  const onCalibrationPick = (a: string, b: string) => {
    setCalibration({ a, b });
    setTool("muta");
  };

  const applyCalibration = () => {
    if (!calibration) return;
    const from = doc.points[calibration.a];
    const to = doc.points[calibration.b];
    const scale = from && to ? scaleFrom(from, to, realMm) : null;
    if (scale === null) {
      toast.error("Cele două puncte sunt prea aproape pentru o calibrare.");
      return;
    }
    change({ ...doc, scale });
    setCalibration(null);
    toast.success("Desenul are acum milimetri");
  };

  const onDimensionPick = (a: string, b: string) => {
    change(addDimension(doc, a, b));
    setTool("muta");
    toast.success("Cotă adăugată");
  };

  const save = async () => {
    if (isEmpty(doc)) {
      toast.error("Nu e nimic de salvat încă.");
      return;
    }
    await saveDesign({
      title,
      doc,
      scale_mm: doc.scale,
      detected_steps: doc.detection?.steps ?? null,
      detected_kind: doc.detection?.kind ?? null,
      detected_confidence: doc.detection?.confidence ?? null,
    });
    toast.success("Desen salvat");
  };

  const hasDrawing = !isEmpty(doc);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Design"
        description="Transformă fotografia într-un desen tehnic al treptelor"
        action={hasDrawing ? <ScaleBadge doc={doc} /> : undefined}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void loadPhoto(file);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void loadPhoto(file);
          event.target.value = "";
        }}
      />

      {!photo ? (
        <EmptyState
          icon={Camera}
          title="Încarcă fotografia scării"
          description="JPG, PNG sau HEIC. Cel mai bine iese dintr-o poză luată din lateral, cu muchiile treptelor vizibile."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="xl" onClick={() => fileRef.current?.click()} loading={busy === "loading"}>
                <Upload /> Încarcă fotografia
              </Button>
              <Button size="xl" variant="outline" onClick={() => cameraRef.current?.click()}>
                <Camera /> Fotografiază
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          {/* ----- stânga: canvasul ----- */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<ViewMode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: "foto", label: "Foto" },
                  { value: "desen", label: "Desen" },
                  { value: "comparare", label: "Comparare" },
                ]}
              />
              {mode === "comparare" && hasDrawing && (
                <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
                  Transparență
                  <input
                    type="range"
                    min={0.15}
                    max={1}
                    step={0.05}
                    value={overlay}
                    onChange={(event) => setOverlay(Number(event.target.value))}
                    className="flex-1 accent-primary"
                    aria-label="Transparența desenului"
                  />
                </label>
              )}
            </div>

            <div className="h-[55vh] min-h-72 lg:h-[calc(100vh-18rem)]">
              <DesignCanvas
                doc={doc}
                photo={photo}
                mode={mode}
                overlay={overlay}
                tool={tool}
                selection={selection}
                onSelectionChange={setSelection}
                onDocChange={(next, commit) => change(next, commit)}
                onCalibrationPick={onCalibrationPick}
                onDimensionPick={onDimensionPick}
              />
            </div>

            {tool !== "muta" && (
              <p className="rounded-xl bg-primary/10 p-2.5 text-xs text-primary-soft">
                {tool === "calibrare"
                  ? "Apasă două puncte de control între care știi distanța reală."
                  : "Apasă două puncte de control între care vrei cota."}
              </p>
            )}

            {!hasDrawing && (
              <Button
                size="xl"
                className="w-full"
                onClick={() => void generate()}
                loading={busy === "detecting"}
              >
                <Sparkles /> Generează desenul
              </Button>
            )}
          </div>

          {/* ----- dreapta pe desktop, foaie de jos pe telefon ----- */}
          <div className={cn("space-y-3", !sheetOpen && "hidden lg:block")}>
            <Field label="Numele desenului">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <DetectionCard doc={doc} />
            {hasDrawing && (
              <>
                <ScaleCard
                  doc={doc}
                  onCalibrate={() => setTool("calibrare")}
                  onClear={() => change({ ...doc, scale: null })}
                />

                <section className="surface space-y-2.5 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold">Desenul întreg</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => change(rotate(doc, -5))}>
                      <RotateCcw /> Rotește
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => change(rotate(doc, 5))}>
                      <RotateCw /> Rotește
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => change(scaleBy(doc, 1.1))}>
                      Mărește
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => change(scaleBy(doc, 1 / 1.1))}>
                      Micșorează
                    </Button>
                  </div>
                </section>

                <StepList
                  doc={doc}
                  selection={selection}
                  onSelect={setSelection}
                  onDocChange={(next) => change(next)}
                />
                <DimensionList doc={doc} onDocChange={(next) => change(next)} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ----- jos: acțiunile ----- */}
      {photo && (
        <div
          className={cn(
            "sticky bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-10 flex flex-wrap gap-2",
            "rounded-2xl surface p-2 lg:static",
          )}
        >
          <Button variant="outline" size="sm" onClick={() => void generate()} loading={busy === "detecting"}>
            {busy === "detecting" ? <Loader2 className="animate-spin" /> : <Sparkles />} Regenerare
          </Button>
          <Button variant="outline" size="sm" onClick={undo} disabled={!history.length}>
            <Undo2 /> Înapoi
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTool("cota")} disabled={!hasDrawing}>
            <Plus /> Adaugă cotă
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTool("calibrare")} disabled={!hasDrawing}>
            <Ruler /> Calibrează
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setSheetOpen((open) => !open)}
          >
            <SlidersHorizontal /> {sheetOpen ? "Ascunde uneltele" : "Unelte"}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => downloadSvg(doc, title)} disabled={!hasDrawing}>
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={() => void downloadPng(doc, title)} disabled={!hasDrawing}>
            <ImageDown /> PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => void downloadPdf(doc, title)} disabled={!hasDrawing}>
            <FileDown /> PDF
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={!hasDrawing}>
            <Save /> Salvează
          </Button>
        </div>
      )}

      <Dialog open={!!calibration} onOpenChange={(open) => !open && setCalibration(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cât este, în realitate?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Distanța dintre cele două puncte alese. De aici încolo, tot desenul
              are milimetri.
            </p>
            <Field label="Distanța reală">
              <NumberInput value={realMm} onChange={setRealMm} suffix="mm" step={10} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalibration(null)}>
              Anulează
            </Button>
            <Button onClick={applyCalibration}>Setează scara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
