/**
 * Testele închiderii lucrării.
 *
 *   node --test tests/closing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  closingChecklist,
  closingLeft,
  openClosings,
  quoteDeviation,
} from "../src/lib/closing.ts";
import type { Handover, Job, JobPhoto, Quote, QuoteItem } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

function job(patch: Partial<Job> = {}): Job {
  return {
    ...BASE,
    id: "j1",
    client_id: null,
    project_id: null,
    title: "Montaj scară",
    type: "stairs",
    status: "in_progress",
    address: null,
    scheduled_date: null,
    scheduled_time: null,
    estimated_hours: null,
    price_total: 24000,
    material_cost: null,
    start_date: null,
    end_date: null,
    notes: null,
    archived_at: null,
    in_portfolio: false,
    portfolio_description: null,
    warranty_of_job_id: null,
    material_delivered_at: null,
    travel_km: null,
    scheduled_end_date: null,
    public_token: null,
    assigned_member_id: null,
    ...patch,
  };
}

function quote(patch: Partial<Quote> = {}): Quote {
  return {
    ...BASE,
    id: "q1",
    number: 1,
    client_id: null,
    job_id: "j1",
    status: "accepted",
    title: "Ofertă",
    advance: 0,
    discount: 0,
    valid_until: null,
    notes: null,
    sent_at: null,
    accepted_at: "2026-09-02T08:00:00.000Z",
    public_token: null,
    accepted_by_client_at: null,
    client_signature: null,
    client_signature_image: null,
    reminder_sent_at: null,
    ...patch,
  } as Quote;
}

function item(patch: Partial<QuoteItem> & { id: string }): QuoteItem {
  return {
    ...BASE,
    quote_id: "q1",
    description: "Montaj",
    quantity: 1,
    unit: "buc",
    unit_price: 0,
    position: 0,
    ...patch,
  } as QuoteItem;
}

function photo(stage: JobPhoto["stage"], patch: Partial<JobPhoto> = {}): JobPhoto {
  return {
    ...BASE,
    id: `p-${stage}`,
    job_id: "j1",
    measurement_id: null,
    stage,
    storage_path: null,
    local_key: "k",
    caption: null,
    by_member_id: null,
    by_member_name: null,
    ...patch,
  };
}

function handover(patch: Partial<Handover> = {}): Handover {
  return {
    ...BASE,
    id: "h1",
    job_id: "j1",
    client_id: null,
    number: 1,
    handed_at: "2026-09-10T08:00:00.000Z",
    client_name: null,
    client_address: null,
    client_phone: null,
    work_summary: null,
    warranty_months: 24,
    notes: null,
    signature: null,
    signer_name: null,
    signed_at: null,
    public_token: null,
    client_signature_image: null,
    signed_by_client_at: null,
    ...patch,
  };
}

/* ----------------------------- abaterea ------------------------------ */

test("prețul care s-a dus de la ofertă e semnalat", () => {
  const dev = quoteDeviation(
    job({ price_total: 27500 }),
    [quote()],
    [item({ id: "i1", quantity: 1, unit_price: 24000 })],
  );
  assert.equal(dev?.quoted, 24000);
  assert.equal(dev?.current, 27500);
  assert.equal(dev?.diff, 3500);
  assert.ok(dev!.percent > 14 && dev!.percent < 15);
});

test("reducerea de pe ofertă intră în ce s-a promis", () => {
  const dev = quoteDeviation(
    job({ price_total: 24000 }),
    [quote({ discount: 2000 })],
    [item({ id: "i1", quantity: 1, unit_price: 24000 })],
  );
  assert.equal(dev?.quoted, 22000);
  assert.equal(dev?.diff, 2000);
});

test("o diferență de câțiva lei nu merită o discuție", () => {
  const dev = quoteDeviation(
    job({ price_total: 24100 }),
    [quote()],
    [item({ id: "i1", quantity: 1, unit_price: 24000 })],
  );
  assert.equal(dev, null);
});

test("oferta doar trimisă n-a promis încă nimic", () => {
  const dev = quoteDeviation(
    job({ price_total: 30000 }),
    [quote({ status: "sent" })],
    [item({ id: "i1", quantity: 1, unit_price: 24000 })],
  );
  assert.equal(dev, null);
});

test("când sunt mai multe acceptate, contează cea mai nouă", () => {
  const dev = quoteDeviation(
    job({ price_total: 30000 }),
    [
      quote({ id: "vechi", created_at: "2026-01-01T00:00:00.000Z" }),
      quote({ id: "nou", created_at: "2026-08-01T00:00:00.000Z" }),
    ],
    [
      item({ id: "i1", quote_id: "vechi", unit_price: 10000 }),
      item({ id: "i2", quote_id: "nou", unit_price: 24000 }),
    ],
  );
  assert.equal(dev?.quoted, 24000);
});

test("prețul scăzut se semnalează la fel ca cel crescut", () => {
  const dev = quoteDeviation(
    job({ price_total: 20000 }),
    [quote()],
    [item({ id: "i1", unit_price: 24000 })],
  );
  assert.equal(dev?.diff, -4000);
  assert.ok(dev!.percent < 0);
});

/* ----------------------------- checklistul --------------------------- */

test("pe o lucrare neterminată, totul e de făcut", () => {
  const items = closingChecklist({ job: job(), photos: [], handover: null, rest: 5000 });
  assert.equal(items.length, 5);
  assert.equal(closingLeft(items), 5);
});

test("fiecare rând se citește din ce există deja, nu dintr-un bifat", () => {
  const items = closingChecklist({
    job: job({ status: "done" }),
    photos: [photo("after")],
    handover: handover({ signature: "data:image/png;base64,xxx" }),
    rest: 0,
  });
  assert.equal(closingLeft(items), 0);
});

test("semnătura pusă de client prin link se numără la fel ca cea de pe telefonul tău", () => {
  const items = closingChecklist({
    job: job(),
    photos: [],
    handover: handover({ client_signature_image: "data:image/png;base64,xxx" }),
    rest: 100,
  });
  assert.equal(items.find((i) => i.key === "signature")?.done, true);
});

test("poza „înainte” nu ține loc de poza „după”", () => {
  const items = closingChecklist({
    job: job(),
    photos: [photo("before")],
    handover: null,
    rest: 0,
  });
  assert.equal(items.find((i) => i.key === "after")?.done, false);
});

test("poza de la altă lucrare nu bifează nimic aici", () => {
  const items = closingChecklist({
    job: job(),
    photos: [photo("after", { job_id: "alta" })],
    handover: null,
    rest: 0,
  });
  assert.equal(items.find((i) => i.key === "after")?.done, false);
});

/* ------------------------------------------------------------------ */
/* Ce-a rămas neînchis, pe toate lucrările                             */
/* ------------------------------------------------------------------ */

const TODAY = "2026-09-23";

/** O plată pe o lucrare, în forma minimă cerută de `openClosings`. */
function paid(jobId: string, amount: number) {
  return { job_id: jobId, amount, deleted_at: null };
}

/** O lucrare închisă complet: poză „după”, proces-verbal semnat, bani luați. */
function closedJob(id: string) {
  return {
    job: job({ id, status: "done", price_total: 1000 }),
    photos: [photo("after", { id: `p-${id}`, job_id: id })],
    handover: handover({ id: `h-${id}`, job_id: id, signature: "data:image/png;base64,x" }),
    payment: paid(id, 1000),
  };
}

test("lucrarea închisă complet nu mai apare nicăieri", () => {
  const closed = closedJob("gata");
  const open = openClosings({
    jobs: [closed.job],
    photos: closed.photos,
    handovers: [closed.handover],
    payments: [closed.payment],
    today: TODAY,
  });
  assert.deepEqual(open, []);
});

test("lucrarea fără proces-verbal apare cu pasul care lipsește", () => {
  const open = openClosings({
    jobs: [job({ id: "j1", status: "done", price_total: 1000 })],
    photos: [photo("after")],
    handovers: [],
    payments: [paid("j1", 1000)],
    today: TODAY,
  });
  assert.equal(open.length, 1);
  const keys = open[0].items.map((item) => item.key);
  assert.deepEqual(keys, ["handover", "signature"]);
  assert.equal(open[0].rest, 0);
});

test("lucrarea neîncepută nu e o scăpare, e ordinea firească", () => {
  const open = openClosings({
    jobs: [job({ id: "j1", status: "confirmed" })],
    photos: [],
    handovers: [],
    payments: [],
    today: TODAY,
  });
  assert.deepEqual(open, []);
});

test("lucrarea începută azi nu e o scăpare, e ordinea firească", () => {
  const open = openClosings({
    jobs: [
      job({
        id: "j1",
        status: "in_progress",
        price_total: 1000,
        scheduled_date: TODAY,
      }),
    ],
    photos: [],
    handovers: [],
    payments: [],
    today: TODAY,
  });
  assert.deepEqual(open, [], "se lucrează la ea chiar acum");
});

test("lucrarea în lucru care a trecut de ziua ei chiar a rămas atârnată", () => {
  const open = openClosings({
    jobs: [
      job({
        id: "j1",
        status: "in_progress",
        price_total: 1000,
        scheduled_date: "2026-09-10",
      }),
    ],
    photos: [],
    handovers: [],
    payments: [],
    today: TODAY,
  });
  assert.equal(open.length, 1);
  assert.equal(open[0].left, 5, "toate cinci, inclusiv marcarea ca finalizată");
  assert.equal(open[0].rest, 1000);
});

test("lucrarea de mai multe zile se judecă după ultima ei zi", () => {
  const inca = job({
    id: "inca",
    status: "in_progress",
    price_total: 1000,
    scheduled_date: "2026-09-21",
    scheduled_end_date: "2026-09-25",
  });
  assert.deepEqual(
    openClosings({ jobs: [inca], photos: [], handovers: [], payments: [], today: TODAY }),
    [],
    "mai are două zile de lucru",
  );
});

test("lucrarea în lucru fără nicio zi programată nu poate fi judecată", () => {
  const open = openClosings({
    jobs: [job({ id: "j1", status: "in_progress", price_total: 1000 })],
    photos: [],
    handovers: [],
    payments: [],
    today: TODAY,
  });
  assert.deepEqual(open, [], "poate chiar acum se lucrează la ea");
});

test("arhivata s-a închis dinadins", () => {
  const open = openClosings({
    jobs: [job({ id: "j1", status: "done", archived_at: "2026-09-20T00:00:00.000Z" })],
    photos: [],
    handovers: [],
    payments: [],
    today: TODAY,
  });
  assert.deepEqual(open, []);
});

test("cele mai încurcate stau primele", () => {
  const open = openClosings({
    jobs: [
      job({ id: "aproape", status: "done", price_total: 1000 }),
      job({ id: "incurcata", status: "done", price_total: 5000 }),
    ],
    photos: [photo("after", { id: "p-aproape", job_id: "aproape" })],
    // Predată, dar nesemnată: îi lipsește un singur pas.
    handovers: [handover({ id: "h-aproape", job_id: "aproape" })],
    payments: [paid("aproape", 1000)],
    today: TODAY,
  });
  assert.equal(open.length, 2);
  assert.equal(open[0].job.id, "incurcata");
  // Patru, nu cinci: e marcată finalizată, deci pasul acela e bifat.
  assert.equal(open[0].left, 4);
  assert.equal(open[1].job.id, "aproape");
  assert.equal(open[1].left, 1);
});

test("procesul-verbal al altei lucrări nu bifează nimic aici", () => {
  const open = openClosings({
    jobs: [job({ id: "j1", status: "done", price_total: 0 })],
    photos: [photo("after")],
    handovers: [handover({ id: "h-alta", job_id: "alta-lucrare", signature: "x" })],
    payments: [],
    today: TODAY,
  });
  assert.deepEqual(
    open[0].items.map((item) => item.key),
    ["handover", "signature"],
  );
});

test("plata ștearsă lasă banii neîncasați", () => {
  const open = openClosings({
    jobs: [job({ id: "j1", status: "done", price_total: 1000 })],
    photos: [photo("after")],
    handovers: [handover({ signature: "x" })],
    payments: [{ job_id: "j1", amount: 1000, deleted_at: "2026-09-21T00:00:00.000Z" }],
    today: TODAY,
  });
  assert.equal(open[0].rest, 1000);
  assert.deepEqual(
    open[0].items.map((item) => item.key),
    ["money"],
  );
});
