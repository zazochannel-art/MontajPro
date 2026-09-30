/**
 * De la fotografie la trepte.
 *
 * Aici se leagă pașii: imaginea se micșorează și se curăță, muchiile ies cu
 * Sobel, dreptele cu Hough, iar dreptele aproape paralele și așezate una peste
 * alta la distanțe asemănătoare sunt — foarte probabil — muchiile treptelor.
 *
 * Ce NU face pasul ăsta, și e important: nu completează ce nu se vede. Dacă
 * fotografia arată șapte trepte și restul e umbră, ies șapte. O scară „știe”
 * toată lumea cum arată, dar desenul ăsta ajunge la debitat, iar o treaptă
 * desenată din obișnuință e o bucată de lemn tăiată degeaba.
 *
 * Nici încrederea nu e un număr ales ca să arate bine: iese din trei lucruri
 * măsurate — cât de tari sunt muchiile, cât de regulat sunt așezate treptele
 * și câte s-au găsit. Se vede în `scoreOf`, la vedere, ca oricine să poată
 * spune că e prea optimistă.
 */
import { uid } from "../utils";
import { blur, downscale, edgeStrength, sobel, strongEdges, toGray } from "./image";
import { accumulate, dominantTheta, extent, mergeDuplicates, peaks } from "./hough";
import type { HoughLine } from "./hough";
import type { DesignDetection, DesignDoc, DesignPoint, DesignStep, StairKind } from "./model";

/** Peste atât nu se lucrează: destul pentru muchii, destul de puțin pentru un telefon. */
const WORK_SIZE = 640;

/** Cât de departe de unghiul dominant mai e socotită o dreaptă „la fel”. */
const ANGLE_SPREAD = (7 * Math.PI) / 180;

/**
 * Cât de strâmbă poate fi muchia unei trepte față de orizontală.
 *
 * O treaptă se vede lată și culcată, oricât de pieziș ai ține telefonul. Ce e
 * vertical în poză e altceva: balustru, toc de ușă, colț de perete — sau, dacă
 * fotografiezi un desen tehnic, liniile de cotă. Fără hotarul ăsta, detecția
 * lua direcția cu cele mai multe voturi și se agăța tocmai de ele, scoțând
 * fâșii de sus până jos numerotate ca trepte.
 *
 * 40° e larg cu bună știință: mai bine las să treacă o poză strâmbă decât să
 * tai o scară fotografiată dintr-un unghi neobișnuit.
 */
const TREAD_TILT = (40 * Math.PI) / 180;

/** Sub atâtea muchii găsite, fotografia nu spune nimic despre o scară. */
const MIN_LINES = 3;

/** O muchie mai scurtă de atât din lățimea imaginii e altceva, nu o treaptă. */
const MIN_LENGTH_RATIO = 0.18;

export interface DetectionResult {
  doc: DesignDoc;
  detection: DesignDetection;
  /**
   * Mărimea fotografiei date, fiindcă desenul vine în coordonatele ei.
   *
   * Socoteala se face pe o copie micșorată, ca să meargă pe un telefon, dar
   * asta rămâne treaba detecției: ce iese de aici se așază peste fotografia
   * întreagă, așa că vine gata potrivit. Altfel fiecare apelant ar trebui să-și
   * amintească să înmulțească, iar cine uită vede treptele înghesuite într-un
   * colț — fără nicio eroare, doar un desen care nu stă peste scară.
   */
  width: number;
  height: number;
}

/**
 * Cât de regulat sunt așezate muchiile.
 *
 * O scară are treptele la distanțe aproape egale. Dacă distanțele sar aiurea,
 * fie n-am găsit treptele, fie am prins printre ele un pervaz și o umbră. Se
 * măsoară cu coeficientul de variație — abaterea împărțită la medie — fiindcă
 * trebuie să meargă la fel și pentru o scară mare, și pentru una mică.
 */
export function spacingScore(positions: number[]): number {
  if (positions.length < 3) return 0;
  const sorted = [...positions].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1]);

  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (mean <= 0) return 0;
  const variance =
    gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
  const cv = Math.sqrt(variance) / mean;

  // Perfect regulat = 1; peste o abatere cât media, nu mai înseamnă nimic.
  return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Încrederea, din cele trei cifre măsurate.
 *
 * Se înmulțesc, nu se adună: o scară cu muchii superbe dar așezate haotic nu
 * merită „bine pe jumătate”, merită puțin. Iar plafonul e 0,95 fiindcă dintr-o
 * singură fotografie, fără calibrare, certitudinea nu există.
 */
export function scoreOf(input: {
  strength: number;
  spacing: number;
  lines: number;
}): number {
  const count = Math.max(0, Math.min(1, (input.lines - MIN_LINES + 1) / 8));
  const raw = Math.cbrt(
    Math.max(0, input.strength) * Math.max(0, input.spacing) * Math.max(0, count),
  );
  return Math.round(Math.min(0.95, raw) * 100) / 100;
}

/**
 * Ce fel de scară pare.
 *
 * Doar ce se poate citi dintr-o poză: muchii la fel de lungi și paralele =
 * dreaptă; muchii care se lungesc sau se scurtează treptat și se răsfiră =
 * evantai; restul, neregulată. „Cotită” nu se hotărăște de aici — dintr-o
 * singură fotografie nu se vede cotul, iar omul o poate alege singur.
 */
export function classify(lines: HoughLine[]): StairKind {
  if (lines.length < 3) return "neregulata";

  const lengths = lines.map((line) => line.length);
  const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
  if (mean <= 0) return "neregulata";

  const spread =
    Math.sqrt(
      lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length,
    ) / mean;

  const angles = lines.map((line) => line.theta);
  const angleSpread = Math.max(...angles) - Math.min(...angles);

  if (spread < 0.12 && angleSpread < (3 * Math.PI) / 180) return "dreapta";

  // Lungimile care cresc sau scad tot timpul în aceeași direcție, plus muchii
  // care nu mai sunt paralele: asta se vede la treptele în evantai.
  let monotone = true;
  for (let i = 2; i < lengths.length; i += 1) {
    const first = lengths[1] - lengths[0];
    const current = lengths[i] - lengths[i - 1];
    if (first * current < 0) {
      monotone = false;
      break;
    }
  }
  if (monotone && (spread > 0.15 || angleSpread > (4 * Math.PI) / 180)) {
    return "evantai";
  }

  return "neregulata";
}

/** Unghiul de urcare al scării, în grade față de orizontală. */
function riseAngle(lines: HoughLine[]): number {
  if (lines.length < 2) return 0;
  const sorted = [...lines].sort((a, b) => a.rho - b.rho);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Linia care leagă mijloacele muchiilor de jos și de sus arată panta.
  const x1 = (first.x1 + first.x2) / 2;
  const y1 = (first.y1 + first.y2) / 2;
  const x2 = (last.x1 + last.x2) / 2;
  const y2 = (last.y1 + last.y2) / 2;
  const degrees = (Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) * 180) / Math.PI;
  return Math.round(degrees * 10) / 10;
}

/**
 * Treptele, din muchiile găsite.
 *
 * Fiecare pereche de muchii vecine închide o treaptă: muchia din față și cea
 * din spate. Colțurile din stânga și dreapta se iau din capetele bucăților
 * care chiar au muchii sub ele, deci o treaptă mai îngustă iese mai îngustă și
 * pe desen.
 */
function buildSteps(lines: HoughLine[]): {
  points: Record<string, DesignPoint>;
  steps: DesignStep[];
} {
  const points: Record<string, DesignPoint> = {};
  const steps: DesignStep[] = [];

  const put = (x: number, y: number): string => {
    const id = uid();
    points[id] = { id, x, y };
    return id;
  };

  // De jos în sus: în fotografie, treapta de jos are y mai mare.
  const ordered = [...lines].sort(
    (a, b) => (b.y1 + b.y2) / 2 - (a.y1 + a.y2) / 2,
  );

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const front = ordered[i];
    const back = ordered[i + 1];

    // Capetele se pun în aceeași ordine (stânga, dreapta) pe ambele muchii,
    // altfel conturul iese în formă de fluture.
    const frontLeft = front.x1 <= front.x2 ? { x: front.x1, y: front.y1 } : { x: front.x2, y: front.y2 };
    const frontRight = front.x1 <= front.x2 ? { x: front.x2, y: front.y2 } : { x: front.x1, y: front.y1 };
    const backLeft = back.x1 <= back.x2 ? { x: back.x1, y: back.y1 } : { x: back.x2, y: back.y2 };
    const backRight = back.x1 <= back.x2 ? { x: back.x2, y: back.y2 } : { x: back.x1, y: back.y1 };

    steps.push({
      id: uid(),
      points: [
        put(frontLeft.x, frontLeft.y),
        put(frontRight.x, frontRight.y),
        put(backRight.x, backRight.y),
        put(backLeft.x, backLeft.y),
      ],
      index: i + 1,
    });
  }

  return { points, steps };
}

export const NOT_ENOUGH =
  "Imaginea nu oferă suficiente informații pentru o detecție precisă. Verifică și ajustează manual desenul.";

/**
 * Tot drumul, de la octeții fotografiei la desen.
 *
 * Întoarce mereu un rezultat, chiar și când n-a găsit nimic: un desen gol, o
 * încredere mică și motivul scris pe față. Tăcerea ar fi mai rea — omul ar
 * crede că aplicația s-a stricat, când de fapt poza e prea întunecată.
 */
export function detectStairs(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): DetectionResult {
  const gray = downscale(toGray(rgba, width, height), WORK_SIZE);
  const smooth = blur(gray);
  const edges = sobel(smooth);
  const mask = strongEdges(edges);
  const strength = edgeStrength(edges, mask);

  const accumulator = accumulate(mask, gray.width, gray.height);
  // Normala unei drepte orizontale e verticală, deci muchiile culcate stau în
  // jurul lui π/2; cu cât treapta e mai strâmbă în poză, cu atât se depărtează.
  const theta = dominantTheta(accumulator, {
    around: Math.PI / 2,
    spread: TREAD_TILT,
  });

  // Pragul de voturi ține de mărimea imaginii: o muchie care traversează un
  // sfert din lățime e o muchie, oricât de mare ar fi poza.
  const minVotes = Math.max(20, Math.round(gray.width * 0.15));
  const raw = peaks(accumulator, theta, ANGLE_SPREAD, { minVotes });

  const minLength = gray.width * MIN_LENGTH_RATIO;
  const found = raw
    .map((line) => extent(line, mask, gray.width, gray.height))
    .filter((line): line is HoughLine => line !== null && line.length >= minLength);

  /*
   * Două trepte nu pot fi lipite: sub distanța asta, ce pare a doua muchie e
   * aceeași muchie văzută la alt unghi. Se ia din mărimea imaginii, nu dintr-o
   * constantă în pixeli, ca să meargă la fel pe o poză de aproape și pe una de
   * la capătul holului.
   */
  const minGap = Math.max(6, Math.min(gray.width, gray.height) * 0.025);
  const lines = mergeDuplicates(found, theta, minGap);

  const empty: DesignDoc = {
    points: {},
    steps: [],
    dimensions: [],
    scale: null,
    detection: null,
  };

  if (lines.length < MIN_LINES) {
    const detection: DesignDetection = {
      steps: 0,
      kind: "neregulata",
      angle: 0,
      confidence: scoreOf({ strength, spacing: 0, lines: lines.length }),
      warning: NOT_ENOUGH,
    };
    return { doc: { ...empty, detection }, detection, width, height };
  }

  /*
   * Distanța dintre două drepte paralele se măsoară pe perpendiculara lor, nu
   * pe verticală — iar `rho` e tocmai asta. Măsurată pe mijlocul vertical al
   * muchiei, aceeași scară, identic de regulată, ieșea tot mai neregulată cu
   * cât poza era mai strâmbă: la 30° de înclinare, 0,55 în loc de 0,93. Așa
   * încrederea pedepsea fotograful, nu scara.
   */
  const spacing = spacingScore(lines.map((line) => line.rho));
  const built = buildSteps(lines);

  // Înapoi în coordonatele fotografiei date.
  const kx = width / gray.width;
  const ky = height / gray.height;
  for (const point of Object.values(built.points)) {
    point.x *= kx;
    point.y *= ky;
  }
  const confidence = scoreOf({ strength, spacing, lines: lines.length });

  const detection: DesignDetection = {
    steps: built.steps.length,
    kind: classify(lines),
    angle: riseAngle(lines),
    confidence,
    // Sub jumătate, cifrele sunt mai mult o părere: se spune pe față.
    warning: confidence < 0.5 ? NOT_ENOUGH : null,
  };

  return {
    doc: { ...empty, points: built.points, steps: built.steps, detection },
    detection,
    width,
    height,
  };
}
