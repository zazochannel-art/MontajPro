import type { CalcLine, CalcSeed } from "./calc";
import type { JobType } from "./types";

/**
 * Puntea dintre calculator și restul aplicației.
 *
 * Calculul se ține în `sessionStorage` (nu în URL) ca să nu pierdem liniile la
 * refresh și să nu umplem adresa cu date. Citirea este separată de ștergere:
 * pagina care preia ciorna o citește la montare și o curăță într-un efect.
 */
/*
 * Cheile de stocare păstrează numele vechi, dinadins.
 *
 * Ele nu se văd nicăieri în aplicație, dar sunt adresa la care stau datele pe
 * telefoanele care au deja MontCraft instalat. Redenumite, aplicația s-ar uita
 * la un raft gol: în modul local asta înseamnă toate lucrările pierdute.
 * Numele mărcii s-a schimbat; adresa datelor, nu.
 */
export const CALC_DRAFT_KEY = "montajpro.calc-draft";

export interface CalcDraft {
  kind: JobType;
  lines: CalcLine[];
  total: number;
  /** Clientul pentru care s-a calculat, ca să nu fie ales din nou. */
  client_id?: string | null;
}

export function saveCalcDraft(draft: CalcDraft) {
  try {
    sessionStorage.setItem(CALC_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Stocarea poate fi blocată — calculul rămâne doar pe ecran.
  }
}

/** Citire fără efecte secundare. */
export function peekCalcDraft(): CalcDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CALC_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalcDraft;
    return parsed?.lines?.length ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCalcDraft() {
  try {
    sessionStorage.removeItem(CALC_DRAFT_KEY);
  } catch {
    // Nimic de făcut — ciorna expiră oricum odată cu sesiunea.
  }
}

/* ------------------------------------------------------------------ */
/* Cealaltă direcție: măsurătoare → calculator                         */
/* ------------------------------------------------------------------ */

/**
 * Ciorna de mai sus duce prețul din calculator mai departe; asta aduce
 * cantitățile înspre el. Același mecanism, ca să nu apară un al doilea.
 */
export const CALC_SEED_KEY = "montajpro.calc-seed";

export function saveCalcSeed(seed: CalcSeed) {
  try {
    sessionStorage.setItem(CALC_SEED_KEY, JSON.stringify(seed));
  } catch {
    // Stocarea poate fi blocată — calculatorul pornește pe presetări.
  }
}

export function peekCalcSeed(): CalcSeed | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CALC_SEED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CalcSeed;
  } catch {
    return null;
  }
}

export function clearCalcSeed() {
  try {
    sessionStorage.removeItem(CALC_SEED_KEY);
  } catch {
    // Expiră oricum odată cu sesiunea.
  }
}
