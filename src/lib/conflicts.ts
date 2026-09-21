/**
 * Ciocnirile de sincronizare.
 *
 * Regula de până acum: rândul cu modificări netrimise câștigă. E alegerea
 * bună — ce ai scris pe telefonul din mână nu se șterge de la distanță — dar
 * are un preț nespus: modificarea venită de pe celălalt dispozitiv dispare
 * fără ca cineva să afle.
 *
 * Aici nu schimbăm cine câștigă. Schimbăm doar tăcerea: versiunea care ar fi
 * fost aruncată se păstrează pe telefon, iar omul poate alege s-o ia.
 *
 * Lista e locală, ca și ciocnirea: pe celălalt telefon n-a fost niciun
 * conflict, acolo totul s-a scris normal.
 */
import { metaGet, metaSet } from "./db/idb";
import { store } from "./db/store";
import type { BaseRow, TableName, Tables } from "./types";

const KEY = "sync:conflicts";

/**
 * Scrierile în jurnal se pun la coadă.
 *
 * O sincronizare aduce mai multe ciocniri deodată, iar fiecare citește lista,
 * o schimbă și o scrie înapoi. Fără coadă, două care se suprapun ar citi
 * aceeași listă veche și una din ele s-ar pierde — exact felul de pierdere pe
 * care jurnalul ăsta există ca s-o împiedice.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

/** Așteaptă ca tot ce s-a pus la coadă să fie scris. */
export function conflictsSettled(): Promise<void> {
  return queue.then(() => undefined);
}
/** Câte ciocniri ținem. Mai vechi de atât nimeni nu le mai revendică. */
export const MAX_CONFLICTS = 50;

export interface Conflict {
  table: TableName;
  id: string;
  /** Când am observat ciocnirea. */
  at: string;
  /** Cum arăta rândul pe server, adică versiunea care s-ar fi pierdut. */
  remote: Record<string, unknown>;
  /** Din ce câmpuri se vede diferența — doar ca să avem ce arăta. */
  fields: string[];
}

/** Câmpurile pe care nu le comparăm: se schimbă singure la orice scriere. */
const IGNORED = new Set(["updated_at", "synced_at", "created_at", "user_id", "id"]);

function differingFields(
  local: Record<string, unknown> | undefined,
  remote: Record<string, unknown>,
): string[] {
  if (!local) return [];
  const fields: string[] = [];
  for (const key of Object.keys(remote)) {
    if (IGNORED.has(key)) continue;
    if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) fields.push(key);
  }
  return fields;
}

export async function listConflicts(): Promise<Conflict[]> {
  const list = await metaGet<Conflict[]>(KEY);
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Ține minte o versiune care urmează să fie aruncată.
 *
 * Doar când chiar diferă de ce avem: altfel o sincronizare obișnuită, în care
 * serverul ne trimite înapoi exact ce i-am dat, ar umple lista de nimic.
 */
export async function recordConflict(
  table: TableName,
  remote: BaseRow,
  local: BaseRow | undefined,
): Promise<boolean> {
  const fields = differingFields(
    local as unknown as Record<string, unknown> | undefined,
    remote as unknown as Record<string, unknown>,
  );
  if (!fields.length) return false;

  return serialize(async () => {
    const list = await listConflicts();
    const rest = list.filter(
      (item) => !(item.table === table && item.id === remote.id),
    );
    const next: Conflict = {
      table,
      id: remote.id,
      at: new Date().toISOString(),
      remote: remote as unknown as Record<string, unknown>,
      fields,
    };
    await metaSet(KEY, [next, ...rest].slice(0, MAX_CONFLICTS));
    return true;
  });
}

export function dismissConflict(table: TableName, id: string): Promise<void> {
  return serialize(async () => {
    const list = await listConflicts();
    await metaSet(
      KEY,
      list.filter((item) => !(item.table === table && item.id === id)),
    );
  });
}

export function clearConflicts(): Promise<void> {
  return serialize(() => metaSet(KEY, []));
}

/**
 * Ia versiunea de pe celălalt dispozitiv.
 *
 * Scrie valorile ei peste rândul local, deci pleacă la rândul ei spre server
 * ca o modificare obișnuită. Câmpurile de administrare rămân ale rândului
 * local: altfel am strica tocmai cronologia care face sincronizarea să meargă.
 */
export async function applyConflict(table: TableName, id: string): Promise<boolean> {
  const conflict = (await listConflicts()).find(
    (item) => item.table === table && item.id === id,
  );
  if (!conflict) return false;

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(conflict.remote)) {
    if (IGNORED.has(key)) continue;
    patch[key] = value;
  }

  const updated = await store.update(table, id, patch as Partial<Tables[TableName]>);
  await dismissConflict(table, id);
  return Boolean(updated);
}
