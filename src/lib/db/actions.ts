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
import type {
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
}) {
  const payload = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  const row = input.id
    ? await store.update("clients", input.id, payload)
    : await store.insert("clients", payload);
  kick();
  return row;
}

export async function deleteClient(id: string) {
  // Lucrările rămân, dar pierd legătura — istoricul financiar nu se pierde.
  const jobs = store.getTable("jobs").filter((job) => job.client_id === id);
  for (const job of jobs)
    await store.update("jobs", job.id, { client_id: null });
  await store.remove("clients", id);
  kick();
}

/* -------------------------------- lucrări -------------------------- */

export interface JobInput {
  id?: string;
  client_id: string | null;
  title: string;
  type: JobType;
  status: JobStatus;
  address?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  estimated_hours?: number | null;
  price_total: number;
  material_cost?: number | null;
  notes?: string | null;
  /** Avansul introdus la creare devine o plată de tip „avans”. */
  advance?: number;
}

export async function saveJob(input: JobInput) {
  const payload = {
    client_id: input.client_id,
    title: input.title.trim(),
    type: input.type,
    status: input.status,
    address: input.address?.trim() || null,
    scheduled_date: input.scheduled_date || null,
    scheduled_time: input.scheduled_time || null,
    estimated_hours: input.estimated_hours ?? null,
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
}) {
  const payload = {
    name: input.name.trim(),
    category: input.category || null,
    quantity: num(input.quantity),
    unit: input.unit,
    price: num(input.price),
    supplier: input.supplier?.trim() || null,
    notes: input.notes?.trim() || null,
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

export async function setQuoteStatus(id: string, status: Quote["status"]) {
  const patch: Partial<Quote> = { status };
  if (status === "sent") patch.sent_at = nowISO();
  if (status === "accepted") patch.accepted_at = nowISO();
  await store.update("quotes", id, patch);
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

/** Transformă o ofertă acceptată în lucrare (cu avansul deja înregistrat). */
export async function convertQuoteToJob(
  quoteId: string,
  type: JobType = "other",
) {
  const quote = store.getTable("quotes").find((row) => row.id === quoteId);
  if (!quote) return null;
  const items = store
    .getTable("quote_items")
    .filter((item) => item.quote_id === quoteId);
  const { total } = quoteTotal(items, quote.discount);

  // Avansul din ofertă este o cerere, nu bani încasați: nu creăm o plată
  // pentru el. Se înregistrează când ajunge efectiv la montator.
  const job = await saveJob({
    client_id: quote.client_id,
    title: quote.title,
    type,
    status: "confirmed",
    price_total: total,
    notes: items
      .map(
        (item) =>
          `${item.description}: ${item.quantity} ${item.unit} × ${item.unit_price}`,
      )
      .join("\n"),
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
    app: "MontajPro",
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
export async function duplicateJob(id: string) {
  const source = store.getTable("jobs").find((row) => row.id === id);
  if (!source) return null;

  const copy = await store.insert("jobs", {
    client_id: source.client_id,
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
