/**
 * Ce scule iei azi.
 *
 * Drumul înapoi după ferăstrăul uitat acasă costă o oră și nervii pe toată
 * ziua. Fiecare sculă poate fi legată de tipurile de lucrare la care e
 * nevoie de ea, iar dimineața lista se face singură din ce ai programat.
 *
 * Scula nelegată de niciun tip nu apare: dacă le-am lista pe toate, lista ar
 * fi inventarul, adică exact hârtia pe care n-o citește nimeni.
 */
import type { Job, JobType, Tool } from "./types";

export interface PackList {
  /** Sculele de luat, în ordinea în care se citesc ușor. */
  tools: Tool[];
  /** Tipurile de lucrare de azi, pentru care s-a făcut lista. */
  types: JobType[];
  /** Scule în evidență, dar fără niciun tip pus. */
  untagged: number;
}

/** Tipurile de lucrare dintr-o zi, fără duplicate. */
export function jobTypesOf(jobs: Job[]): JobType[] {
  const seen = new Set<JobType>();
  for (const job of jobs) {
    if (job.deleted_at) continue;
    seen.add(job.type);
  }
  return [...seen];
}

/**
 * Lista de încărcat în mașină pentru lucrările date.
 *
 * O sculă intră o singură dată, chiar dacă e bună la două dintre lucrările
 * zilei.
 */
export function packList(tools: Tool[], jobs: Job[]): PackList {
  const types = jobTypesOf(jobs);
  const live = tools.filter((tool) => !tool.deleted_at);
  const wanted = new Set(types);

  const picked = live.filter((tool) =>
    (tool.job_types ?? []).some((type) => wanted.has(type)),
  );

  return {
    tools: picked.sort((a, b) => a.name.localeCompare(b.name, "ro")),
    types,
    untagged: live.filter((tool) => (tool.job_types ?? []).length === 0).length,
  };
}
