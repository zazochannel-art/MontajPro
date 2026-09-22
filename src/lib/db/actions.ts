"use client";

/**
 * Acțiunile de scriere ale aplicației.
 *
 * Tot ce modifică date trece pe aici, ca regulile de business (cascade la
 * ștergere, jurnalul de activitate, numerotarea ofertelor) să stea într-un
 * singur loc, nu prin componente.
 */
import { store } from "./store";
import { syncNow } from "./sync";
import { deleteAsset } from "../storage";
import { CLIENT_TABLES } from "../clients";
import type {
  ClientAddress,
  ClientSource,
  Client,
  ExpenseCategory,
  Job,
  JobStatus,
  JobType,
  MeasurementData,
  PaymentKind,
  PaymentMethod,
  PhotoStage,
  Quote,
  QuoteItem,
  Settings,
  TableName,
} from "../types";
import { nowISO, num, uid } from "../utils";
import { planFromQuote } from "../quote-convert";
import { extendedUntil } from "../expiry";
import { allPositions } from "../price-list";
import { todayKey } from "../format";

/** Trimite modificările imediat, fără să blocheze interfața. */
function kick() {
  void syncNow();
}

/* ------------------------------- clienți --------------------------- */

export async function saveClient(input: {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  source?: ClientSource | null;
  referred_by_client_id?: string | null;
  price_adjust?: number | null;
  addresses?: ClientAddress[];
}) {
  const payload = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    source: input.source ?? null,
    // Cine l-a trimis are sens doar la o recomandare; altfel rămâne gol, ca
    // să nu ținem o legătură care nu mai înseamnă nimic.
    referred_by_client_id:
      input.source === "recommendation" ? (input.referred_by_client_id ?? null) : null,
    price_adjust: num(input.price_adjust),
    // Adresele goale n-au ce căuta în listă: un rând fără adresă nu e o
    // adresă, e un rând pe care l-ai deschis și l-ai lăsat așa.
    addresses: (input.addresses ?? [])
      .map((row) => ({
        label: row.label.trim(),
        address: row.address.trim(),
      }))
      .filter((row) => row.address),
  };
  const row = input.id
    ? await store.update("clients", input.id, payload)
    : await store.insert("clients", payload);
  kick();
  return row;
}

/**
 * Unește doi clienți: tot ce e al lui `fromId` trece la `intoId`.
 *
 * Nu se pierde nimic. Lucrările, plățile, ofertele, facturile,
 * procesele-verbale, măsurătorile și proiectele își schimbă doar stăpânul,
 * iar câmpurile goale ale celui rămas se completează din cel care pleacă —
 * telefonul scris o singură dată, la dublură, n-are de ce să dispară.
 *
 * Dublura pleacă în coș, deci unirea greșită are drum înapoi.
 */
export async function mergeClients(fromId: string, intoId: string): Promise<number> {
  if (fromId === intoId) return 0;
  const from = store.getTable("clients").find((row) => row.id === fromId);
  const into = store.getTable("clients").find((row) => row.id === intoId);
  if (!from || !into) return 0;

  let moved = 0;
  for (const table of CLIENT_TABLES) {
    for (const row of store.getTable(table)) {
      const owner = (row as { client_id?: string | null }).client_id;
      if (row.deleted_at || owner !== fromId) continue;
      await store.update(table, row.id, { client_id: intoId } as never);
      moved++;
    }
  }

  const patch: Partial<Client> = {};
  if (!into.phone && from.phone) patch.phone = from.phone;
  if (!into.email && from.email) patch.email = from.email;
  if (!into.address && from.address) patch.address = from.address;
  if (from.notes) {
    patch.notes = into.notes ? `${into.notes}\n${from.notes}` : from.notes;
  }
  if (Object.keys(patch).length) await store.update("clients", intoId, patch);

  await store.remove("clients", fromId);
  kick();
  return moved;
}

export async function deleteClient(id: string) {
  // Lucrările rămân, dar pierd legătura — istoricul financiar nu se pierde.
  const jobs = store.getTable("jobs").filter((job) => job.client_id === id);
  for (const job of jobs)
    await store.update("jobs", job.id, { client_id: null });
  await store.remove("clients", id);
  kick();
}

/* -------------------------------- proiecte ------------------------- */

export async function saveProject(input: {
  id?: string;
  name: string;
  client_id?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  const payload = {
    name: input.name.trim(),
    client_id: input.client_id || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await store.update("projects", input.id, payload)
    : await store.insert("projects", payload);
  kick();
  return row;
}

export async function deleteProject(id: string) {
  // Proiectul e doar un acoperiș. Când cade, lucrările rămân în picioare —
  // cu banii, pozele și scadențarele lor cu tot.
  const jobs = store.getTable("jobs").filter((job) => job.project_id === id);
  for (const job of jobs) await store.update("jobs", job.id, { project_id: null });
  await store.remove("projects", id);
  kick();
}

/** Mută o lucrare în proiect sau o scoate din el. */
export async function setJobProject(jobId: string, projectId: string | null) {
  await store.update("jobs", jobId, { project_id: projectId });
  kick();
}

/* -------------------------------- lucrări -------------------------- */

export interface JobInput {
  id?: string;
  client_id: string | null;
  project_id?: string | null;
  title: string;
  type: JobType;
  status: JobStatus;
  address?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  estimated_hours?: number | null;
  /** Dus-întors, în kilometri; se înmulțește cu tariful pe km din setări. */
  travel_km?: number | null;
  /** Ultima zi, când lucrarea ține mai multe. */
  scheduled_end_date?: string | null;
  /** Omul din echipă trimis acolo; gol = mergi tu. */
  assigned_member_id?: string | null;
  price_total: number;
  material_cost?: number | null;
  notes?: string | null;
  /** Avansul introdus la creare devine o plată de tip „avans”. */
  advance?: number;
}

export async function saveJob(input: JobInput) {
  const payload = {
    client_id: input.client_id,
    project_id: input.project_id ?? null,
    title: input.title.trim(),
    type: input.type,
    status: input.status,
    address: input.address?.trim() || null,
    scheduled_date: input.scheduled_date || null,
    scheduled_end_date: input.scheduled_end_date || null,
    scheduled_time: input.scheduled_time || null,
    assigned_member_id: input.assigned_member_id || null,
    estimated_hours: input.estimated_hours ?? null,
    travel_km: input.travel_km ?? null,
    price_total: num(input.price_total),
    material_cost: input.material_cost ?? null,
    notes: input.notes?.trim() || null,
  };

  let job: Job | null;
  if (input.id) {
    job = await store.update("jobs", input.id, payload);
  } else {
    job = await store.insert("jobs", {
      ...payload,
      start_date: null,
      end_date: null,
      in_portfolio: false,
      portfolio_description: null,
    });
    if (job && num(input.advance) > 0) {
      await addPayment({
        job_id: job.id,
        client_id: input.client_id,
        amount: num(input.advance),
        kind: "advance",
        method: "cash",
        paid_at: todayKey(),
        note: "Avans la creare",
      });
    }
  }
  kick();
  return job;
}

export async function setJobStatus(id: string, status: JobStatus) {
  const patch: Partial<Job> = { status };
  if (status === "in_progress") {
    const job = store.getTable("jobs").find((row) => row.id === id);
    if (job && !job.start_date) patch.start_date = todayKey();
  }
  if (status === "done") patch.end_date = todayKey();
  await store.update("jobs", id, patch);
  kick();
}

export async function updateJob(id: string, patch: Partial<Job>) {
  const row = await store.update("jobs", id, patch);
  kick();
  return row;
}

/** Șterge lucrarea și tot ce atârnă de ea. */
export async function deleteJob(id: string) {
  const children: { table: TableName; id: string }[] = [];
  const collect = <K extends TableName>(
    table: K,
    match: (row: { job_id?: string | null }) => boolean,
  ) => {
    for (const row of store.getTable(table) as unknown as {
      id: string;
      job_id?: string | null;
    }[]) {
      if (match(row)) children.push({ table, id: row.id });
    }
  };
  collect("job_measurements", (row) => row.job_id === id);
  collect("job_photos", (row) => row.job_id === id);
  // Pozele lucrării pleacă și din Storage, nu doar din listă.
  for (const photo of store
    .getTable("job_photos")
    .filter((row) => row.job_id === id)) {
    await deleteAsset(photo.storage_path, photo.local_key);
  }
  collect("job_materials", (row) => row.job_id === id);
  collect("payments", (row) => row.job_id === id);
  collect("work_sessions", (row) => row.job_id === id);
  collect("notifications", (row) => row.job_id === id);
  // Cheltuielile rămân în evidența financiară, doar pierd legătura.
  for (const expense of store
    .getTable("expenses")
    .filter((row) => row.job_id === id)) {
    await store.update("expenses", expense.id, { job_id: null });
  }
  for (const quote of store
    .getTable("quotes")
    .filter((row) => row.job_id === id)) {
    await store.update("quotes", quote.id, { job_id: null });
  }
  await store.removeMany(children);
  await store.remove("jobs", id);
  kick();
}

/* ------------------------------ cronometru ------------------------- */

export async function startWork(jobId: string) {
  const running = store
    .getTable("work_sessions")
    .find((session) => !session.ended_at && !session.deleted_at);
  if (running) await stopWork(running.id);

  const session = await store.insert("work_sessions", {
    job_id: jobId,
    started_at: nowISO(),
    ended_at: null,
    duration_minutes: null,
    note: null,
    // Gol: sesiunea pornită de aici e a ta, nu a unui ajutor.
    by_member_id: null,
    by_member_name: null,
  });
  const job = store.getTable("jobs").find((row) => row.id === jobId);
  if (job && job.status !== "in_progress")
    await setJobStatus(jobId, "in_progress");
  kick();
  return session;
}

export async function stopWork(sessionId: string, note?: string) {
  const session = store
    .getTable("work_sessions")
    .find((row) => row.id === sessionId);
  if (!session || session.ended_at) return null;
  const endedAt = nowISO();
  const minutes = Math.max(
    1,
    Math.round(
      (new Date(endedAt).getTime() - new Date(session.started_at).getTime()) /
        60_000,
    ),
  );
  const row = await store.update("work_sessions", sessionId, {
    ended_at: endedAt,
    duration_minutes: minutes,
    note: note?.trim() || null,
  });
  kick();
  return row;
}

export async function deleteWorkSession(id: string) {
  await store.remove("work_sessions", id);
  kick();
}

/* ------------------------------ măsurători ------------------------- */

export async function saveMeasurement(input: {
  id?: string;
  job_id: string | null;
  client_id?: string | null;
  kind: JobType;
  label?: string | null;
  data: MeasurementData;
  notes?: string | null;
}) {
  const payload = {
    job_id: input.job_id,
    client_id: input.client_id ?? null,
    kind: input.kind,
    label: input.label?.trim() || null,
    data: input.data,
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await store.update("job_measurements", input.id, payload)
    : await store.insert("job_measurements", payload);
  kick();
  return row;
}

export async function deleteMeasurement(id: string) {
  await store.remove("job_measurements", id);
  kick();
}

/* -------------------------------- poze ----------------------------- */

export async function addPhoto(input: {
  job_id: string | null;
  measurement_id?: string | null;
  stage: PhotoStage;
  storage_path: string | null;
  local_key: string | null;
  caption?: string | null;
}) {
  const row = await store.insert("job_photos", {
    job_id: input.job_id,
    measurement_id: input.measurement_id ?? null,
    stage: input.stage,
    storage_path: input.storage_path,
    local_key: input.local_key,
    caption: input.caption ?? null,
  });
  kick();
  return row;
}

export async function deletePhoto(id: string) {
  const photo = store.getTable("job_photos").find((row) => row.id === id);
  if (photo) await deleteAsset(photo.storage_path, photo.local_key);
  await store.remove("job_photos", id);
  kick();
}

/* ------------------------- materiale pe lucrare -------------------- */

export async function saveJobMaterial(input: {
  id?: string;
  job_id: string;
  material_id?: string | null;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  purchased?: boolean;
}) {
  const payload = {
    job_id: input.job_id,
    material_id: input.material_id ?? null,
    name: input.name.trim(),
    quantity: num(input.quantity),
    unit: input.unit,
    unit_price: num(input.unit_price),
    purchased: input.purchased ?? false,
  };
  // La editare nu atingem steagul de stoc: l-ar stinge fără să pună materialul
  // înapoi pe raft, și stocul ar rămâne scăzut degeaba.
  const row = input.id
    ? await store.update("job_materials", input.id, payload)
    : await store.insert("job_materials", { ...payload, taken_from_stock: false });
  kick();
  return row;
}

/**
 * Scoate din depozit materialul pus pe lucrare.
 *
 * Inventarul nu scădea niciodată singur: aveai cantități în depozit și
 * materiale pe lucrări, iar cele două nu se atingeau. După câteva lucrări,
 * stocul din aplicație n-avea nicio legătură cu raftul.
 *
 * Scade o singură dată — steagul de pe linie ține minte — și nu coboară sub
 * zero: un stoc negativ nu înseamnă nimic. Cât a lipsit se întoarce
 * apelantului, ca omul să afle că a luat mai mult decât scria.
 */
export async function takeFromStock(jobMaterialId: string) {
  const line = store
    .getTable("job_materials")
    .find((row) => row.id === jobMaterialId);
  if (!line || line.taken_from_stock || !line.material_id) return null;

  const stock = store
    .getTable("materials")
    .find((row) => row.id === line.material_id);
  if (!stock) return null;

  const needed = num(line.quantity);
  const available = num(stock.quantity);
  await store.update("materials", stock.id, {
    quantity: Math.max(0, available - needed),
  });
  await store.update("job_materials", line.id, { taken_from_stock: true });
  kick();
  return { needed, available, short: Math.max(0, needed - available) };
}

/** Materialul se întoarce pe raft: nu s-a folosit, sau s-a apăsat greșit. */
export async function returnToStock(jobMaterialId: string) {
  const line = store
    .getTable("job_materials")
    .find((row) => row.id === jobMaterialId);
  if (!line || !line.taken_from_stock || !line.material_id) return;

  const stock = store
    .getTable("materials")
    .find((row) => row.id === line.material_id);
  if (stock) {
    await store.update("materials", stock.id, {
      quantity: num(stock.quantity) + num(line.quantity),
    });
  }
  await store.update("job_materials", line.id, { taken_from_stock: false });
  kick();
}

export async function toggleJobMaterial(id: string, purchased: boolean) {
  await store.update("job_materials", id, { purchased });
  kick();
}

export async function deleteJobMaterial(id: string) {
  await store.remove("job_materials", id);
  kick();
}

/* --------------------------- inventar materiale -------------------- */

export async function saveMaterial(input: {
  id?: string;
  name: string;
  category?: string | null;
  quantity: number;
  unit: string;
  price: number;
  supplier?: string | null;
  notes?: string | null;
  /** Cât are un pachet, în unitatea materialului. Gol = se ia la bucată. */
  pack_size?: number | null;
}) {
  const payload = {
    name: input.name.trim(),
    category: input.category || null,
    quantity: num(input.quantity),
    unit: input.unit,
    price: num(input.price),
    supplier: input.supplier?.trim() || null,
    notes: input.notes?.trim() || null,
    pack_size: input.pack_size && input.pack_size > 0 ? input.pack_size : null,
  };
  const row = input.id
    ? await store.update("materials", input.id, payload)
    : await store.insert("materials", payload);
  kick();
  return row;
}

export async function deleteMaterial(id: string) {
  await store.remove("materials", id);
  kick();
}

/* --------------------------------- bani ---------------------------- */

export async function addPayment(input: {
  id?: string;
  job_id: string | null;
  client_id: string | null;
  amount: number;
  kind: PaymentKind;
  method: PaymentMethod;
  paid_at: string;
  note?: string | null;
}) {
  const payload = {
    job_id: input.job_id,
    client_id: input.client_id,
    amount: num(input.amount),
    kind: input.kind,
    method: input.method,
    paid_at: input.paid_at,
    note: input.note?.trim() || null,
  };
  const row = input.id
    ? await store.update("payments", input.id, payload)
    : await store.insert("payments", payload);
  kick();
  return row;
}

export async function deletePayment(id: string) {
  await store.remove("payments", id);
  kick();
}

export async function saveExpense(input: {
  id?: string;
  job_id: string | null;
  category: ExpenseCategory;
  amount: number;
  spent_at: string;
  note?: string | null;
  receipt_path?: string | null;
  receipt_local_key?: string | null;
}) {
  const payload = {
    job_id: input.job_id,
    category: input.category,
    amount: num(input.amount),
    spent_at: input.spent_at,
    note: input.note?.trim() || null,
    receipt_path: input.receipt_path ?? null,
    receipt_local_key: input.receipt_local_key ?? null,
  };
  const row = input.id
    ? await store.update("expenses", input.id, payload)
    : await store.insert("expenses", payload);
  kick();
  return row;
}

export async function deleteExpense(id: string) {
  const expense = store.getTable("expenses").find((row) => row.id === id);
  if (expense)
    await deleteAsset(expense.receipt_path, expense.receipt_local_key);
  await store.remove("expenses", id);
  kick();
}

/* -------------------------------- scule ---------------------------- */

export async function saveTool(input: {
  id?: string;
  name: string;
  job_types?: JobType[];
  brand?: string | null;
  model?: string | null;
  price?: number | null;
  purchased_at?: string | null;
  warranty_months?: number | null;
  notes?: string | null;
  photo_path?: string | null;
  photo_local_key?: string | null;
}) {
  const payload = {
    name: input.name.trim(),
    job_types: input.job_types ?? [],
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
    price: input.price ?? null,
    purchased_at: input.purchased_at || null,
    warranty_months: input.warranty_months ?? null,
    notes: input.notes?.trim() || null,
    photo_path: input.photo_path ?? null,
    photo_local_key: input.photo_local_key ?? null,
  };
  const row = input.id
    ? await store.update("tools", input.id, payload)
    : await store.insert("tools", payload);
  kick();
  return row;
}

export async function deleteTool(id: string) {
  const tool = store.getTable("tools").find((row) => row.id === id);
  if (tool) await deleteAsset(tool.photo_path, tool.photo_local_key);
  await store.remove("tools", id);
  kick();
}

/* -------------------------------- oferte --------------------------- */

export function nextQuoteNumber(): number {
  const numbers = store.getTable("quotes").map((quote) => quote.number || 0);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

export interface QuoteItemInput {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export async function saveQuote(
  input: {
    id?: string;
    client_id: string | null;
    job_id?: string | null;
    title: string;
    status?: Quote["status"];
    advance?: number;
    discount?: number;
    valid_until?: string | null;
    notes?: string | null;
  },
  items: QuoteItemInput[],
) {
  const payload = {
    client_id: input.client_id,
    job_id: input.job_id ?? null,
    title: input.title.trim() || "Ofertă",
    status: input.status ?? ("draft" as const),
    advance: num(input.advance),
    discount: num(input.discount),
    valid_until: input.valid_until || null,
    notes: input.notes?.trim() || null,
  };

  const quote = input.id
    ? await store.update("quotes", input.id, payload)
    : await store.insert("quotes", {
        ...payload,
        number: nextQuoteNumber(),
        sent_at: null,
        accepted_at: null,
      });
  if (!quote) return null;

  const existing = store
    .getTable("quote_items")
    .filter((item) => item.quote_id === quote.id && !item.deleted_at);
  const keptIds = new Set(
    items.map((item) => item.id).filter(Boolean) as string[],
  );

  for (const item of existing) {
    if (!keptIds.has(item.id)) await store.remove("quote_items", item.id);
  }

  let position = 0;
  for (const item of items) {
    const itemPayload = {
      quote_id: quote.id,
      description: item.description.trim(),
      quantity: num(item.quantity),
      unit: item.unit || "buc",
      unit_price: num(item.unit_price),
      position: position++,
    };
    if (item.id && existing.some((row) => row.id === item.id)) {
      await store.update("quote_items", item.id, itemPayload);
    } else {
      await store.insert("quote_items", itemPayload);
    }
  }

  kick();
  return quote;
}

/**
 * Schimbă starea ofertei.
 *
 * La refuz se ține și motivul: fără el, după trei oferte pierdute singura
 * concluzie care-ți rămâne e „lumea n-are bani”, care nu te ajută să schimbi
 * nimic. Motivul se șterge dacă oferta iese din refuz — ar fi o explicație
 * pentru ceva ce nu s-a mai întâmplat.
 */
export async function setQuoteStatus(
  id: string,
  status: Quote["status"],
  reason?: string | null,
) {
  const patch: Partial<Quote> = { status };
  if (status === "sent") patch.sent_at = nowISO();
  if (status === "accepted") patch.accepted_at = nowISO();
  patch.rejected_reason = status === "rejected" ? reason?.trim() || null : null;
  await store.update("quotes", id, patch);
  kick();
}

/** Ține minte că i-ai dat ghes clientului pentru oferta asta. */
export async function markQuoteReminded(id: string) {
  await store.update("quotes", id, { reminder_sent_at: nowISO() });
  kick();
}

export async function deleteQuote(id: string) {
  const items = store
    .getTable("quote_items")
    .filter((item) => item.quote_id === id);
  await store.removeMany(
    items.map((item) => ({ table: "quote_items" as const, id: item.id })),
  );
  await store.remove("quotes", id);
  kick();
}

export function quoteTotal(
  items: Pick<QuoteItem, "quantity" | "unit_price">[],
  discount = 0,
) {
  const subtotal = items.reduce(
    (acc, item) => acc + num(item.quantity) * num(item.unit_price),
    0,
  );
  return { subtotal, total: Math.max(0, subtotal - num(discount)) };
}

/**
 * Transformă o ofertă acceptată în lucrare.
 *
 * Ce ai scris o dată nu se mai scrie a doua oară: tipul lucrării, orele și
 * kilometrii se citesc din liniile ofertei. Înainte, tipul era mereu
 * „Altceva” și liniile ajungeau lipite ca text în notițe — adică nici
 * șablonul de pași, nici lista de scule, nici media pe unitate nu aveau de
 * unde ști cu ce au de-a face.
 *
 * Liniile rămân pe ofertă, care e legată de lucrare prin `job_id`: acolo se
 * citesc, întregi, oricând. Notițele rămân ale tale.
 *
 * `type` se poate da din afară când se știe mai bine decât din linii.
 */
export async function convertQuoteToJob(
  quoteId: string,
  type?: JobType,
) {
  const quote = store.getTable("quotes").find((row) => row.id === quoteId);
  if (!quote) return null;
  const items = store
    .getTable("quote_items")
    .filter((item) => item.quote_id === quoteId);
  const { total } = quoteTotal(items, quote.discount);

  const settings = store.getTable("settings")[0];
  const plan = planFromQuote(items, allPositions(settings));

  // Avansul din ofertă este o cerere, nu bani încasați: nu creăm o plată
  // pentru el. Se înregistrează când ajunge efectiv la montator.
  const job = await saveJob({
    client_id: quote.client_id,
    title: quote.title,
    type: type ?? plan.type,
    status: "confirmed",
    price_total: total,
    estimated_hours: plan.hours || null,
    travel_km: plan.travelKm || null,
    notes: quote.notes?.trim() || null,
  });
  if (job) {
    await store.update("quotes", quoteId, {
      job_id: job.id,
      status: "accepted",
      accepted_at: nowISO(),
    });
  }
  kick();
  return job;
}

/* ----------------------------- notificări -------------------------- */

export async function markNotificationRead(id: string) {
  await store.update("notifications", id, { read_at: nowISO() });
  kick();
}

export async function dismissNotification(id: string) {
  await store.remove("notifications", id);
  kick();
}

/* ------------------------------- setări ---------------------------- */

export async function updateSettings(patch: Partial<Settings>) {
  const current = store.getTable("settings").find((row) => !row.deleted_at);
  if (!current) return null;
  const row = await store.update("settings", current.id, patch);
  kick();
  return row;
}

/** Export complet al datelor, pentru backup manual. */
export function exportData() {
  const state = store.getState();
  return {
    app: "MontCraft",
    version: 1,
    exported_at: nowISO(),
    data: state,
  };
}

/** Import dintr-un backup — rândurile existente se păstrează, restul se adaugă. */
export async function importData(payload: {
  data?: Record<string, unknown[]>;
}) {
  const data = payload?.data;
  if (!data) throw new Error("Fișier de backup invalid");
  let imported = 0;
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows as Record<string, unknown>[]) {
      if (!row || typeof row !== "object") continue;
      await store.insert(
        table as TableName,
        {
          ...row,
          id: (row.id as string) || uid(),
        } as never,
      );
      imported++;
    }
  }
  kick();
  return imported;
}

/* ------------------------ oferta publică --------------------------- */

/**
 * Pregătește oferta pentru trimitere: îi dă un token dacă nu are și o
 * marchează drept trimisă. Tokenul este lung intenționat — el ține locul
 * parolei pentru cine deschide linkul.
 */
export async function ensureQuoteLink(quoteId: string): Promise<string | null> {
  const quote = store.getTable("quotes").find((row) => row.id === quoteId);
  if (!quote) return null;

  const token = quote.public_token || `${uid()}${uid()}`.replace(/-/g, "");
  const patch: Partial<Quote> = { public_token: token };
  if (quote.status === "draft") {
    patch.status = "sent";
    patch.sent_at = nowISO();
  }
  await store.update("quotes", quoteId, patch);
  kick();
  return token;
}

/* ------------------------------ facturi ---------------------------- */

export function nextInvoiceNumber(series: string): number {
  const numbers = store
    .getTable("invoices")
    .filter((invoice) => !invoice.deleted_at && invoice.series === series)
    .map((invoice) => invoice.number || 0);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

export interface InvoiceInput {
  id?: string;
  job_id: string | null;
  client_id: string | null;
  series: string;
  issued_at: string;
  due_at?: string | null;
  subtotal: number;
  vat_percent: number;
  notes?: string | null;
  paid_at?: string | null;
}

export async function saveInvoice(input: InvoiceInput) {
  const client = input.client_id
    ? store.getTable("clients").find((row) => row.id === input.client_id)
    : null;
  const subtotal = num(input.subtotal);
  const vat = num(input.vat_percent);

  const payload = {
    job_id: input.job_id,
    client_id: input.client_id,
    series: input.series.trim() || "MP",
    issued_at: input.issued_at,
    due_at: input.due_at || null,
    // Datele clientului se îngheață în factură.
    client_name: client?.name ?? null,
    client_address: client?.address ?? null,
    client_phone: client?.phone ?? null,
    subtotal,
    vat_percent: vat,
    total: Math.round(subtotal * (1 + vat / 100) * 100) / 100,
    paid_at: input.paid_at || null,
    notes: input.notes?.trim() || null,
  };

  const invoice = input.id
    ? await store.update("invoices", input.id, payload)
    : await store.insert("invoices", {
        ...payload,
        number: nextInvoiceNumber(payload.series),
      });
  kick();
  return invoice;
}

export async function setInvoicePaid(id: string, paidAt: string | null) {
  await store.update("invoices", id, { paid_at: paidAt });
  kick();
}

export async function deleteInvoice(id: string) {
  await store.remove("invoices", id);
  kick();
}

/**
 * Ofertă nouă, pornită dintr-una existentă.
 *
 * Se copiază ce se repetă — client, linii, reducere, avans, condiții. Nu se
 * copiază ce ține de exemplarul trecut: numărul, linkul public, data trimiterii
 * și acceptarea clientului. O ofertă duplicată e o ciornă, nu una trimisă.
 */
export async function duplicateQuote(id: string) {
  const source = store.getTable("quotes").find((row) => row.id === id);
  if (!source) return null;

  const items = store
    .getTable("quote_items")
    .filter((row) => row.quote_id === id && !row.deleted_at)
    .sort((a, b) => a.position - b.position);

  const copy = await store.insert("quotes", {
    number: nextQuoteNumber(),
    client_id: source.client_id,
    job_id: null,
    status: "draft" as const,
    title: `${source.title} (copie)`,
    advance: source.advance,
    discount: source.discount,
    valid_until: null,
    notes: source.notes,
    sent_at: null,
    accepted_at: null,
    public_token: null,
    accepted_by_client_at: null,
    client_signature: null,
  });
  if (!copy) return null;

  let position = 0;
  for (const item of items) {
    await store.insert("quote_items", {
      quote_id: copy.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      position: position++,
    });
  }

  kick();
  return copy;
}

/* --------------------------- arhiva lucrărilor --------------------- */

export async function archiveJob(id: string) {
  await store.update("jobs", id, { archived_at: nowISO() });
  kick();
}

export async function unarchiveJob(id: string) {
  await store.update("jobs", id, { archived_at: null });
  kick();
}

/**
 * Curățenia de fond: arhivează lucrările finalizate mai vechi de atâtea luni.
 *
 * Doar cele finalizate și doar cele plătite integral: o lucrare cu bani
 * neîncasați n-are ce căuta în arhivă, oricât de veche ar fi — tocmai aia
 * trebuie să-ți stea în ochi.
 */
export async function archiveOldJobs(months: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  const paid = new Map<string, number>();
  for (const payment of store.getTable("payments")) {
    if (payment.deleted_at || !payment.job_id) continue;
    paid.set(payment.job_id, (paid.get(payment.job_id) ?? 0) + num(payment.amount));
  }

  let archived = 0;
  for (const job of store.getTable("jobs")) {
    if (job.deleted_at || job.archived_at || job.status !== "done") continue;
    const ended = job.end_date ?? job.created_at.slice(0, 10);
    if (ended >= cutoffKey) continue;
    if (num(job.price_total) - (paid.get(job.id) ?? 0) > 0.5) continue;
    await store.update("jobs", job.id, { archived_at: nowISO() });
    archived++;
  }
  kick();
  return archived;
}

/* --------------------------- scadențar ----------------------------- */

export interface InstallmentInput {
  id?: string;
  job_id: string;
  label: string;
  amount: number;
  due_date?: string | null;
}

export async function saveInstallment(input: InstallmentInput) {
  const existing = store
    .getTable("installments")
    .filter((row) => row.job_id === input.job_id && !row.deleted_at);
  const payload = {
    job_id: input.job_id,
    label: input.label.trim() || "Tranșă",
    amount: num(input.amount),
    due_date: input.due_date || null,
  };
  const row = input.id
    ? await store.update("installments", input.id, payload)
    : await store.insert("installments", {
        ...payload,
        payment_id: null,
        position: existing.length
          ? Math.max(...existing.map((item) => item.position)) + 1
          : 0,
      });
  kick();
  return row;
}

export async function deleteInstallment(id: string) {
  await store.remove("installments", id);
  kick();
}

/**
 * Tranșa s-a încasat.
 *
 * Nu marcăm doar un steag: se scrie o plată adevărată, care intră în încasări
 * și în restul de plată, iar tranșa ține minte care plată a fost. Altfel
 * scadențarul ar spune „încasat” în timp ce Finanțele n-ar ști nimic.
 */
export async function settleInstallment(
  id: string,
  input: { method: PaymentMethod; paid_at: string },
) {
  const line = store.getTable("installments").find((row) => row.id === id);
  if (!line || line.payment_id) return null;
  const job = store.getTable("jobs").find((row) => row.id === line.job_id);

  const payment = await store.insert("payments", {
    job_id: line.job_id,
    client_id: job?.client_id ?? null,
    amount: num(line.amount),
    kind: line.position === 0 ? ("advance" as const) : ("partial" as const),
    method: input.method,
    paid_at: input.paid_at,
    note: line.label,
  });
  await store.update("installments", id, { payment_id: payment.id });
  kick();
  return payment;
}

/** Plata s-a șters sau s-a greșit: tranșa redevine neîncasată. */
export async function unsettleInstallment(id: string) {
  const line = store.getTable("installments").find((row) => row.id === id);
  if (!line?.payment_id) return;
  await store.remove("payments", line.payment_id);
  await store.update("installments", id, { payment_id: null });
  kick();
}

/**
 * Împarte prețul lucrării în trei tranșe obișnuite.
 *
 * Procentele sunt cele din practică, nu o lege: se editează după. Rotunjirea
 * merge la ultima tranșă, ca suma să dea fix prețul.
 */
export async function planInstallments(jobId: string) {
  const job = store.getTable("jobs").find((row) => row.id === jobId);
  if (!job) return 0;
  const existing = store
    .getTable("installments")
    .filter((row) => row.job_id === jobId && !row.deleted_at);
  if (existing.length) return 0;

  const price = num(job.price_total);
  const first = Math.round(price * 0.3);
  const second = Math.round(price * 0.4);
  const parts = [
    { label: "Avans la semnare", amount: first },
    { label: "La comanda materialului", amount: second },
    { label: "La predare", amount: price - first - second },
  ];

  let position = 0;
  for (const part of parts) {
    await store.insert("installments", {
      job_id: jobId,
      label: part.label,
      amount: part.amount,
      due_date: null,
      payment_id: null,
      position: position++,
    });
  }
  kick();
  return parts.length;
}

/* --------------------------- cheltuieli fixe ----------------------- */

export interface FixedCostInput {
  id?: string;
  name: string;
  amount: number;
  started_at: string;
  ended_at?: string | null;
  notes?: string | null;
}

export async function saveFixedCost(input: FixedCostInput) {
  const payload = {
    name: input.name.trim(),
    amount: num(input.amount),
    started_at: input.started_at,
    ended_at: input.ended_at || null,
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await store.update("fixed_costs", input.id, payload)
    : await store.insert("fixed_costs", payload);
  kick();
  return row;
}

/**
 * Încheierea unei cheltuieli fixe.
 *
 * Nu o ștergem: lunile în care chiar ai plătit-o trebuie să rămână cum au
 * fost, altfel profitul de anul trecut s-ar rescrie singur.
 */
export async function endFixedCost(id: string, endedAt: string) {
  await store.update("fixed_costs", id, { ended_at: endedAt });
  kick();
}

export async function deleteFixedCost(id: string) {
  await store.remove("fixed_costs", id);
  kick();
}

/* --------------------------- pașii lucrării ------------------------ */

export async function addJobTask(jobId: string, title: string) {
  const clean = title.trim();
  if (!clean) return null;
  const existing = store
    .getTable("job_tasks")
    .filter((row) => row.job_id === jobId && !row.deleted_at);
  const task = await store.insert("job_tasks", {
    job_id: jobId,
    title: clean,
    done: false,
    done_at: null,
    position: existing.length
      ? Math.max(...existing.map((row) => row.position)) + 1
      : 0,
  });
  kick();
  return task;
}

export async function toggleJobTask(id: string, done: boolean) {
  await store.update("job_tasks", id, { done, done_at: done ? nowISO() : null });
  kick();
}

export async function renameJobTask(id: string, title: string) {
  await store.update("job_tasks", id, { title: title.trim() });
  kick();
}

export async function deleteJobTask(id: string) {
  await store.remove("job_tasks", id);
  kick();
}

/**
 * Pune pașii din șablon pe lucrare.
 *
 * Pașii deja existenți rămân, iar cei cu același nume nu se adaugă a doua
 * oară: butonul poate fi apăsat de două ori fără să dubleze lista.
 */
export async function applyTaskTemplate(jobId: string, titles: string[]) {
  const existing = store
    .getTable("job_tasks")
    .filter((row) => row.job_id === jobId && !row.deleted_at);
  const known = new Set(existing.map((row) => row.title.trim().toLowerCase()));
  let position = existing.length
    ? Math.max(...existing.map((row) => row.position)) + 1
    : 0;

  let added = 0;
  for (const title of titles) {
    const clean = title.trim();
    if (!clean || known.has(clean.toLowerCase())) continue;
    known.add(clean.toLowerCase());
    await store.insert("job_tasks", {
      job_id: jobId,
      title: clean,
      done: false,
      done_at: null,
      position: position++,
    });
    added++;
  }
  kick();
  return added;
}

/* --------------------------- proces-verbal ------------------------- */

export function nextHandoverNumber(): number {
  const numbers = store
    .getTable("handovers")
    .filter((row) => !row.deleted_at)
    .map((row) => row.number || 0);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

export interface HandoverInput {
  id?: string;
  job_id: string;
  handed_at: string;
  work_summary?: string | null;
  warranty_months?: number | null;
  notes?: string | null;
}

/**
 * Procesul-verbal de predare al unei lucrări.
 *
 * Datele clientului se copiază în document, ca la factură: odată semnat, nu
 * are voie să se schimbe pentru că s-a editat fișa clientului mai târziu.
 */
export async function saveHandover(input: HandoverInput) {
  const job = store.getTable("jobs").find((row) => row.id === input.job_id);
  if (!job) return null;
  const client = job.client_id
    ? store.getTable("clients").find((row) => row.id === job.client_id)
    : null;

  const payload = {
    job_id: job.id,
    client_id: job.client_id,
    handed_at: input.handed_at,
    client_name: client?.name ?? null,
    client_address: client?.address ?? job.address ?? null,
    client_phone: client?.phone ?? null,
    work_summary: input.work_summary?.trim() || null,
    warranty_months: input.warranty_months ?? null,
    notes: input.notes?.trim() || null,
  };

  const handover = input.id
    ? await store.update("handovers", input.id, payload)
    : await store.insert("handovers", {
        ...payload,
        number: nextHandoverNumber(),
        signature: null,
        signer_name: null,
        signed_at: null,
      });
  kick();
  return handover;
}

/** Semnătura desenată de client, cu numele și ora. */
export async function signHandover(
  id: string,
  signature: string,
  signerName: string,
) {
  await store.update("handovers", id, {
    signature,
    signer_name: signerName.trim() || null,
    signed_at: nowISO(),
  });
  kick();
}

/** Ștergerea semnăturii, dacă s-a semnat din greșeală. */
export async function clearHandoverSignature(id: string) {
  await store.update("handovers", id, {
    signature: null,
    signer_name: null,
    signed_at: null,
  });
  kick();
}

export async function deleteHandover(id: string) {
  await store.remove("handovers", id);
  kick();
}

/* --------------------------- duplicare lucrare --------------------- */

/**
 * Copiază o lucrare ca punct de plecare pentru alta.
 *
 * Se copiază ce se repetă (tip, preț, materiale, măsurători), nu ce ține de
 * lucrarea trecută: date, plăți, poze, ore lucrate.
 */
/**
 * Revenirea în garanție.
 *
 * Nu e o copie a lucrării: e o lucrare nouă, mică, legată de cea veche. Începe
 * cu prețul zero, fiindcă asta înseamnă garanția; dacă se dovedește că omul a
 * stricat el podeaua, prețul se pune și devine muncă plătită. Cât te-au costat
 * revenirile se citește apoi din bani, nu dintr-un bifat.
 */
export async function createWarrantyCallback(jobId: string) {
  const source = store.getTable("jobs").find((row) => row.id === jobId);
  if (!source) return null;

  const job = await store.insert("jobs", {
    client_id: source.client_id,
    project_id: source.project_id ?? null,
    title: `Revenire — ${source.title}`,
    type: source.type,
    status: "confirmed",
    address: source.address,
    scheduled_date: null,
    scheduled_time: null,
    estimated_hours: null,
    price_total: 0,
    material_cost: null,
    start_date: null,
    end_date: null,
    notes: null,
    in_portfolio: false,
    portfolio_description: null,
    warranty_of_job_id: source.id,
    material_delivered_at: null,
  });

  kick();
  return job;
}

export async function duplicateJob(id: string) {
  const source = store.getTable("jobs").find((row) => row.id === id);
  if (!source) return null;

  const copy = await store.insert("jobs", {
    client_id: source.client_id,
    // Un apartament duplicat rămâne în aceeași scară de bloc.
    project_id: source.project_id ?? null,
    title: `${source.title} (copie)`,
    type: source.type,
    status: "quote",
    address: source.address,
    scheduled_date: null,
    scheduled_time: null,
    estimated_hours: source.estimated_hours,
    price_total: source.price_total,
    material_cost: source.material_cost,
    start_date: null,
    end_date: null,
    notes: source.notes,
    in_portfolio: false,
    portfolio_description: null,
  });

  for (const material of store
    .getTable("job_materials")
    .filter((row) => row.job_id === id && !row.deleted_at)) {
    await store.insert("job_materials", {
      job_id: copy.id,
      material_id: material.material_id,
      name: material.name,
      quantity: material.quantity,
      unit: material.unit,
      unit_price: material.unit_price,
      purchased: false,
    });
  }

  for (const measurement of store
    .getTable("job_measurements")
    .filter((row) => row.job_id === id && !row.deleted_at)) {
    await store.insert("job_measurements", {
      job_id: copy.id,
      client_id: measurement.client_id,
      kind: measurement.kind,
      label: measurement.label,
      data: measurement.data,
      notes: measurement.notes,
    });
  }

  kick();
  return copy;
}

/* ---------------------- linkuri publice ---------------------------- */

/**
 * Un token lung, imposibil de ghicit.
 *
 * Aceeași formă ca la ofertă: două identificatoare lipite, fără liniuțe. Cine
 * n-are linkul nu ajunge la date, iar ștergerea lui închide ușa la loc.
 */
function freshToken(): string {
  return `${uid()}${uid()}`.replace(/-/g, "");
}

/** Linkul prin care clientul citește și semnează procesul-verbal. */
export async function shareHandover(handoverId: string): Promise<string | null> {
  const handover = store
    .getTable("handovers")
    .find((row) => row.id === handoverId);
  if (!handover) return null;

  const token = handover.public_token || freshToken();
  if (!handover.public_token) {
    await store.update("handovers", handoverId, { public_token: token });
    kick();
  }
  return token;
}

/**
 * Pornește sau oprește un link public din setări.
 *
 * `on = false` șterge tokenul, iar linkul moare pe loc — inclusiv accesul la
 * pozele din portofoliu, care se închid la loc în aceeași clipă.
 */
export async function setPublicLink(
  which: "portfolio_token" | "calendar_token",
  on: boolean,
): Promise<string | null> {
  const settings = store.getTable("settings")[0];
  if (!settings) return null;

  const token = on ? settings[which] || freshToken() : null;
  await store.update("settings", settings.id, { [which]: token });
  kick();
  return token;
}

/* ---------------------- materialul rămas --------------------------- */

/**
 * Restul de material se întoarce în depozit.
 *
 * Din 35 de pachete cumpărate intră 33,4 în podea. Ce rămâne se pune înapoi în
 * stoc, ca data viitoare să nu cumperi din nou ce ai deja în pod.
 *
 * Cantitatea se adună la ce s-a întors deja: poți da înapoi în două rânduri,
 * dacă găsești restul mai târziu.
 */
export async function returnMaterialToStock(
  jobMaterialId: string,
  quantity: number,
): Promise<boolean> {
  const amount = num(quantity);
  if (amount <= 0) return false;

  const line = store
    .getTable("job_materials")
    .find((row) => row.id === jobMaterialId);
  if (!line || !line.material_id) return false;

  const stock = store
    .getTable("materials")
    .find((row) => row.id === line.material_id && !row.deleted_at);
  if (!stock) return false;

  await store.update("job_materials", jobMaterialId, {
    returned_quantity: num(line.returned_quantity) + amount,
  });
  await store.update("materials", stock.id, {
    quantity: num(stock.quantity) + amount,
  });
  kick();
  return true;
}

/* ---------------------- zilele blocate ----------------------------- */

/** Blochează o zi, sau o eliberează dacă era deja blocată. */
export async function toggleDayBlock(day: string, reason?: string | null) {
  const existing = store
    .getTable("day_blocks")
    .find((row) => row.day === day && !row.deleted_at);

  if (existing) {
    await store.remove("day_blocks", existing.id);
    kick();
    return null;
  }

  const row = await store.insert("day_blocks", {
    day,
    reason: reason?.trim() || null,
  });
  kick();
  return row;
}

/* ---------------------- plata ajutorului --------------------------- */

/**
 * Banii dați unui om din echipă.
 *
 * E o cheltuială ca oricare alta — nu inventăm un al doilea fel de a scoate
 * lei din buzunar —, doar că poartă numele omului, ca să știm ce s-a achitat
 * din ce s-a lucrat.
 */
export async function payCrewMember(input: {
  member_id: string;
  member_name: string;
  amount: number;
  note?: string | null;
}) {
  const amount = num(input.amount);
  if (amount <= 0) return null;

  const row = await store.insert("expenses", {
    job_id: null,
    member_id: input.member_id,
    category: "other",
    amount,
    spent_at: todayKey(),
    note: input.note?.trim() || `Plată ${input.member_name}`,
    receipt_path: null,
    receipt_local_key: null,
  });
  kick();
  return row;
}

/* --------------------------- portofoliul --------------------------- */

/**
 * Pune sau scoate lucrarea din portofoliul public.
 *
 * Bifa asta e singurul lucru care decide ce vede cineva prin linkul public:
 * funcția din bază întoarce exact lucrările cu `in_portfolio = true`. O
 * lucrare terminată rămâne în aplicație oricum — bifa spune doar dacă se
 * arată și altora.
 */
export async function setJobInPortfolio(jobId: string, on: boolean) {
  await store.update("jobs", jobId, { in_portfolio: on });
  kick();
}

/* ------------------------ lucrarea, la client ---------------------- */

/**
 * Linkul prin care clientul își vede lucrarea.
 *
 * Îi arată exact atât cât îl privește: când e programată, dacă s-a început,
 * ce pași s-au făcut, pozele. Nimic despre bani. Tokenul se face o singură
 * dată și rămâne același, ca linkul trimis azi să meargă și peste o lună.
 */
export async function shareJob(jobId: string): Promise<string | null> {
  const job = store.getTable("jobs").find((row) => row.id === jobId);
  if (!job) return null;

  const token = job.public_token || freshToken();
  if (!job.public_token) {
    await store.update("jobs", jobId, { public_token: token });
    kick();
  }
  return token;
}

/** Oprește linkul lucrării. Pozele se închid la loc în aceeași clipă. */
export async function unshareJob(jobId: string) {
  await store.update("jobs", jobId, { public_token: null });
  kick();
}

/* --------------------------- oferta expirată ----------------------- */

/**
 * Prelungește termenul unei oferte.
 *
 * Se numără de azi, nu din termenul vechi: o ofertă care a stat două luni ar
 * primi altfel un termen tot trecut. Cât timp e trimisă, linkul public
 * redevine bun în aceeași clipă — funcția din bază citește aceeași coloană.
 */
export async function extendQuote(quoteId: string, days = 14) {
  const until = extendedUntil(todayKey(), days);
  await store.update("quotes", quoteId, { valid_until: until });
  kick();
  return until;
}

/* ---------------------------- legenda pozei ------------------------ */

/**
 * Ce se vede în poză, scris lângă ea.
 *
 * „Crăpătura asta era înainte să venim noi” e rândul care te apără peste
 * șase luni, când nimeni nu-și mai amintește. Gol șterge legenda.
 */
export async function setPhotoCaption(photoId: string, caption: string) {
  await store.update("job_photos", photoId, {
    caption: caption.trim() || null,
  });
  kick();
}

/* ----------------------- înapoi la furnizor ------------------------ */

/**
 * Materialul dus înapoi la furnizor.
 *
 * Altceva decât „pune în stoc”: ăla intră pe raftul tău, ăsta pleacă de tot
 * și rămân niște bani de recuperat. Nu mișcă inventarul — n-a fost niciodată
 * al tău.
 *
 * Se adună la ce s-a întors deja, ca să poți da înapoi în două rânduri.
 */
export async function returnToSupplier(
  jobMaterialId: string,
  quantity: number,
): Promise<boolean> {
  const value = num(quantity);
  if (value <= 0) return false;

  const line = store
    .getTable("job_materials")
    .find((row) => row.id === jobMaterialId);
  if (!line) return false;

  await store.update("job_materials", jobMaterialId, {
    supplier_return_quantity: num(line.supplier_return_quantity) + value,
  });
  kick();
  return true;
}

/** Șterge ce s-a notat ca dus înapoi — furnizorul a plătit, sau a fost o greșeală. */
export async function clearSupplierReturn(jobMaterialId: string) {
  await store.update("job_materials", jobMaterialId, {
    supplier_return_quantity: 0,
  });
  kick();
}
