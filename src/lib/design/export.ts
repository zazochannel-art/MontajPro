/**
 * Desenul, scos din aplicație.
 *
 * SVG-ul e forma de bază, iar PNG-ul și PDF-ul ies din aceleași linii. Nicăieri
 * o captură de ecran: un desen tehnic capturat ca poză nu mai poate fi mărit,
 * măsurat sau dus la o mașină de debitat. Chiar și PDF-ul se scrie ca linii, nu
 * ca imagine — altfel milimetrul de pe hârtie nu mai e milimetru.
 *
 * Culorile ies negru pe alb, oricât de întunecată e aplicația: desenul se
 * printează și se ține în mână pe șantier.
 */
import { formatMeasure, distance } from "./measure";
import { bounds, stepPoints } from "./model";
import type { DesignDoc } from "./model";
import { layoutSheet, place } from "./sheet";
import type { Sheet, TextRole, Weight } from "./sheet";

/** Grosimile: conturul se vede de la distanță, detaliile nu-l încarcă. */
const MAIN_WIDTH = 2;
const DETAIL_WIDTH = 0.6;
const MARGIN = 24;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SvgOptions {
  /** Scrie numărul fiecărei trepte în mijlocul ei. */
  numbers?: boolean;
  /** Desenează cotele. */
  dimensions?: boolean;
}

/**
 * Desenul ca SVG.
 *
 * Fiecare treaptă e un poligon închis, cu conturul gros; liniile subțiri sunt
 * cotele și numerele. Fără umpluturi, fără umbre, fără nimic care să nu fie o
 * muchie adevărată.
 */
export function toSvg(doc: DesignDoc, options: SvgOptions = {}): string {
  const box = bounds(doc);
  if (!box) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>`;
  }

  const width = box.maxX - box.minX + MARGIN * 2;
  const height = box.maxY - box.minY + MARGIN * 2;
  const dx = MARGIN - box.minX;
  const dy = MARGIN - box.minY;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  for (const step of [...doc.steps].sort((a, b) => a.index - b.index)) {
    const points = stepPoints(doc, step);
    if (points.length < 2) continue;

    const path = points
      .map((point) => `${(point.x + dx).toFixed(1)},${(point.y + dy).toFixed(1)}`)
      .join(" ");
    parts.push(
      `<polygon points="${path}" fill="none" stroke="#000000" stroke-width="${MAIN_WIDTH}" stroke-linejoin="round"/>`,
    );

    if (options.numbers !== false && points.length >= 3) {
      const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length + dx;
      const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length + dy;
      parts.push(
        `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="sans-serif" font-size="11" fill="#000000" text-anchor="middle" dominant-baseline="middle">${step.index}</text>`,
      );
    }
  }

  if (options.dimensions !== false) {
    for (const dimension of doc.dimensions) {
      const from = doc.points[dimension.from];
      const to = doc.points[dimension.to];
      if (!from || !to) continue;

      // Cota stă alături de linia pe care o măsoară, pe perpendiculara ei.
      const length = distance(from, to);
      if (length <= 0) continue;
      const nx = (-(to.y - from.y) / length) * dimension.offset;
      const ny = ((to.x - from.x) / length) * dimension.offset;

      const x1 = from.x + dx + nx;
      const y1 = from.y + dy + ny;
      const x2 = to.x + dx + nx;
      const y2 = to.y + dy + ny;

      parts.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000000" stroke-width="${DETAIL_WIDTH}"/>`,
      );
      // Liniile de legătură până la punctele măsurate.
      parts.push(
        `<line x1="${(from.x + dx).toFixed(1)}" y1="${(from.y + dy).toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#000000" stroke-width="${DETAIL_WIDTH}"/>`,
      );
      parts.push(
        `<line x1="${(to.x + dx).toFixed(1)}" y1="${(to.y + dy).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000000" stroke-width="${DETAIL_WIDTH}"/>`,
      );

      const label = dimension.label?.trim() || formatMeasure(doc, length);
      parts.push(
        `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 - 4).toFixed(1)}" font-family="sans-serif" font-size="10" fill="#000000" text-anchor="middle">${escapeXml(label)}</text>`,
      );
    }
  }

  parts.push("</svg>");
  return parts.join("\n");
}

/** Numele fișierului, fără diacritice și fără spații. */
export function fileName(title: string, extension: string): string {
  const clean = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${clean || "desen"}.${extension}`;
}

/* ------------------------------------------------------------------ */
/* Ieșirile care au nevoie de browser                                  */
/* ------------------------------------------------------------------ */

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadSvg(doc: DesignDoc, title: string) {
  download(new Blob([toSvg(doc)], { type: "image/svg+xml" }), fileName(title, "svg"));
}

/** PNG, din același SVG, la dublu ca liniile să nu iasă moi. */
export async function downloadPng(doc: DesignDoc, title: string, scale = 2) {
  const svg = toSvg(doc);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Desenul nu a putut fi redat"));
      element.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Desenul nu a putut fi redat");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (png) download(png, fileName(title, "png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * PDF cu linii adevărate.
 *
 * Restul aplicației scoate PDF-uri ca poză a ecranului, și are dreptate acolo:
 * o ofertă trebuie să arate exact ca pe ecran, cu diacritice cu tot. Un desen
 * tehnic e altceva — el ajunge la o mașină sau sub un șubler, deci liniile se
 * scriu ca linii. Când desenul e calibrat, foaia păstrează și scara: un
 * milimetru pe hârtie chiar e un milimetru.
 */
export async function downloadPdf(doc: DesignDoc, title: string) {
  const { jsPDF } = await import("jspdf");
  const box = bounds(doc);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  pdf.setFontSize(14);
  pdf.text(title || "Desen scară", margin, margin);

  if (!box) {
    pdf.setFontSize(10);
    pdf.text("Desenul este gol.", margin, margin + 8);
    pdf.save(fileName(title, "pdf"));
    return;
  }

  const drawWidth = box.maxX - box.minX;
  const drawHeight = box.maxY - box.minY;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - 18;
  const factor = Math.min(usableWidth / drawWidth, usableHeight / drawHeight);

  const toPage = (point: { x: number; y: number }) => ({
    x: margin + (point.x - box.minX) * factor,
    y: margin + 12 + (point.y - box.minY) * factor,
  });

  pdf.setDrawColor(0, 0, 0);
  for (const step of [...doc.steps].sort((a, b) => a.index - b.index)) {
    const points = stepPoints(doc, step).map(toPage);
    if (points.length < 2) continue;

    pdf.setLineWidth(0.5);
    for (let i = 0; i < points.length; i += 1) {
      const from = points[i];
      const to = points[(i + 1) % points.length];
      pdf.line(from.x, from.y, to.x, to.y);
    }

    pdf.setFontSize(8);
    const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    pdf.text(String(step.index), cx, cy, { align: "center" });
  }

  pdf.setLineWidth(0.2);
  pdf.setFontSize(7);
  for (const dimension of doc.dimensions) {
    const from = doc.points[dimension.from];
    const to = doc.points[dimension.to];
    if (!from || !to) continue;
    const a = toPage(from);
    const b = toPage(to);
    pdf.line(a.x, a.y, b.x, b.y);
    const label = dimension.label?.trim() || formatMeasure(doc, distance(from, to));
    pdf.text(label, (a.x + b.x) / 2, (a.y + b.y) / 2 - 1.5, { align: "center" });
  }

  pdf.setFontSize(8);
  const note =
    doc.scale === null
      ? "Desen necalibrat — cifrele sunt proporții, nu milimetri."
      : `Calibrat: 1 unitate = ${doc.scale.toFixed(2)} mm.`;
  pdf.text(note, margin, pageHeight - margin + 4);

  pdf.save(fileName(title, "pdf"));
}

/* ------------------------------------------------------------------ */
/* Planșa cu vederi                                                    */
/* ------------------------------------------------------------------ */


/** Mărimile de scris, în puncte de pagină. Nu se scalează cu desenul. */
const TEXT_SIZE: Record<TextRole, number> = { cota: 15, numar: 13, titlu: 19 };

function strokeOf(weight: Weight): number {
  return weight === "main" ? MAIN_WIDTH : DETAIL_WIDTH;
}

/**
 * Planșa ca SVG: pagina întreagă, cu toate vederile.
 *
 * Negru pe alb, ca desenul din poza de la care am pornit — și fiindcă foaia
 * asta se printează și se ține în mână pe șantier, unde tema întunecată a
 * aplicației n-ajută pe nimeni.
 */
export function sheetToSvg(sheet: Sheet, tall = false): string {
  const { page, panes } = layoutSheet(sheet, tall);
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  for (const placed of panes) {
    const { frame } = placed;
    parts.push(
      `<rect x="${frame.x + 8}" y="${frame.y + 8}" width="${frame.width - 16}" height="${frame.height - 16}" fill="none" stroke="#d4d4d8" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${frame.x + 22}" y="${frame.y + 34}" font-family="system-ui, sans-serif" font-size="${TEXT_SIZE.titlu}" fill="#18181b">${escapeXml(placed.pane.title)}</text>`,
    );

    for (const polygon of placed.pane.polygons) {
      const points = polygon.points
        .map((p) => {
          const q = place(placed, p);
          return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(" ");
      parts.push(
        `<polygon points="${points}" fill="#ffffff" stroke="#09090b" stroke-width="${strokeOf(polygon.weight)}" stroke-linejoin="round"/>`,
      );
    }

    for (const line of placed.pane.lines) {
      const a = place(placed, line.a);
      const b = place(placed, line.b);
      parts.push(
        `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#52525b" stroke-width="${strokeOf(line.weight)}"/>`,
      );
    }

    for (const text of placed.pane.texts) {
      const at = place(placed, text.at);
      const anchor = text.anchor === "middle" ? "middle" : text.anchor;
      parts.push(
        `<text x="${at.x.toFixed(1)}" y="${at.y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="${TEXT_SIZE[text.role]}" fill="#18181b">${escapeXml(text.value)}</text>`,
      );
    }
  }

  const size = sheet.footprint;
  parts.push(
    `<text x="24" y="${page.height - 18}" font-family="system-ui, sans-serif" font-size="14" fill="#52525b">${escapeXml(
      `${sheet.title} — gabarit ${size.width} × ${size.run} mm, înălțime ${size.height} mm`,
    )}</text>`,
  );

  if (sheet.warnings.length) {
    parts.push(
      `<text x="${page.width - 24}" y="${page.height - 18}" text-anchor="end" font-family="system-ui, sans-serif" font-size="14" fill="#b45309">${escapeXml(sheet.warnings[0])}</text>`,
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}

export function downloadSheetSvg(sheet: Sheet, title: string) {
  const blob = new Blob([sheetToSvg(sheet)], { type: "image/svg+xml" });
  download(blob, fileName(title, "svg"));
}

/**
 * Planșa ca PDF, scrisă ca linii.
 *
 * Aceleași panouri, aceeași așezare, dar pe A4 în format lat: planșa se
 * printează și se pune pe bancul de lucru. Nu e o captură a ecranului — fiecare
 * linie e o linie în PDF, deci se poate mări fără să se îmbâcsească și se poate
 * măsura cu rigla pe hârtie.
 */
export async function downloadSheetPdf(sheet: Sheet, title: string) {
  const { jsPDF } = await import("jspdf");
  const { page, panes } = layoutSheet(sheet, false);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const factor = Math.min(
    (pageWidth - margin * 2) / page.width,
    (pageHeight - margin * 2) / page.height,
  );
  const toPage = (point: { x: number; y: number }) => ({
    x: margin + point.x * factor,
    y: margin + point.y * factor,
  });

  for (const placed of panes) {
    const frameStart = toPage({ x: placed.frame.x + 8, y: placed.frame.y + 8 });
    pdf.setDrawColor(200, 200, 205);
    pdf.setLineWidth(0.1);
    pdf.rect(
      frameStart.x,
      frameStart.y,
      (placed.frame.width - 16) * factor,
      (placed.frame.height - 16) * factor,
    );

    pdf.setTextColor(24, 24, 27);
    pdf.setFontSize(8);
    const titleAt = toPage({ x: placed.frame.x + 22, y: placed.frame.y + 34 });
    pdf.text(placed.pane.title, titleAt.x, titleAt.y);

    pdf.setDrawColor(0, 0, 0);
    for (const polygon of placed.pane.polygons) {
      if (polygon.points.length < 2) continue;
      pdf.setLineWidth(polygon.weight === "main" ? 0.25 : 0.1);
      const points = polygon.points.map((p) => toPage(place(placed, p)));
      for (let i = 0; i < points.length; i += 1) {
        const from = points[i];
        const to = points[(i + 1) % points.length];
        pdf.line(from.x, from.y, to.x, to.y);
      }
    }

    pdf.setDrawColor(82, 82, 91);
    pdf.setLineWidth(0.08);
    for (const line of placed.pane.lines) {
      const a = toPage(place(placed, line.a));
      const b = toPage(place(placed, line.b));
      pdf.line(a.x, a.y, b.x, b.y);
    }

    for (const text of placed.pane.texts) {
      const at = toPage(place(placed, text.at));
      pdf.setFontSize(text.role === "numar" ? 5 : 6);
      // jsPDF nu cunoaște „start” și „end”, le vrea pe cele de tipar.
      const align = text.anchor === "middle" ? "center" : text.anchor === "end" ? "right" : "left";
      pdf.text(text.value, at.x, at.y, { align, baseline: "middle" });
    }
  }

  const size = sheet.footprint;
  pdf.setFontSize(8);
  pdf.setTextColor(82, 82, 91);
  pdf.text(
    `${title || sheet.title} — gabarit ${size.width} × ${size.run} mm, înălțime ${size.height} mm`,
    margin,
    pageHeight - margin + 2,
  );
  if (sheet.warnings.length) {
    pdf.text(sheet.warnings[0], pageWidth - margin, pageHeight - margin + 2, { align: "right" });
  }

  pdf.save(fileName(title, "pdf"));
}

/** PNG al planșei, din același SVG. La dublu, ca liniile să nu iasă moi. */
export async function downloadSheetPng(sheet: Sheet, title: string, scale = 2) {
  const blob = new Blob([sheetToSvg(sheet)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Planșa nu a putut fi redată"));
      element.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Planșa nu a putut fi redată");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (png) download(png, fileName(title, "png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
