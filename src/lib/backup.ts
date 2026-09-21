/**
 * Copiile de siguranță.
 *
 * Datele stau în IndexedDB, pe telefon. Dacă telefonul se pierde sau cineva
 * apasă greșit „Import”, nu există un buton „înapoi” — de aceea aplicația își
 * face singură o copie locală și îl bate la cap pe om să descarce, din când în
 * când, un fișier care nu stă pe același telefon.
 *
 * Copia locală salvează de greșeli (import peste date, ștergeri în masă).
 * Numai fișierul descărcat salvează de telefonul pierdut; browserul nu poate
 * descărca singur, fără o apăsare — de aici mementoul.
 */
import { metaDelete, metaGet, metaSet } from "@/lib/db/idb";
import { store } from "@/lib/db/store";
import { exportData, importData } from "@/lib/db/actions";

const INDEX_KEY = "backup:index";
const SNAPSHOT_KEY = "backup:snapshot:";
const DOWNLOAD_KEY = "backup:downloaded_at";
const SNOOZE_KEY = "backup:snooze_until";

/** Câte copii locale ținem. Mai multe n-ar încăpea pe telefoanele mici. */
export const KEEP_SNAPSHOTS = 3;
/** O copie pe zi e destul: mai des ar scrie degeaba la fiecare deschidere. */
export const SNAPSHOT_EVERY_MS = 24 * 60 * 60 * 1000;
/** După atâtea zile fără un fișier descărcat, aplicația întreabă. */
export const REMIND_AFTER_DAYS = 14;

export interface SnapshotMeta {
  /** Clipa copiei, în ISO. Ține loc și de cheie. */
  at: string;
  /** Câte rânduri are copia — ca omul să vadă dacă e cea bună. */
  rows: number;
}

/** Numărul de rânduri vii din baza locală. */
export function liveRowCount(): number {
  const state = store.getState();
  return Object.values(state).reduce(
    (acc, rows) => acc + (rows as unknown[]).length,
    0,
  );
}

export async function snapshots(): Promise<SnapshotMeta[]> {
  const index = await metaGet<SnapshotMeta[]>(INDEX_KEY);
  if (!Array.isArray(index)) return [];
  return [...index].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Ia o copie locală, dacă e cazul.
 *
 * Returnează copia făcută sau `null` când n-a fost nevoie: fără date n-are ce
 * salva, iar dacă cea de ieri e încă proaspătă nu scriem alta degeaba.
 */
export async function takeSnapshot(force = false): Promise<SnapshotMeta | null> {
  const rows = liveRowCount();
  if (!rows) return null;

  const existing = await snapshots();
  if (!force && existing.length) {
    const age = Date.now() - new Date(existing[0].at).getTime();
    if (age < SNAPSHOT_EVERY_MS) return null;
  }

  const payload = exportData();
  // Clipa e și cheia: două copii luate în aceeași milisecundă s-ar suprascrie
  // una pe alta și indexul ar arăta o copie care nu mai există.
  let at = payload.exported_at;
  while (existing.some((copy) => copy.at === at)) {
    at = new Date(new Date(at).getTime() + 1).toISOString();
  }
  const meta: SnapshotMeta = { at, rows };
  await metaSet(`${SNAPSHOT_KEY}${meta.at}`, { ...payload, exported_at: at });

  const kept = [meta, ...existing].slice(0, KEEP_SNAPSHOTS);
  for (const old of existing.slice(KEEP_SNAPSHOTS - 1)) {
    await metaDelete(`${SNAPSHOT_KEY}${old.at}`);
  }
  await metaSet(INDEX_KEY, kept);
  return meta;
}

/** Întoarce datele la o copie locală. Returnează câte rânduri a adus. */
export async function restoreSnapshot(at: string): Promise<number> {
  const payload = await metaGet<{ data?: Record<string, unknown[]> }>(
    `${SNAPSHOT_KEY}${at}`,
  );
  if (!payload?.data) throw new Error("Copia nu mai există");
  return importData(payload);
}

export async function markDownloaded(at = new Date().toISOString()) {
  await metaSet(DOWNLOAD_KEY, at);
  await metaDelete(SNOOZE_KEY);
}

/**
 * Descarcă toate datele într-un fișier și ține minte când.
 *
 * Browserul nu pornește o descărcare fără o apăsare de om, așa că „automat”
 * se oprește aici: aplicația poate aminti, restul e o apăsare.
 */
export async function downloadBackup(): Promise<string> {
  const payload = exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `montcraft-backup-${payload.exported_at.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  await markDownloaded(payload.exported_at);
  return payload.exported_at;
}

/** „Mai târziu”: mementoul tace câteva zile. */
export async function snoozeReminder(days = 3) {
  await metaSet(SNOOZE_KEY, new Date(Date.now() + days * 86_400_000).toISOString());
}

export async function lastDownloadAt(): Promise<string | null> {
  return metaGet<string>(DOWNLOAD_KEY);
}

/** Câte zile au trecut de la o clipă ISO. */
export function daysSince(at: string | null): number | null {
  if (!at) return null;
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export interface BackupStatus {
  lastDownload: string | null;
  days: number | null;
  /** E vremea unui fișier descărcat? */
  due: boolean;
  rows: number;
}

export async function backupStatus(): Promise<BackupStatus> {
  const lastDownload = await lastDownloadAt();
  const days = daysSince(lastDownload);
  const rows = liveRowCount();
  const snooze = await metaGet<string>(SNOOZE_KEY);
  const sleeping = Boolean(snooze && new Date(snooze).getTime() > Date.now());
  return {
    lastDownload,
    days,
    rows,
    // Un cont gol n-are ce pierde, deci nu-l batem la cap degeaba.
    due: rows > 0 && !sleeping && (days === null || days >= REMIND_AFTER_DAYS),
  };
}
