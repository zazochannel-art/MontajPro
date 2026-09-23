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

/* ------------------------------------------------------------------ */
/* Ce-a rămas neînchis, pe toate lucrările                             */
/* ------------------------------------------------------------------ */

/**
 * Lucrarea „în lucru” a cărei ultimă zi programată a trecut.
 *
 * Fără nicio zi programată nu se poate spune că a întârziat: poate chiar
 * acum se lucrează la ea.
 */
function overdue(
  job: Pick<Job, "scheduled_date" | "scheduled_end_date">,
  today: string,
): boolean {
  const last = job.scheduled_end_date ?? job.scheduled_date;
  if (!last) return false;
  return last.slice(0, 10) < today.slice(0, 10);
}

export interface OpenClosing {
  job: Job;
  /** Pașii rămași nefăcuți, din aceeași listă ca pe șantier. */
  items: ClosingItem[];
  /** Câți au rămas. */
  left: number;
  /** Rest de încasat, dacă mai e. */
  rest: number;
}

/**
 * Lucrările terminate care au ceva neînchis, toate la un loc.
 *
 * `closingChecklist` se vede doar intrând în lucrare — adică exact când ești
 * deja acolo și îți amintești singur. Aceeași problemă pe care o avea
 * checklistul înainte de `todo.ts`: dimineața, întrebarea e ce-a rămas atârnat
 * peste tot, nu ce-a rămas la lucrarea asta.
 *
 * Intră doar lucrările a căror treabă ar trebui să fie gata: cele finalizate,
 * și cele încă „în lucru” a căror ultimă zi programată a trecut. Pe una
 * începută azi-dimineață, lipsa pozei „după” nu e o scăpare — e ordinea
 * firească a lucrurilor, iar o listă care strigă despre ea se învață repede
 * să fie ignorată. Arhivatele nu mai cer nimic: ce s-a arhivat s-a închis
 * dinadins.
 */
export function openClosings(input: {
  jobs: Job[];
  photos: JobPhoto[];
  handovers: Handover[];
  payments: {
    job_id: string | null;
    amount: number;
    deleted_at?: string | null;
  }[];
  /** Ziua de azi, ca să se știe ce-a trecut de termen. */
  today: string;
}): OpenClosing[] {
  const { jobs, photos, handovers, payments, today } = input;

  const paidByJob = new Map<string, number>();
  for (const payment of payments) {
    if (payment.deleted_at || !payment.job_id) continue;
    paidByJob.set(
      payment.job_id,
      (paidByJob.get(payment.job_id) ?? 0) + num(payment.amount),
    );
  }

  /*
   * Pozele se grupează o dată, nu se filtrează pentru fiecare lucrare.
   * `closingChecklist` trece prin toată lista la fiecare apel, iar aici se
   * apelează pentru fiecare lucrare: pe un telefon cu doi ani de poze,
   * socoteala asta se făcea de zeci de mii de ori la fiecare randare.
   */
  const photosByJob = new Map<string, JobPhoto[]>();
  for (const photo of photos) {
    if (photo.deleted_at || !photo.job_id) continue;
    const list = photosByJob.get(photo.job_id);
    if (list) list.push(photo);
    else photosByJob.set(photo.job_id, [photo]);
  }

  const out: OpenClosing[] = [];
  for (const job of jobs) {
    if (job.deleted_at || job.archived_at) continue;
    if (job.status !== "done" && job.status !== "in_progress") continue;
    if (job.status === "in_progress" && !overdue(job, today)) continue;

    const rest = num(job.price_total) - (paidByJob.get(job.id) ?? 0);
    const handover =
      handovers.find((row) => row.job_id === job.id && !row.deleted_at) ?? null;
    const items = closingChecklist({
      job,
      photos: photosByJob.get(job.id) ?? [],
      handover,
      rest,
    });
    const open = items.filter((item) => !item.done);
    if (!open.length) continue;

    out.push({ job, items: open, left: open.length, rest: Math.max(0, rest) });
  }

  // Cele mai încurcate întâi; la egalitate, banii neîncasați trag înainte.
  return out.sort((a, b) => b.left - a.left || b.rest - a.rest);
}
