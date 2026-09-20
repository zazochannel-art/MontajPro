"use client";

/**
 * Fotografii: capturare de pe telefon → comprimare → IndexedDB → Supabase
 * Storage.
 *
 * Ordinea contează. Poza intră întâi local (deci se vede imediat, chiar fără
 * semnal) și abia apoi se încearcă urcarea. Dacă urcarea eșuează, `storage_path`
 * rămâne gol și încercăm din nou la următoarea sincronizare.
 */
import { PHOTO_BUCKET, getSupabase } from "./supabase/client";
import { blobDelete, blobGet, blobPut } from "./db/idb";
import { uid } from "./utils";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Scrie data peste poză, jos în dreapta.
 *
 * O poză „înainte” fără dată nu ține loc de dovadă: oricine poate spune că e
 * de altădată. Bara închisă din spate e acolo pentru că un text alb pe o
 * șapă albă nu se vede.
 */
function drawStamp(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
) {
  const size = Math.max(14, Math.round(width * 0.028));
  context.font = `600 ${size}px system-ui, -apple-system, sans-serif`;
  context.textBaseline = "alphabetic";
  const padding = Math.round(size * 0.55);
  const textWidth = context.measureText(text).width;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = size + padding * 1.6;
  const x = width - boxWidth - padding;
  const y = height - boxHeight - padding;

  context.fillStyle = "rgba(0, 0, 0, 0.55)";
  context.fillRect(x, y, boxWidth, boxHeight);
  context.fillStyle = "#ffffff";
  context.fillText(text, x + padding, y + boxHeight - padding * 1.1);
}

/** Redimensionează și comprimă o poză înainte de urcare. */
export async function compressImage(
  file: File,
  stamp?: string | null,
): Promise<Blob> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    // Scurtătura „e deja mică, o lăsăm așa” nu se aplică la ștampilat: acolo
    // poza chiar trebuie redesenată.
    if (scale === 1 && file.size < 900_000 && !stamp) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    if (stamp) drawStamp(context, canvas.width, canvas.height, stamp);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    // Ștampilată, poza trebuie păstrată chiar dacă a ieșit mai mare.
    return blob && (stamp || blob.size < file.size) ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Textul ștampilei, sau `null` dacă utilizatorul a oprit-o.
 *
 * Ora intră și ea: la o lucrare de două zile, ziua singură nu spune care poză
 * e de dimineață și care de la final.
 */
export function stampText(enabled: boolean | null | undefined): string | null {
  if (enabled === false) return null;
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export interface StoredAsset {
  local_key: string;
  storage_path: string | null;
}

/** Salvează local și încearcă urcarea în bucket. */
export async function storeImage(
  file: File,
  folder: string,
  userId: string,
  stamp?: string | null,
): Promise<StoredAsset> {
  const blob = await compressImage(file, stamp);
  const localKey = uid();
  await blobPut(localKey, blob);

  const supabase = getSupabase();
  if (!supabase || !userId) return { local_key: localKey, storage_path: null };

  const extension = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg");
  const path = `${userId}/${folder}/${localKey}.${extension}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: true,
  });
  if (error) return { local_key: localKey, storage_path: null };
  return { local_key: localKey, storage_path: path };
}

/** Reîncearcă urcarea unei poze rămase doar local. */
export async function retryUpload(
  localKey: string,
  folder: string,
  userId: string,
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase || !userId) return null;
  const blob = await blobGet(localKey);
  if (!blob) return null;
  const path = `${userId}/${folder}/${localKey}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: true,
  });
  return error ? null : path;
}

const urlCache = new Map<string, string>();

/** URL afișabil: întâi blobul local (instant), apoi Storage. */
export async function resolveAssetUrl(
  storagePath: string | null | undefined,
  localKey: string | null | undefined,
): Promise<string | null> {
  if (localKey) {
    const cached = urlCache.get(`local:${localKey}`);
    if (cached) return cached;
    const blob = await blobGet(localKey);
    if (blob) {
      const url = URL.createObjectURL(blob);
      urlCache.set(`local:${localKey}`, url);
      return url;
    }
  }
  if (storagePath) {
    const cached = urlCache.get(`remote:${storagePath}`);
    if (cached) return cached;
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 6);
    if (data?.signedUrl) {
      urlCache.set(`remote:${storagePath}`, data.signedUrl);
      return data.signedUrl;
    }
  }
  return null;
}

export async function deleteAsset(
  storagePath: string | null | undefined,
  localKey: string | null | undefined,
): Promise<void> {
  if (localKey) {
    const url = urlCache.get(`local:${localKey}`);
    if (url) {
      URL.revokeObjectURL(url);
      urlCache.delete(`local:${localKey}`);
    }
    await blobDelete(localKey);
  }
  if (storagePath) {
    urlCache.delete(`remote:${storagePath}`);
    const supabase = getSupabase();
    await supabase?.storage.from(PHOTO_BUCKET).remove([storagePath]);
  }
}
