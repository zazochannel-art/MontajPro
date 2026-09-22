/**
 * Testele socotelii ofertelor.
 *
 *   node --test tests/quote-stats.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isRejectReason, quoteStats } from "../src/lib/quote-stats.ts";
import type { Quote, QuoteItem, QuoteStatus } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

let n = 0;
function quote(
  status: QuoteStatus,
  patch: Partial<Quote> = {},
): Quote {
  n += 1;
  return {
    ...BASE,
    id: `q${n}`,
    number: n,
    client_id: null,
    job_id: null,
    status,
    title: `Oferta ${n}`,
    advance: 0,
    discount: 0,
    valid_until: null,
    notes: null,
    sent_at: "2026-09-05T08:00:00.000Z",
    accepted_at: null,
    public_token: null,
    accepted_by_client_at: null,
    client_signature: null,
    client_signature_image: null,
    viewed_at: null,
    last_viewed_at: null,
    view_count: 0,
    reminder_sent_at: null,
    rejected_reason: null,
    ...patch,
  };
}

let m = 0;
function line(quoteId: string, quantity: number, price: number): QuoteItem {
  m += 1;
  return {
    ...BASE,
    id: `li${m}`,
    quote_id: quoteId,
    description: "Linie",
    quantity,
    unit: "buc",
    unit_price: price,
    position: m,
  };
}

test("ciornele nu se numără nicăieri", () => {
  const draft = quote("draft");
  const stats = quoteStats([draft], [line(draft.id, 1, 5000)]);
  assert.equal(stats.decided, 0);
  assert.equal(stats.winRate, null);
});

test("rata se face din ofertele care au primit un răspuns", () => {
  const a = quote("accepted");
  const b = quote("rejected");
  const c = quote("sent");
  const stats = quoteStats([a, b, c], []);
  assert.equal(stats.accepted, 1);
  assert.equal(stats.rejected, 1);
  assert.equal(stats.sent, 1);
  assert.equal(stats.winRate, 50, "cea trimisă încă n-a pierdut nimic");
});

test("banii câștigați și cei pierduți se socotesc din linii", () => {
  const won = quote("accepted");
  const lost = quote("rejected");
  const stats = quoteStats(
    [won, lost],
    [line(won.id, 15, 500), line(lost.id, 80, 120)],
  );
  assert.equal(stats.wonValue, 7500);
  assert.equal(stats.lostValue, 9600);
});

test("reducerea se scade din valoarea ofertei", () => {
  const won = quote("accepted", { discount: 500 });
  const stats = quoteStats([won], [line(won.id, 15, 500)]);
  assert.equal(stats.wonValue, 7000);
});

test("reducerea mai mare decât oferta nu dă bani negativi", () => {
  const won = quote("accepted", { discount: 9000 });
  const stats = quoteStats([won], [line(won.id, 1, 100)]);
  assert.equal(stats.wonValue, 0);
});

test("motivele se numără, cele mai multe întâi", () => {
  const stats = quoteStats(
    [
      quote("rejected", { rejected_reason: "price" }),
      quote("rejected", { rejected_reason: "price" }),
      quote("rejected", { rejected_reason: "timing" }),
    ],
    [],
  );
  assert.equal(stats.reasons[0].reason, "price");
  assert.equal(stats.reasons[0].quotes, 2);
  assert.equal(stats.reasons[1].reason, "timing");
});

test("refuzul fără motiv scris se numără separat, nu dispare", () => {
  const stats = quoteStats([quote("rejected")], []);
  assert.equal(stats.reasons.length, 1);
  assert.equal(stats.reasons[0].reason, null);
  assert.equal(stats.reasons[0].quotes, 1);
});

test("un motiv necunoscut se citește ca lipsă, nu strică socoteala", () => {
  const stats = quoteStats([quote("rejected", { rejected_reason: "vrăjeală" })], []);
  assert.equal(stats.reasons[0].reason, null);
  assert.equal(isRejectReason("vrăjeală"), false);
  assert.equal(isRejectReason("price"), true);
});

test("perioada taie după data trimiterii", () => {
  const vechi = quote("accepted", { sent_at: "2026-07-02T08:00:00.000Z" });
  const nou = quote("accepted", { sent_at: "2026-09-12T08:00:00.000Z" });
  const stats = quoteStats([vechi, nou], [], { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(stats.accepted, 1);
});

test("oferta netrimisă se judecă după data creării", () => {
  const fara = quote("rejected", {
    sent_at: null,
    created_at: "2026-09-10T08:00:00.000Z",
  });
  const stats = quoteStats([fara], [], { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(stats.rejected, 1);
});

test("oferta ștearsă nu intră la socoteală", () => {
  const stats = quoteStats([quote("accepted", { deleted_at: "2026-09-06" })], []);
  assert.equal(stats.decided, 0);
});

test("fără niciun răspuns, rata lipsește în loc să fie zero", () => {
  const stats = quoteStats([quote("sent")], []);
  assert.equal(stats.winRate, null, "zero ar însemna că le-ai pierdut, nu că aștepți");
});
