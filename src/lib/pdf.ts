/**
 * Documentul de pe ecran, salvat ca PDF.
 *
 * Alegerea care contează: PDF-ul e o poză a documentului, nu text reconstruit.
 * Un PDF cu text ar fi cerut o fontă încorporată — altfel diacriticele
 * românești („ă”, „ș”, „ț”) ies goale, ceea ce e mai rău decât o imagine.
 * Așa, hârtia arată exact ca pe ecran, pe orice telefon.
 *
 * Bibliotecile se încarcă abia la apăsare: nu au ce căuta în pachetul pe care
 * îl descarcă cineva ca să-și vadă lucrările de azi.
 */

/** Cât durează fotografierea, documentul poartă înfățișarea de hârtie. */
const CAPTURE_CLASS = "pdf-capture";

export async function elementToPdf(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  element.classList.add(CAPTURE_CLASS);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      // 2× ca textul să nu fie moale; mai mult umflă fișierul degeaba.
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
  } finally {
    element.classList.remove(CAPTURE_CLASS);
  }

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * usableWidth) / canvas.width;
  const image = canvas.toDataURL("image/jpeg", 0.92);

  if (imageHeight <= pageHeight - margin * 2) {
    pdf.addImage(image, "JPEG", margin, margin, usableWidth, imageHeight);
  } else {
    // Document mai lung decât o pagină: îl tăiem în felii de înălțimea paginii,
    // mutând aceeași imagine în sus la fiecare pagină nouă.
    const usableHeight = pageHeight - margin * 2;
    let offset = 0;
    while (offset < imageHeight) {
      if (offset > 0) pdf.addPage();
      pdf.addImage(
        image,
        "JPEG",
        margin,
        margin - offset,
        usableWidth,
        imageHeight,
      );
      offset += usableHeight;
    }
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** Nume de fișier fără diacritice și fără spații, ca să nu supere telefoanele. */
export function pdfFileName(parts: (string | number | null | undefined)[]) {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
