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
import { PALETTES, fillOf, layoutSheet, place, strokeOf } from "./sheet";
import type { Finish, Sheet, TextRole } from "./sheet";

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

/** `#rrggbb` în cele trei numere pe care le vrea jsPDF. */
function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Planșa ca SVG: pagina întreagă, cu toate vederile.
 *
 * Două cerneli, aceeași geometrie. Cea tehnică, negru pe alb, pleacă la
 * debitat — lângă un ferăstrău nu se citește altceva. Cea de lemn pleacă la
 * client, unde o scară trebuie să arate a scară. Firul lemnului e desenat cu
 * linii, nu cu o poză de fundal: așa rămâne vector și la mărire, și în PDF.
 */
export function sheetToSvg(sheet: Sheet, tall = false, finish: Finish = "tehnic"): string {
  const { page, panes } = layoutSheet(sheet, tall);
  const ink = PALETTES[finish];
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="${ink.paper}"/>`);

  for (const placed of panes) {
    const { frame } = placed;
    parts.push(
      `<rect x="${frame.x + 8}" y="${frame.y + 8}" width="${frame.width - 16}" height="${frame.height - 16}" fill="none" stroke="${ink.frame}" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${frame.x + 22}" y="${frame.y + 34}" font-family="system-ui, sans-serif" font-size="${TEXT_SIZE.titlu}" fill="${ink.text}">${escapeXml(placed.pane.title)}</text>`,
    );

    for (const polygon of placed.pane.polygons) {
      const points = polygon.points
        .map((p) => {
          const q = place(placed, p);
          return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(" ");
      parts.push(
        `<polygon points="${points}" fill="${fillOf(ink, polygon.kind, polygon.tone, polygon.variant)}" stroke="${ink.outline}" stroke-width="${strokeOf(ink, polygon.weight)}" stroke-linejoin="round"/>`,
      );

      // Firul se scrie imediat după fața lui, altfel îl acoperă următoarea față.
      if (ink.grain) {
        for (const line of polygon.grain) {
          const a = place(placed, line.a);
          const b = place(placed, line.b);
          parts.push(
            `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${ink.grain[polygon.tone]}" stroke-width="0.7"/>`,
          );
        }
      }
    }

    for (const line of placed.pane.lines) {
      const a = place(placed, line.a);
      const b = place(placed, line.b);
      parts.push(
        `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${ink.thin}" stroke-width="${strokeOf(ink, line.weight)}"/>`,
      );
    }

    for (const text of placed.pane.texts) {
      const at = place(placed, text.at);
      const anchor = text.anchor === "middle" ? "middle" : text.anchor;
      parts.push(
        `<text x="${at.x.toFixed(1)}" y="${at.y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="${TEXT_SIZE[text.role]}" fill="${ink.text}">${escapeXml(text.value)}</text>`,
      );
    }
  }

  const size = sheet.footprint;
  parts.push(
    `<text x="24" y="${page.height - 18}" font-family="system-ui, sans-serif" font-size="14" fill="${ink.thin}">${escapeXml(
      `${sheet.title} — gabarit ${size.width} × ${size.run} mm, înălțime ${size.height} mm`,
    )}</text>`,
  );

  if (sheet.warnings.length) {
    parts.push(
      `<text x="${page.width - 24}" y="${page.height - 18}" text-anchor="end" font-family="system-ui, sans-serif" font-size="14" fill="${ink.warn}">${escapeXml(sheet.warnings[0])}</text>`,
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}

export function downloadSheetSvg(sheet: Sheet, title: string, finish: Finish = "tehnic") {
  download(new Blob([sheetToSvg(sheet, false, finish)], { type: "image/svg+xml" }), fileName(title, "svg"));
}

/**
 * Planșa ca PDF, scrisă ca linii.
 *
 * Aceleași panouri, aceeași așezare, pe A4 lat: foaia se printează și se pune
 * pe bancul de lucru. Fețele se umplu ca poligoane, nu ca imagini — și cu
 * umplere, fiindcă altfel treapta din spate s-ar vedea prin cea din față.
 */
export async function downloadSheetPdf(sheet: Sheet, title: string, finish: Finish = "tehnic") {
  const { jsPDF } = await import("jspdf");
  const { page, panes } = layoutSheet(sheet, false);
  const ink = PALETTES[finish];

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

  // Foaia de lemn are fondul ei; cea tehnică rămâne hârtia albă a imprimantei.
  if (finish !== "tehnic") {
    const [r, g, b] = rgb(ink.paper);
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
  }

  for (const placed of panes) {
    const frameStart = toPage({ x: placed.frame.x + 8, y: placed.frame.y + 8 });
    const [fr, fg, fb] = rgb(ink.frame);
    pdf.setDrawColor(fr, fg, fb);
    pdf.setLineWidth(0.1);
    pdf.rect(
      frameStart.x,
      frameStart.y,
      (placed.frame.width - 16) * factor,
      (placed.frame.height - 16) * factor,
    );

    const [tr, tg, tb] = rgb(ink.text);
    pdf.setTextColor(tr, tg, tb);
    pdf.setFontSize(8);
    const titleAt = toPage({ x: placed.frame.x + 22, y: placed.frame.y + 34 });
    pdf.text(placed.pane.title, titleAt.x, titleAt.y);

    const [or_, og, ob] = rgb(ink.outline);
    for (const polygon of placed.pane.polygons) {
      if (polygon.points.length < 3) continue;
      const points = polygon.points.map((p) => toPage(place(placed, p)));

      const [pr, pg, pb] = rgb(fillOf(ink, polygon.kind, polygon.tone, polygon.variant));
      pdf.setFillColor(pr, pg, pb);
      pdf.setDrawColor(or_, og, ob);
      // Grosimile planșei, aduse la milimetrii hârtiei.
      pdf.setLineWidth(strokeOf(ink, polygon.weight) * 0.125);
      // `lines` primește pași de la un punct la altul, nu puncte absolute.
      const steps: [number, number][] = [];
      for (let i = 1; i < points.length; i += 1) {
        steps.push([points[i].x - points[i - 1].x, points[i].y - points[i - 1].y]);
      }
      pdf.lines(steps, points[0].x, points[0].y, [1, 1], "FD", true);

      if (ink.grain) {
        const [gr, gg, gb] = rgb(ink.grain[polygon.tone]);
        pdf.setDrawColor(gr, gg, gb);
        pdf.setLineWidth(0.08);
        for (const line of polygon.grain) {
          const a = toPage(place(placed, line.a));
          const b = toPage(place(placed, line.b));
          pdf.line(a.x, a.y, b.x, b.y);
        }
      }
    }

    const [dr, dg, db] = rgb(ink.thin);
    pdf.setDrawColor(dr, dg, db);
    pdf.setLineWidth(0.08);
    for (const line of placed.pane.lines) {
      const a = toPage(place(placed, line.a));
      const b = toPage(place(placed, line.b));
      pdf.line(a.x, a.y, b.x, b.y);
    }

    pdf.setTextColor(tr, tg, tb);
    for (const text of placed.pane.texts) {
      const at = toPage(place(placed, text.at));
      pdf.setFontSize(text.role === "numar" ? 5 : 6);
      // jsPDF nu cunoaște „start” și „end”, le vrea pe cele de tipar.
      const align = text.anchor === "middle" ? "center" : text.anchor === "end" ? "right" : "left";
      pdf.text(text.value, at.x, at.y, { align, baseline: "middle" });
    }
  }

  const size = sheet.footprint;
  const [nr, ng, nb] = rgb(ink.thin);
  pdf.setFontSize(8);
  pdf.setTextColor(nr, ng, nb);
  pdf.text(
    `${title || sheet.title} — gabarit ${size.width} × ${size.run} mm, înălțime ${size.height} mm`,
    margin,
    pageHeight - margin + 2,
  );
  if (sheet.warnings.length) {
    const [wr, wg, wb] = rgb(ink.warn);
    pdf.setTextColor(wr, wg, wb);
    pdf.text(sheet.warnings[0], pageWidth - margin, pageHeight - margin + 2, { align: "right" });
  }

  pdf.save(fileName(title, "pdf"));
}

/** PNG al planșei, din același SVG. La dublu, ca liniile să nu iasă moi. */
export async function downloadSheetPng(
  sheet: Sheet,
  title: string,
  finish: Finish = "tehnic",
  scale = 2,
) {
  const blob = new Blob([sheetToSvg(sheet, false, finish)], { type: "image/svg+xml" });
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
    context.fillStyle = PALETTES[finish].paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (png) download(png, fileName(title, "png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
