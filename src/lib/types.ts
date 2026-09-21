/**
 * Modelul de date al aplicației.
 *
 * Tipurile de aici oglindesc 1:1 tabelele din Supabase (vezi
 * `supabase/migrations`). Toate rândurile au `id`, `user_id`, `created_at` și
 * `updated_at` pentru ca sincronizarea local-first să poată face merge
 * determinist (last-write-wins pe `updated_at`).
 */

export type ID = string;

export interface BaseRow {
  id: ID;
  user_id: ID;
  created_at: string;
  updated_at: string;
  /** Marcaj de ștergere logică — necesar pentru sincronizare. */
  deleted_at?: string | null;
  /** Pus de server la fiecare scriere; este cursorul de sincronizare. */
  synced_at?: string;
}

/* ------------------------------------------------------------------ */
/* Enumerări                                                           */
/* ------------------------------------------------------------------ */

export const JOB_TYPES = ["stairs", "parquet", "plinth", "other"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  "quote",
  "confirmed",
  "materials",
  "in_progress",
  "done",
  "issue",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const PAYMENT_KINDS = ["advance", "partial", "final"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const EXPENSE_CATEGORIES = [
  "materials",
  "fuel",
  "tools",
  "transport",
  "parking",
  "car",
  "consumables",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PHOTO_STAGES = ["before", "during", "after"] as const;
export type PhotoStage = (typeof PHOTO_STAGES)[number];

export const NOTIFICATION_KINDS = [
  "job_tomorrow",
  "job_today",
  "payment_due",
  "tool_warranty",
  "materials_missing",
  "quote_pending",
  "installment_due",
  "follow_up",
  "job_warranty",
  "quote_viewed",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/* ------------------------------------------------------------------ */
/* Tabele                                                              */
/* ------------------------------------------------------------------ */

export interface Client extends BaseRow {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface Job extends BaseRow {
  client_id: ID | null;
  /** Proiectul din care face parte; gol pentru o lucrare de sine stătătoare. */
  project_id: ID | null;
  title: string;
  type: JobType;
  status: JobStatus;
  address: string | null;
  /** ISO date (YYYY-MM-DD) — ziua programată. */
  scheduled_date: string | null;
  /** HH:mm */
  scheduled_time: string | null;
  estimated_hours: number | null;
  price_total: number;
  /** Cost estimat al materialelor introdus manual (opțional). */
  material_cost: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  /**
   * Scoasă din vederile de zi cu zi.
   *
   * Nu e o ștergere: lucrarea rămâne în rapoarte și în căutare, fiindcă
   * istoria banilor n-are voie să dispară. Doar nu-ți mai stă în listă.
   */
  archived_at: string | null;
  /** Vizibil în portofoliu (doar lucrări finalizate). */
  in_portfolio: boolean;
  portfolio_description: string | null;
}

/** Valorile măsurătorilor, în funcție de tip. Stocate ca JSON. */
export interface StairsMeasurement {
  steps?: number;
  width?: number;
  length?: number;
  height?: number;
  depth?: number;
  thickness?: number;
  landings?: number;
  angle?: number;
  radius?: number;
}

export interface ParquetMeasurement {
  area?: number;
  parquet_type?: string;
  waste_percent?: number;
  rooms?: number;
}

export interface PlinthMeasurement {
  linear_meters?: number;
  plinth_type?: string;
  corners_outer?: number;
  corners_inner?: number;
  profiles?: number;
  joints?: number;
  piece_length?: number;
}

export interface OtherMeasurement {
  quantity?: number;
  unit?: string;
  label?: string;
}

export type MeasurementData =
  | StairsMeasurement
  | ParquetMeasurement
  | PlinthMeasurement
  | OtherMeasurement;

export interface JobMeasurement extends BaseRow {
  job_id: ID | null;
  /** Măsurătorile rapide pot exista fără lucrare — atunci reținem clientul. */
  client_id: ID | null;
  kind: JobType;
  label: string | null;
  data: MeasurementData;
  notes: string | null;
}

export interface JobPhoto extends BaseRow {
  job_id: ID | null;
  measurement_id: ID | null;
  stage: PhotoStage;
  /** Cale în Supabase Storage (bucket `job-photos`). */
  storage_path: string | null;
  /** Fallback local: cheia blobului din IndexedDB când nu există rețea. */
  local_key: string | null;
  caption: string | null;
  /** Ajutorul care a trimis poza; gol dacă ai pus-o tu. */
  by_member_id: ID | null;
  by_member_name: string | null;
}

export interface JobMaterial extends BaseRow {
  job_id: ID;
  material_id: ID | null;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  /** Cumpărat de la furnizor. */
  purchased: boolean;
  /**
   * Scos din depozit pentru lucrarea asta.
   *
   * Separat de `purchased`: una e să cumperi, alta e să iei din ce ai. Doar
   * asta mișcă stocul, și doar o dată — steagul e acolo ca a doua apăsare să
   * nu scadă încă o dată.
   */
  taken_from_stock: boolean;
}

export interface Material extends BaseRow {
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  price: number;
  supplier: string | null;
  notes: string | null;
}

export interface Payment extends BaseRow {
  job_id: ID | null;
  client_id: ID | null;
  amount: number;
  kind: PaymentKind;
  method: PaymentMethod;
  paid_at: string;
  note: string | null;
}

export interface Expense extends BaseRow {
  job_id: ID | null;
  category: ExpenseCategory;
  amount: number;
  spent_at: string;
  note: string | null;
  receipt_path: string | null;
  receipt_local_key: string | null;
}

export interface Quote extends BaseRow {
  number: number;
  client_id: ID | null;
  job_id: ID | null;
  status: QuoteStatus;
  title: string;
  advance: number;
  discount: number;
  valid_until: string | null;
  notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  /** Cheia linkului trimis clientului; gol până la prima partajare. */
  public_token: string | null;
  accepted_by_client_at: string | null;
  /** Numele scris de client la acceptare. */
  client_signature: string | null;
  /**
   * Prima dată când cineva a deschis linkul public.
   *
   * Se scrie doar pe server, din pagina publică. De aceea cele trei coloane
   * lipsesc din lista de trimitere (`TABLE_COLUMNS`): se trag la
   * sincronizare, dar nu se împing niciodată înapoi, ca o copie locală veche
   * să nu șteargă o vizită pe care telefonul n-a văzut-o încă.
   */
  viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
}

export interface Invoice extends BaseRow {
  job_id: ID | null;
  client_id: ID | null;
  series: string;
  number: number;
  issued_at: string;
  due_at: string | null;
  /** Datele clientului sunt copiate: factura nu se schimbă retroactiv. */
  client_name: string | null;
  client_address: string | null;
  client_phone: string | null;
  subtotal: number;
  vat_percent: number;
  total: number;
  paid_at: string | null;
  notes: string | null;
}

/**
 * O tranșă planificată din prețul lucrării.
 *
 * Până acum erau doar „avans” și „rest”. În realitate banii vin în trei
 * momente — la semnare, la comanda materialului, la predare — iar dacă nu sunt
 * scrise undeva, îți amintești tu de ele. Scadențarul le ține minte și te
 * anunță.
 *
 * `payment_id` leagă tranșa de încasarea reală: planul rămâne plan, banii
 * rămân bani, iar legătura spune care plan s-a împlinit.
 */
export interface Installment extends BaseRow {
  job_id: ID;
  label: string;
  amount: number;
  due_date: string | null;
  payment_id: ID | null;
  position: number;
}

/**
 * Cheltuiala care vine în fiecare lună, indiferent de lucrări.
 *
 * Chiria la depozit, leasingul, telefonul, asigurarea. Până acum n-aveau unde
 * să fie puse decât ca o cheltuială pe o lucrare — ceea ce e fals — așa că
 * profitul lunar ieșea mai mare decât adevărul cu exact suma lor.
 *
 * Nu se șterg când te lași de ele: le pui o dată de încheiere, ca lunile
 * trecute să rămână cum au fost.
 */
export interface FixedCost extends BaseRow {
  name: string;
  amount: number;
  /** Prima lună în care se plătește (ISO date). */
  started_at: string;
  /** Ultima lună în care s-a plătit; gol cât timp curge. */
  ended_at: string | null;
  notes: string | null;
}

/**
 * Un pas din lista de pe șantier.
 *
 * Pașii se repetă de la o lucrare la alta, de-asta pornesc dintr-un șablon pe
 * tip de lucrare, păstrat în setări. Odată puși pe lucrare, sunt ai ei: un
 * șablon schimbat mai târziu nu rescrie lucrările deja pornite.
 */
export interface JobTask extends BaseRow {
  job_id: ID;
  title: string;
  done: boolean;
  done_at: string | null;
  position: number;
}

/**
 * Procesul-verbal de predare.
 *
 * Oferta se acceptă la început; asta încheie lucrarea. Datele clientului se
 * copiază, ca la factură: un document semnat nu se schimbă pentru că cineva a
 * editat fișa clientului peste șase luni. Semnătura se ține ca imagine PNG în
 * chiar rândul acesta — câțiva kilobytes, care se sincronizează odată cu el și
 * nu depind de Storage.
 */
export interface Handover extends BaseRow {
  job_id: ID;
  client_id: ID | null;
  number: number;
  handed_at: string;
  client_name: string | null;
  client_address: string | null;
  client_phone: string | null;
  /** Ce s-a executat, copiat din lucrare și editabil. */
  work_summary: string | null;
  warranty_months: number | null;
  notes: string | null;
  /** PNG ca data URL, desenat cu degetul. */
  signature: string | null;
  signer_name: string | null;
  signed_at: string | null;
}

export interface QuoteItem extends BaseRow {
  quote_id: ID;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  position: number;
}

export interface Tool extends BaseRow {
  name: string;
  brand: string | null;
  model: string | null;
  price: number | null;
  purchased_at: string | null;
  warranty_months: number | null;
  notes: string | null;
  photo_path: string | null;
  photo_local_key: string | null;
}

export interface WorkSession extends BaseRow {
  job_id: ID;
  started_at: string;
  ended_at: string | null;
  /** Calculat la oprire, în minute. */
  duration_minutes: number | null;
  note: string | null;
  /** Ajutorul care a pornit cronometrul; gol dacă ai lucrat tu. */
  by_member_id: ID | null;
  by_member_name: string | null;
}

export interface AppNotification extends BaseRow {
  kind: NotificationKind;
  title: string;
  body: string | null;
  job_id: ID | null;
  due_date: string | null;
  read_at: string | null;
}

export interface DefaultRates {
  stair_step: number;
  stair_riser: number;
  landing: number;
  railing: number;
  parquet_m2: number;
  plinth_m: number;
  hourly: number;
  /**
   * Tarif pe kilometru.
   *
   * Drumul până în sat și înapoi e muncă plătită, nu un cadou. Până acum
   * „transport" exista doar ca o categorie de cheltuială — adică o plăteai
   * din buzunarul tău.
   */
  travel_km: number;
}

/**
 * O poziție proprie din lista de prețuri.
 *
 * Tarifele implicite (`DefaultRates`) acoperă lucrările obișnuite; aici intră
 * ce mai face fiecare montator — demontare, transport, pregătit stratul suport.
 * Sunt ale utilizatorului, deci se sincronizează odată cu restul setărilor.
 */
export interface PriceItem {
  id: string;
  name: string;
  /** `buc`, `m`, `m²`, `oră`… — se pune automat pe linia din calculator. */
  unit: string;
  price: number;
  /** Tipul de lucrare la care apare prima în listă; `any` apare peste tot. */
  kind: JobType | "any";
}

export interface NotificationPrefs {
  job_tomorrow: boolean;
  job_today: boolean;
  payment_due: boolean;
  tool_warranty: boolean;
  materials_missing: boolean;
  quote_pending: boolean;
  /** Tranșă de încasat, scadentă. */
  installment_due: boolean;
  /** Sună clientul la câteva luni după montaj. */
  follow_up: boolean;
  quote_viewed: boolean;
  /** Garanția lucrării stă să expire. */
  job_warranty: boolean;
}

export interface Settings extends BaseRow {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  logo_path: string | null;
  logo_local_key: string | null;
  currency: string;
  /** `metric` (m, m²) sau `imperial` (ft, ft²). */
  units: "metric" | "imperial";
  default_rates: DefaultRates;
  /** Poziții proprii, peste cele implicite. */
  price_list: PriceItem[];
  /** Pașii cu care pornește o lucrare nouă, pe tip. */
  task_templates: Partial<Record<JobType, string[]>>;
  expense_categories: string[];
  material_categories: string[];
  notification_prefs: NotificationPrefs;
  vat_percent: number;
  quote_terms: string | null;
  /** Scrie data peste pozele făcute din aplicație. */
  photo_stamp: boolean;
}

/**
 * Un proiect: mai multe lucrări sub același acoperiș.
 *
 * O scară de bloc înseamnă zece apartamente. Fiecare rămâne o lucrare
 * întreagă, cu banii, pozele și scadențarul ei; proiectul doar le leagă, ca
 * întrebarea „cât am încasat din toată scara?" să aibă un răspuns.
 */
export interface Project extends BaseRow {
  name: string;
  client_id: ID | null;
  address: string | null;
  notes: string | null;
}

/* ------------------------------------------------------------------ */
/* Registrul tabelelor sincronizate                                    */
/* ------------------------------------------------------------------ */

export interface Tables {
  clients: Client;
  projects: Project;
  jobs: Job;
  job_measurements: JobMeasurement;
  job_photos: JobPhoto;
  job_materials: JobMaterial;
  materials: Material;
  payments: Payment;
  expenses: Expense;
  quotes: Quote;
  quote_items: QuoteItem;
  invoices: Invoice;
  handovers: Handover;
  job_tasks: JobTask;
  fixed_costs: FixedCost;
  installments: Installment;
  tools: Tool;
  work_sessions: WorkSession;
  notifications: AppNotification;
  settings: Settings;
}

export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  "clients",
  "projects",
  "jobs",
  "job_measurements",
  "job_photos",
  "job_materials",
  "materials",
  "payments",
  "expenses",
  "quotes",
  "quote_items",
  "invoices",
  "handovers",
  "job_tasks",
  "fixed_costs",
  "installments",
  "tools",
  "work_sessions",
  "notifications",
  "settings",
];

/** Câmpurile pe care le completează stratul de date, nu apelantul. */
export type NewRow<T extends BaseRow> = Omit<
  T,
  "id" | "user_id" | "created_at" | "updated_at" | "deleted_at"
> &
  Partial<Pick<T, "id">>;
