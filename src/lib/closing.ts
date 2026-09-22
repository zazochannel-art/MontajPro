/**
 * Închiderea lucrării.
 *
 * Două lucruri care se întâmplă la final și care costă dacă se uită: prețul
 * care s-a dus de la ofertă fără ca nimeni să-i spună clientului, și drumul
 * înapoi după ceva ce n-ai făcut cât erai acolo.
 */
import { num } from "./utils";
import type { Handover, Job, JobPhoto, Quote, QuoteItem } from "./types";

/* ------------------------------------------------------------------ */
/* Abaterea de la ofertă                                               */
/* ------------------------------------------------------------------ */

export interface QuoteDeviation {
  /** Cât scria în oferta acceptată. */
  quoted: number;
  /** Cât e acum pe lucrare. */
  current: number;
  diff: number;
  percent: number;
}

/** Sub atâta procent, diferența nu merită o discuție. */
const NOISE_PERCENT = 2;

/**
 * Cât s-a dus prețul față de oferta pe care a acceptat-o clientul.
 *
 * Se uită doar la ofertele acceptate: una trimisă și neconfirmată n-a promis
 * încă nimic. Întoarce `null` când nu există ofertă acceptată sau când
 * diferența e sub pragul de zgomot — nu vrem un semnal la fiecare leu.
 */
export function quoteDeviation(
  job: Pick<Job, "id" | "price_total">,
  quotes: Quote[],
  items: QuoteItem[],
): QuoteDeviation | null {
  const accepted = quotes
    .filter(
      (quote) =>
        !quote.deleted_at &&
        quote.job_id === job.id &&
        quote.status === "accepted",
    )
    // Dacă sunt mai multe, cea mai nouă e cea care contează.
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (!accepted) return null;

  // Oferta n-are un total al ei: se adună din poziții, minus reducerea —
  // exact cum îl vede clientul pe pagina publică.
  const subtotal = items
    .filter((item) => !item.deleted_at && item.quote_id === accepted.id)
    .reduce((acc, item) => acc + num(item.quantity) * num(item.unit_price), 0);
  const quoted = Math.max(0, subtotal - num(accepted.discount));
  if (quoted <= 0) return null;

  const current = num(job.price_total);
  const diff = Math.round((current - quoted) * 100) / 100;
  const percent = Math.round((diff / quoted) * 1000) / 10;
  if (Math.abs(percent) < NOISE_PERCENT) return null;

  return { quoted, current, diff, percent };
}

/* ------------------------------------------------------------------ */
/* Checklistul de plecare                                              */
/* ------------------------------------------------------------------ */

export interface ClosingItem {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  /** Unde duce apăsarea, dacă nu e făcut. */
  href?: string;
}

/**
 * Ce-ți mai rămâne de făcut înainte să pleci de pe șantier.
 *
 * Nu inventează stare: fiecare rând se citește din ce există deja — poze,
 * proces-verbal, bani. Perechea pozei „înainte”, cerută la START.
 */
export function closingChecklist(input: {
  job: Job;
  photos: JobPhoto[];
  handover: Handover | null;
  rest: number;
}): ClosingItem[] {
  const { job, photos, handover, rest } = input;
  const live = photos.filter((p) => !p.deleted_at && p.job_id === job.id);

  return [
    {
      key: "after",
      label: "Poza „după”",
      hint: "Cum arată lucrarea terminată. Intră și în portofoliu.",
      done: live.some((photo) => photo.stage === "after"),
      href: `/lucrari/${job.id}?tab=poze`,
    },
    {
      key: "handover",
      label: "Proces-verbal de predare",
      hint: "Cu el începe garanția. Fără el, nu începe.",
      done: !!handover && !handover.deleted_at,
      href: `/lucrari/${job.id}?tab=finante`,
    },
    {
      key: "signature",
      label: "Semnătura clientului",
      hint: "Pe telefonul tău, sau prin link dacă omul nu e acolo.",
      done: !!handover && (!!handover.signature || !!handover.client_signature_image),
      href: handover ? `/predare/${handover.id}` : undefined,
    },
    {
      key: "money",
      label: "Banii încasați",
      hint: "Restul de plată e cel mai ușor de cerut cât ești încă acolo.",
      done: rest <= 0,
      href: `/lucrari/${job.id}?tab=finante`,
    },
    {
      key: "status",
      label: "Lucrarea marcată finalizată",
      hint: "Ca să iasă din listele de zi cu zi și să intre în rapoarte.",
      done: job.status === "done",
    },
  ];
}

/** Câte au rămas nefăcute. Zero înseamnă că poți pleca liniștit. */
export function closingLeft(items: ClosingItem[]): number {
  return items.filter((item) => !item.done).length;
}
