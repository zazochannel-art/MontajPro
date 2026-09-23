/**
 * Testele ofertei care devine lucrare.
 *
 *   node --test tests/quote-convert.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planFromQuote,
  sizeFromItems,
  typeFromItems,
} from "../src/lib/quote-convert.ts";
import { allPositions } from "../src/lib/price-list.ts";
import type { QuoteItem } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  created_at: "2026-09-01T08:00:00.000Z",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

const POSITIONS = allPositions({
  default_rates: {
    stair_step: 500,
    stair_riser: 200,
    landing: 800,
    railing: 3000,
    parquet_m2: 120,
    plinth_m: 60,
    hourly: 150,
    travel_km: 5,
  },
  price_list: [
    { id: "own-1", name: "Demontare parchet vechi", unit: "m²", price: 40, kind: "parquet" },
  ],
});

let counter = 0;
function item(
  description: string,
  quantity: number,
  unit_price: number,
  patch: Partial<QuoteItem> = {},
): QuoteItem {
  counter += 1;
  return {
    ...BASE,
    id: `i${counter}`,
    quote_id: "q",
    description,
    quantity,
    unit,
    unit_price,
    position: counter,
    ...patch,
  } as QuoteItem;
}
const unit = "buc";

test("tipul se citește din linia care cântărește cel mai mult", () => {
  const type = typeFromItems(
    [
      item("Montaj treaptă", 15, 500), // 7.500
      item("Montaj plintă", 20, 60), // 1.200
    ],
    POSITIONS,
  );
  assert.equal(type, "stairs");
});

test("banii decid, nu numărul de linii", () => {
  const type = typeFromItems(
    [
      item("Montaj parchet", 80, 120), // 9.600, o singură linie
      item("Montaj plintă", 10, 60), // 600
      item("Montaj plintă", 10, 60), // 600
      item("Montaj plintă", 10, 60), // 600
    ],
    POSITIONS,
  );
  assert.equal(type, "parquet");
});

test("pozițiile proprii spun și ele tipul", () => {
  const type = typeFromItems([item("Demontare parchet vechi", 50, 40)], POSITIONS);
  assert.equal(type, "parquet");
});

test("manopera la oră și deplasarea nu votează tipul", () => {
  const type = typeFromItems(
    [item("Manoperă la oră", 40, 150), item("Deplasare", 120, 5)],
    POSITIONS,
  );
  assert.equal(type, "other", "nu se știe ce fel de lucrare e, deci nu se inventează");
});

test("o linie scrisă de mână nu trage tipul nicăieri", () => {
  const type = typeFromItems([item("Ceva ce am scris eu", 1, 5000)], POSITIONS);
  assert.equal(type, "other");
});

test("orele și kilometrii vin din ofertă", () => {
  const plan = planFromQuote(
    [
      item("Montaj treaptă", 15, 500),
      item("Manoperă la oră", 12, 150),
      item("Deplasare", 84, 5),
    ],
    POSITIONS,
  );
  assert.equal(plan.type, "stairs");
  assert.equal(plan.hours, 12);
  assert.equal(plan.travelKm, 84);
});

test("aceeași poziție pe două rânduri se adună", () => {
  const plan = planFromQuote(
    [item("Deplasare", 40, 5), item("Deplasare", 44, 5)],
    POSITIONS,
  );
  assert.equal(plan.travelKm, 84);
});

test("fără linie de oră sau de drum, ies zerouri, nu ghicituri", () => {
  const plan = planFromQuote([item("Montaj treaptă", 15, 500)], POSITIONS);
  assert.equal(plan.hours, 0);
  assert.equal(plan.travelKm, 0);
});

test("linia ștearsă nu intră la socoteală", () => {
  const plan = planFromQuote(
    [
      item("Montaj treaptă", 15, 500),
      item("Deplasare", 84, 5, { deleted_at: "2026-09-02" }),
    ],
    POSITIONS,
  );
  assert.equal(plan.travelKm, 0);
});

test("oferta goală nu se preface că știe ceva", () => {
  const plan = planFromQuote([], POSITIONS);
  assert.deepEqual(plan, { type: "other", hours: 0, travelKm: 0, size: 0 });
});

test("la egalitate de bani alegerea e stabilă, nu după ordinea liniilor", () => {
  const a = typeFromItems(
    [item("Montaj treaptă", 10, 100), item("Montaj parchet", 10, 100)],
    POSITIONS,
  );
  const b = typeFromItems(
    [item("Montaj parchet", 10, 100), item("Montaj treaptă", 10, 100)],
    POSITIONS,
  );
  assert.equal(a, b);
});

/* ------------------------------------------------------------------ */
/* Mărimea lucrării, citită din liniile ofertei                        */
/* ------------------------------------------------------------------ */

/*
 * Oferta n-are măsurătoare, dar liniile ei spun deja cât e de mare lucrarea.
 * Din mărime și din ritmul tău ies orele, iar din ore și preț iese cifra care
 * contează: cât îți rămâne pe oră — înainte să trimiți prețul, nu după.
 */

test("metrii pătrați se adună din liniile de parchet", () => {
  const size = sizeFromItems(
    [item("Montaj parchet", 45, 200), item("Montaj parchet", 12, 200)],
    POSITIONS,
    "parquet",
  );
  assert.equal(size, 57);
});

test("liniile altui tip nu intră în mărime", () => {
  const size = sizeFromItems(
    [item("Montaj parchet", 45, 200), item("Montaj treaptă", 15, 500)],
    POSITIONS,
    "parquet",
  );
  assert.equal(size, 45);
});

test("orele și kilometrii nu sunt mărimea lucrării", () => {
  const size = sizeFromItems(
    [
      item("Montaj parchet", 45, 200),
      item("Manoperă la oră", 8, 150),
      item("Deplasare", 84, 5),
    ],
    POSITIONS,
    "parquet",
  );
  assert.equal(size, 45, "doar metrii pătrați");
});

test("linia ștearsă nu mai mărește lucrarea", () => {
  const size = sizeFromItems(
    [
      item("Montaj parchet", 45, 200),
      item("Montaj parchet", 30, 200, { deleted_at: "2026-09-02" }),
    ],
    POSITIONS,
    "parquet",
  );
  assert.equal(size, 45);
});

test("planul aduce mărimea odată cu tipul", () => {
  const plan = planFromQuote(
    [item("Montaj treaptă", 15, 500), item("Manoperă la oră", 6, 150)],
    POSITIONS,
  );
  assert.equal(plan.type, "stairs");
  assert.equal(plan.size, 15, "cincisprezece trepte");
  assert.equal(plan.hours, 6);
});

test("linia scrisă de mână, fără poziție, nu se numără la mărime", () => {
  const size = sizeFromItems(
    [item("Ceva pus de mână", 100, 10), item("Montaj parchet", 20, 200)],
    POSITIONS,
    "parquet",
  );
  assert.equal(size, 20);
});
