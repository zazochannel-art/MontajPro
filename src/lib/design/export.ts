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
