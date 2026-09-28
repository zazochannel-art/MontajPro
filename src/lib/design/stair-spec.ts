/**
 * Scara ca opt cifre.
 *
 * Fotografia are un singur punct de vedere. Ca să desenezi scara din toate
 * părțile îți trebuie tocmai ce poza nu conține: cât e de lată, cât intră în
 * perete, în ce parte se cotește. Cifrele de aici le spun, iar din ele iese
 * scara întreagă — exact, repetabil și la fel de fiecare dată.
 *
 * Împărțirea muncii e asta: poza numără treptele și măsoară unghiul de urcare,
 * fiindcă alea chiar se văd în ea; cifrele răspund de ce se taie în lemn.
 * `fromDetection` e puntea — umple formularul cu ce a citit poza, ca omul să
 * corecteze, nu să scrie de la zero.
 *
 * Tot ce e aici e în milimetri. Fără unități fără nume, fără proporții: din
 * clipa în care se lucrează pe cifre, cifrele sunt reale.
 */
import { num } from "../utils";
import type { DesignDetection, StairKind } from "./model";

/** În ce parte se cotește scara. */
export const TURNS = ["fara", "dreapta", "stanga"] as const;
export type Turn = (typeof TURNS)[number];

export const TURN_LABELS: Record<Turn, string> = {
  fara: "Dreaptă, fără cot",
  dreapta: "Se cotește la dreapta",
  stanga: "Se cotește la stânga",
};

export interface StairSpec {
  /** Înălțimea totală, de la podea la podea. */
  totalRise: number;
  /** Câte trepte urci. Tot atâtea contratrepte. */
  steps: number;
  /** Adâncimea treptei — cât calci, fără nas. */
  tread: number;
  /** Lățimea scării. */
  width: number;
  /** Grosimea blatului de treaptă. */
  thickness: number;
  /** Cât iese nasul treptei peste contratreapta de sub el. */
  nosing: number;
  /** Grosimea contratreptei. */
  riserThickness: number;
  /** Cu contratreaptă sau cu golul lăsat liber. */
  closedRisers: boolean;
  turn: Turn;
  /** După a câta treaptă începe cotul. Numărat de jos, prima treaptă e 1. */
  turnAfter: number;
  /** Câte trepte fac cotul, în evantai. */
  winders: number;
  /** Cât se întoarce scara, în grade: 90 pentru un cot, 180 pentru întors. */
  turnAngle: number;
  /** Raza stâlpului din colț — de la el pornesc treptele în evantai. */
  newel: number;
}

/**
 * De unde pornește formularul.
 *
 * Nu sunt cifre rotunde de dragul rotunjimii: 175 mm treaptă și 280 mm adâncime
 * cad fix în mijlocul intervalului comod, iar 2×175+280 = 630 e chiar formula
 * pasului. Cine nu schimbă nimic pleacă de la o scară care se urcă bine.
 */
export function defaultSpec(): StairSpec {
  return {
    totalRise: 2800,
    steps: 16,
    tread: 280,
    width: 900,
    thickness: 40,
    nosing: 30,
    riserThickness: 20,
    closedRisers: true,
    turn: "fara",
    turnAfter: 8,
    winders: 3,
    turnAngle: 90,
    newel: 60,
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Cifrele aduse în limitele în care geometria are sens.
 *
 * Nu e cosmetică: o scară cu zero trepte sau cu nasul mai lung decât treapta
 * rupe socoteala mai departe, iar un formular din care se poate șterge o cifră
 * trimite oricând un `NaN` în desen. Se taie aici, o dată, nu la fiecare
 * folosire.
 */
export function normalizeSpec(spec: StairSpec): StairSpec {
  const steps = Math.round(clamp(num(spec.steps), 2, 60));
  const tread = clamp(num(spec.tread), 120, 500);
  const turn: Turn = TURNS.includes(spec.turn) ? spec.turn : "fara";
  // Cotul are nevoie de o treaptă înainte și de una după, altfel nu mai e cot.
  const turnAfter = Math.round(clamp(num(spec.turnAfter), 1, Math.max(1, steps - 2)));
  const winders =
    turn === "fara"
      ? 0
      : Math.round(clamp(num(spec.winders), 1, Math.max(1, steps - turnAfter - 1)));

  return {
    totalRise: clamp(num(spec.totalRise), 300, 8000),
    steps,
    tread,
    width: clamp(num(spec.width), 400, 2500),
    thickness: clamp(num(spec.thickness), 15, 120),
    // Nasul nu poate depăși treapta: ar ieși o treaptă care stă pe nimic.
    nosing: clamp(num(spec.nosing), 0, tread / 2),
    riserThickness: clamp(num(spec.riserThickness), 8, 60),
    closedRisers: spec.closedRisers !== false,
    turn,
    turnAfter,
    winders,
    turnAngle: clamp(num(spec.turnAngle), 15, 180),
    newel: clamp(num(spec.newel), 0, 400),
  };
}

export interface StairDerived {
  /** Înălțimea unei trepte. */
  rise: number;
  /** Unghiul de urcare față de orizontală, în grade. */
  angle: number;
  /** 2×înălțime + adâncime. Comod între 600 și 650. */
  stepFormula: number;
  /** Ce e în neregulă cu proporțiile, scris pe șleau. Gol = nimic. */
  warnings: string[];
}

/** Intervalele în care o scară de casă se urcă fără să obosească. */
export const COMFORT = {
  rise: { min: 150, max: 195 },
  tread: { min: 240, max: 340 },
  formula: { min: 590, max: 660 },
} as const;

/**
 * Ce iese din cifre, plus ce e de spus despre ele.
 *
 * Avertismentele nu opresc nimic. Într-o mansardă sau pe o gaură de scară
 * moștenită, o scară abruptă e singura scară care încape, iar montatorul știe
 * asta mai bine decât aplicația. Treaba aplicației e să spună cifra, nu să
 * refuze lucrarea.
 */
export function derive(spec: StairSpec): StairDerived {
  const safe = normalizeSpec(spec);
  const rise = safe.totalRise / safe.steps;
  const angle = (Math.atan2(rise, safe.tread) * 180) / Math.PI;
  const stepFormula = 2 * rise + safe.tread;

  const warnings: string[] = [];
  if (rise > COMFORT.rise.max) {
    warnings.push(`Treapta urcă ${Math.round(rise)} mm — peste ${COMFORT.rise.max} mm se urcă greu.`);
  } else if (rise < COMFORT.rise.min) {
    warnings.push(`Treapta urcă doar ${Math.round(rise)} mm — sub ${COMFORT.rise.min} mm se împiedică piciorul.`);
  }
  if (safe.tread < COMFORT.tread.min) {
    warnings.push(`Adâncimea de ${Math.round(safe.tread)} mm nu ține talpa întreagă.`);
  }
  if (stepFormula < COMFORT.formula.min || stepFormula > COMFORT.formula.max) {
    warnings.push(
      `Formula pasului dă ${Math.round(stepFormula)} mm; comod e între ${COMFORT.formula.min} și ${COMFORT.formula.max}.`,
    );
  }

  return {
    rise: Math.round(rise * 10) / 10,
    angle: Math.round(angle * 10) / 10,
    stepFormula: Math.round(stepFormula),
    warnings,
  };
}

/** Ce fel de scară descriu cifrele. Pentru titlul desenului. */
export function kindOf(spec: StairSpec): StairKind {
  const safe = normalizeSpec(spec);
  if (safe.turn === "fara") return "dreapta";
  return safe.winders > 0 ? "evantai" : "cotita";
}

/**
 * Formularul, completat din ce a citit fotografia.
 *
 * Se ia numai ce poza chiar arată: câte trepte sunt și sub ce unghi urcă. Din
 * unghi și dintr-o înălțime de treaptă obișnuită iese adâncimea, iar din trepte
 * ori înălțime iese totalul. Lățimea, cotul și grosimile rămân cele implicite,
 * fiindcă dintr-o singură poză nu se văd — și e mai cinstit ca omul să le
 * schimbe decât să le găsească ghicite și să le creadă măsurate.
 */
export function fromDetection(
  detection: DesignDetection | null,
  base: StairSpec = defaultSpec(),
): StairSpec {
  if (!detection || detection.steps < 2) return normalizeSpec(base);

  const steps = detection.steps;
  // O înălțime de treaptă obișnuită, ca ancoră; unghiul dă apoi adâncimea.
  const rise = 175;
  const radians = (Math.max(10, Math.min(75, detection.angle)) * Math.PI) / 180;
  const tread = rise / Math.tan(radians);

  const spec: StairSpec = {
    ...base,
    steps,
    totalRise: Math.round(steps * rise),
    tread: Math.round(tread),
    turn: detection.kind === "evantai" || detection.kind === "cotita" ? "dreapta" : "fara",
    turnAfter: Math.max(1, Math.round(steps / 2)),
  };
  return normalizeSpec(spec);
}
