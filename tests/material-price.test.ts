/**
 * Testele istoricului de preț al materialului.
 *
 *   node --test tests/material-price.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceTrend } from "../src/lib/material-price.ts";
import type { JobMaterial } from "../src/lib/types.ts";

const BASE = {
  user_id: "u",
  updated_at: "2026-09-01T08:00:00.000Z",
  deleted_at: null,
};

let n = 0;
function line(
  day: string,
  price: number,
  patch: Partial<JobMaterial> = {},
): JobMaterial {
  n += 1;
  return {
    ...BASE,
    id: `m${n}`,
    created_at: `${day}T08:00:00.000Z`,
    job_id: `job-${n}`,
    returned_quantity: 0,
    supplier_return_quantity: 0,
    taken_quantity: null,
    material_id: "parchet",
    name: "Parchet stejar",
    quantity: 10,
    unit: "pachet",
    unit_price: price,
    purchased: true,
    taken_from_stock: false,
    ...patch,
  };
}

test("prețurile se dau de la cel mai vechi la cel mai nou", () => {
  const trend = priceTrend(
    [line("2026-06-01", 50), line("2026-01-10", 42), line("2026-09-01", 58)],
    "parchet",
  );
  assert.deepEqual(trend?.points.map((point) => point.price), [42, 50, 58]);
  assert.equal(trend?.first, 42);
  assert.equal(trend?.last, 58);
});

test("creșterea se dă în procente, cu o zecimală", () => {
  const trend = priceTrend([line("2026-01-10", 42), line("2026-09-01", 58)], "parchet");
  assert.equal(trend?.change, 38.1);
  assert.equal(trend?.direction, "sus");
});

test("scăderea se vede la fel de bine", () => {
  const trend = priceTrend([line("2026-01-10", 60), line("2026-09-01", 48)], "parchet");
  assert.equal(trend?.change, -20);
  assert.equal(trend?.direction, "jos");
});

test("sub un procent nu e o schimbare de preț, e o rotunjire de bon", () => {
  const trend = priceTrend([line("2026-01-10", 100), line("2026-09-01", 100.5)], "parchet");
  assert.equal(trend?.direction, "la_fel");
});

test("cel mai bun preț plătit se ține minte, chiar dacă nu e ultimul", () => {
  const trend = priceTrend(
    [line("2026-01-10", 42), line("2026-04-01", 38), line("2026-09-01", 58)],
    "parchet",
  );
  assert.equal(trend?.best, 38);
});

test("un singur preț nu e o tendință", () => {
  assert.equal(priceTrend([line("2026-01-10", 42)], "parchet"), null);
});

test("liniile fără preț nu intră: zero nu e un preț", () => {
  const trend = priceTrend(
    [line("2026-01-10", 42), line("2026-04-01", 0), line("2026-09-01", 58)],
    "parchet",
  );
  assert.equal(trend?.points.length, 2);
});

test("materialul scris de mână n-are cum fi același material", () => {
  const trend = priceTrend(
    [line("2026-01-10", 42, { material_id: null }), line("2026-09-01", 58, { material_id: null })],
    "parchet",
  );
  assert.equal(trend, null);
});

test("liniile altui material nu se amestecă", () => {
  const trend = priceTrend(
    [line("2026-01-10", 42), line("2026-09-01", 58, { material_id: "adeziv" })],
    "parchet",
  );
  assert.equal(trend, null, "a rămas un singur preț pe parchet");
});

test("linia ștearsă nu intră la socoteală", () => {
  const trend = priceTrend(
    [line("2026-01-10", 42), line("2026-09-01", 58, { deleted_at: "2026-09-02" })],
    "parchet",
  );
  assert.equal(trend, null);
});

test("fiecare preț știe de pe ce lucrare vine", () => {
  const trend = priceTrend(
    [line("2026-01-10", 42, { job_id: "vechi" }), line("2026-09-01", 58, { job_id: "nou" })],
    "parchet",
  );
  assert.deepEqual(trend?.points.map((point) => point.job_id), ["vechi", "nou"]);
});

/*
 * Greșeala pe care o prinde testul ăsta: punctele se așezau după zi, nu după
 * clipă. Două cumpărături din aceeași zi ieșeau la egalitate, iar ordinea lor
 * rămânea cea în care se întâmplau să vină rândurile — după o reîncărcare de
 * pagină, ordinea cheilor din baza locală, adică niște id-uri aleatoare. Așa
 * că aceleași două prețuri arătau „+25%” sau „−20%”, după noroc.
 */
test("două cumpărări în aceeași zi se așază după ceas, nu după noroc", () => {
  const dimineata = line("2026-05-04", 160, {
    id: "zz-scris-primul",
    created_at: "2026-05-04T08:00:00.000Z",
  });
  const seara = line("2026-05-04", 200, {
    id: "aa-scris-al-doilea",
    created_at: "2026-05-04T17:30:00.000Z",
  });

  // Cum vin din memorie, în ordinea scrierii; și cum vin din baza locală,
  // unde cheia e un id aleator — aici, invers.
  const dinMemorie = priceTrend([dimineata, seara], "parchet");
  const dinBaza = priceTrend([seara, dimineata], "parchet");

  assert.ok(dinMemorie && dinBaza);
  assert.deepEqual(dinBaza, dinMemorie);

  assert.equal(dinBaza.first, 160);
  assert.equal(dinBaza.last, 200);
  assert.equal(dinBaza.change, 25);
  assert.equal(dinBaza.direction, "sus");
});

test("ziua rămâne pentru scris pe ecran, chiar dacă ordinea vine din clipă", () => {
  const trend = priceTrend(
    [
      line("2026-05-04", 200, { created_at: "2026-05-04T17:30:00.000Z" }),
      line("2026-05-04", 160, { created_at: "2026-05-04T08:00:00.000Z" }),
    ],
    "parchet",
  );
  assert.ok(trend);
  // Pe ecran scrie ziua, nu ora: „+25% față de 4 mai”.
  assert.equal(trend.points[0].day, "2026-05-04");
});
