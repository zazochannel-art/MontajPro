/**
 * Treapta incomodă, prinsă înainte de tăiat lemnul.
 *
 * Calculatorul știa să dea unghiul, dar unghiul nu-ți spune dacă scara se urcă
 * bine. Regula pe care o știe orice tâmplar leagă înălțimea treptei de
 * adâncimea ei: cât urci, atât nu mai ai loc să calci. Scrisă în cifre,
 *
 *     2 × înălțime + adâncime ≈ 63 cm
 *
 * fiindcă pasul unui om pe orizontală e de vreo 63 de centimetri, iar pe
 * verticală fiecare centimetru de urcat „costă” doi de mers.
 *
 * Nu e o lege, e o măsură a corpului: limitele de mai jos sunt cele obișnuite
 * la interior, iar omul le poate muta din Setări, fiindcă o scară de beci și
 * una de living nu se fac la fel.
 */
import { num } from "./utils";
import type { StairLimits } from "./types";

/** Ce se cere la o scară de interior, când nimeni n-a schimbat nimic. */
export const DEFAULT_STAIR_LIMITS: StairLimits = {
  /** Înălțimea unei trepte, în cm. */
  riser_min: 15,
  riser_max: 19,
  /** Adâncimea (călcătura), în cm. */
  tread_min: 25,
  /** Suma pasului: 2 × înălțime + adâncime. */
  sum_min: 60,
  sum_max: 66,
};

/** Înălțimea spre care tragem când propunem alt număr de trepte. */
const IDEAL_RISER = 17;

export type ComfortLevel = "ok" | "warn" | "bad";

export interface StairComfort {
  level: ComfortLevel;
  /** 2 × înălțime + adâncime, în cm. Null dacă lipsesc măsurile. */
  stepSum: number | null;
  /** Ce nu e în regulă, în cuvinte, pe înțelesul omului. */
  problems: string[];
  /**
   * „Cu 15 trepte în loc de 14, înălțimea scade la 17,3 cm.”
   *
   * Apare doar când schimbarea chiar ajută: aceeași înălțime totală, împărțită
   * altfel. Null când numărul de trepte e deja cel bun sau nu-l putem calcula.
   */
  suggestion: {
    steps: number;
    riser: number;
    text: string;
  } | null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Verdictul asupra unei scări.
 *
 * `riser` este înălțimea unei trepte și `tread` adâncimea ei, amândouă în cm —
 * exact cum se măsoară pe șantier. `steps` e opțional: fără el se poate spune
 * dacă treapta e comodă, dar nu și cum s-ar repara.
 */
export function stairComfort(
  input: { riser?: number | null; tread?: number | null; steps?: number | null },
  limits: StairLimits = DEFAULT_STAIR_LIMITS,
): StairComfort {
  const riser = num(input.riser);
  const tread = num(input.tread);
  const steps = num(input.steps);

  if (!riser || !tread) {
    return { level: "ok", stepSum: null, problems: [], suggestion: null };
  }

  const stepSum = round1(2 * riser + tread);
  const problems: string[] = [];
  let level: ComfortLevel = "ok";

  const worsen = (next: ComfortLevel) => {
    if (next === "bad" || level === "bad") level = "bad";
    else level = next;
  };

  if (riser > limits.riser_max) {
    problems.push(
      `Treptele sunt prea înalte: ${round1(riser)} cm, față de ${limits.riser_max} cm cât se urcă încă bine.`,
    );
    worsen("bad");
  } else if (riser < limits.riser_min) {
    problems.push(
      `Treptele sunt prea joase: ${round1(riser)} cm. Sub ${limits.riser_min} cm piciorul se împiedică, fiindcă pasul e mai lung decât treapta.`,
    );
    worsen("warn");
  }

  if (tread < limits.tread_min) {
    problems.push(
      `Călcătura e prea scurtă: ${round1(tread)} cm, iar talpa cere cel puțin ${limits.tread_min} cm ca să stea întreagă pe treaptă.`,
    );
    worsen("bad");
  }

  if (stepSum < limits.sum_min || stepSum > limits.sum_max) {
    problems.push(
      stepSum > limits.sum_max
        ? `Pasul iese prea lung (2 × ${round1(riser)} + ${round1(tread)} = ${stepSum} cm). Scara se urcă obositor, cu pași mari.`
        : `Pasul iese prea scurt (2 × ${round1(riser)} + ${round1(tread)} = ${stepSum} cm). Se merge mărunt, ca pe o scăriță.`,
    );
    worsen("warn");
  }

  // Cum s-ar repara: aceeași înălțime totală, împărțită la alt număr de trepte.
  let suggestion: StairComfort["suggestion"] = null;
  if (steps > 0 && (riser > limits.riser_max || riser < limits.riser_min)) {
    const totalRise = steps * riser;
    const wanted = Math.max(1, Math.round(totalRise / IDEAL_RISER));
    const nextRiser = round1(totalRise / wanted);
    const fits = nextRiser >= limits.riser_min && nextRiser <= limits.riser_max;
    if (wanted !== steps && fits) {
      suggestion = {
        steps: wanted,
        riser: nextRiser,
        text: `Cu ${wanted} trepte în loc de ${steps}, înălțimea scade la ${nextRiser} cm.`,
      };
    }
  }

  return { level, stepSum, problems, suggestion };
}

/** Un rând scurt pentru interfață, când nu e loc de explicații. */
export function comfortSummary(comfort: StairComfort): string {
  if (comfort.stepSum === null) return "";
  if (comfort.level === "ok") return "Treptele se urcă bine.";
  return comfort.problems[0] ?? "Verifică măsurile treptei.";
}
