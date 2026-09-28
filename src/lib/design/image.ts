/**
 * Fotografia, adusă la ce se poate socoti: lumină, apoi muchii.
 *
 * Nimic de aici nu atinge un `<canvas>`. Intrarea e un tablou de octeți RGBA,
 * ieșirea sunt tablouri de numere — ca pasul ăsta să poată fi verificat cu
 * teste pe imagini făcute de mână, nu doar privind ecranul și dând din cap.
 *
 * Ordinea e cea clasică și are un motiv la fiecare pas: gri (culoarea lemnului
 * n-are ce spune despre unde e muchia), înmuiere (altfel zgârieturile și
 * granulația ies ca muchii), Sobel (panta luminii; unde se schimbă brusc, e
 * margine).
 */

export interface Gray {
  width: number;
  height: number;
  /** Luminanța, 0–255, pe rânduri. */
  data: Float32Array;
}

export interface Edges {
  width: number;
  height: number;
  /** Cât de tare e muchia în fiecare punct. */
  magnitude: Float32Array;
  /** Încotro crește lumina, în radiani. */
  direction: Float32Array;
}

/**
 * RGBA → luminanță.
 *
 * Coeficienții sunt cei ai ochiului (Rec. 601): verdele cântărește cel mai
 * mult fiindcă acolo vedem cel mai bine. O medie simplă ar face o treaptă de
 * stejar și una de beton să pară la fel de luminoase, deși nu sunt.
 */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 1, p += 4) {
    data[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
  return { width, height, data };
}

/**
 * Micșorează imaginea, mediind pixelii care se strâng într-unul.
 *
 * Nu de dragul vitezei, ci al rezultatului: la mărimea întreagă, fiecare fibră
 * de lemn e o muchie, iar scara se pierde în ele. Plus că o poză de telefon are
 * douăsprezece milioane de puncte, iar transformata Hough de mai jos le-ar
 * număra pe toate.
 */
export function downscale(gray: Gray, maxSide: number): Gray {
  const largest = Math.max(gray.width, gray.height);
  if (largest <= maxSide) return gray;

  const factor = largest / maxSide;
  const width = Math.max(1, Math.round(gray.width / factor));
  const height = Math.max(1, Math.round(gray.height / factor));
  const data = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor((y * gray.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * gray.height) / height));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor((x * gray.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * gray.width) / width));

      let sum = 0;
      let count = 0;
      for (let sy = y0; sy < y1 && sy < gray.height; sy += 1) {
        for (let sx = x0; sx < x1 && sx < gray.width; sx += 1) {
          sum += gray.data[sy * gray.width + sx];
          count += 1;
        }
      }
      data[y * width + x] = count ? sum / count : 0;
    }
  }

  return { width, height, data };
}

/** Nucleu gaussian 5×5, separabil — de aceea se aplică de două ori, pe rânduri. */
const KERNEL = [1, 4, 6, 4, 1];
const KERNEL_SUM = 16;

/** Înmoaie imaginea, ca praful și granulația să nu treacă drept muchii. */
export function blur(gray: Gray): Gray {
  const { width, height } = gray;
  const pass = new Float32Array(width * height);
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -2; k <= 2; k += 1) {
        // La margine se repetă pixelul de capăt: altfel apare o muchie falsă
        // chiar pe conturul fotografiei.
        const sx = Math.min(width - 1, Math.max(0, x + k));
        sum += gray.data[y * width + sx] * KERNEL[k + 2];
      }
      pass[y * width + x] = sum / KERNEL_SUM;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -2; k <= 2; k += 1) {
        const sy = Math.min(height - 1, Math.max(0, y + k));
        sum += pass[sy * width + x] * KERNEL[k + 2];
      }
      out[y * width + x] = sum / KERNEL_SUM;
    }
  }

  return { width, height, data: out };
}

/** Panta luminii, pe orizontală și pe verticală: operatorul Sobel. */
export function sobel(gray: Gray): Edges {
  const { width, height } = gray;
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);

  const at = (x: number, y: number) =>
    gray.data[
      Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))
    ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx =
        -at(x - 1, y - 1) + at(x + 1, y - 1) +
        -2 * at(x - 1, y) + 2 * at(x + 1, y) +
        -at(x - 1, y + 1) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);

      const index = y * width + x;
      magnitude[index] = Math.hypot(gx, gy);
      direction[index] = Math.atan2(gy, gx);
    }
  }

  return { width, height, magnitude, direction };
}

/**
 * Păstrează cele mai tari muchii, cât la sută s-a cerut.
 *
 * Pragul se alege din imagine, nu dintr-o constantă: o poză făcută în casă
 * scării, pe întuneric, are muchii de zece ori mai slabe decât una făcută
 * afară, iar un prag fix ar găsi totul într-una și nimic în cealaltă.
 */
export function strongEdges(edges: Edges, keepRatio = 0.08, floorRatio = 0.15): Uint8Array {
  const total = edges.magnitude.length;
  const keep = Math.max(1, Math.round(total * keepRatio));

  // Histogramă pe 512 trepte: destul de fin pentru un prag, și fără să
  // sortăm un milion de numere.
  let max = 0;
  for (let i = 0; i < total; i += 1) if (edges.magnitude[i] > max) max = edges.magnitude[i];
  if (max <= 0) return new Uint8Array(total);

  const bins = new Int32Array(512);
  for (let i = 0; i < total; i += 1) {
    const bin = Math.min(511, Math.floor((edges.magnitude[i] / max) * 511));
    bins[bin] += 1;
  }

  let seen = 0;
  let cutBin = 511;
  for (let bin = 511; bin >= 0; bin -= 1) {
    seen += bins[bin];
    if (seen >= keep) {
      cutBin = bin;
      break;
    }
  }

  /*
   * Podeaua de sub prag.
   *
   * „Cele mai tari 8%” sună bine până dai peste o imagine care are muchii pe
   * 1% din suprafață: procentul coboară atunci până în zona plată și ia drept
   * muchie și peretele gol. Aici sunt ambele condiții — și în primele procente,
   * și măcar o parte din cea mai tare muchie — ca zona netedă să rămână afară
   * oricât de puțin ar fi de desenat în poză.
   */
  const cut = Math.max((cutBin / 511) * max, floorRatio * max);

  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) mask[i] = edges.magnitude[i] >= cut ? 1 : 0;
  return mask;
}

/** Puterea medie a muchiilor păstrate, raportată la cea mai tare din imagine. */
export function edgeStrength(edges: Edges, mask: Uint8Array): number {
  let sum = 0;
  let count = 0;
  let max = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (edges.magnitude[i] > max) max = edges.magnitude[i];
    if (!mask[i]) continue;
    sum += edges.magnitude[i];
    count += 1;
  }
  if (!count || max <= 0) return 0;
  return Math.min(1, sum / count / max);
}
