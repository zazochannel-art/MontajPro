/**
 * Testele linkurilor semnate către poze.
 *
 * Linkul de la Storage ține șase ore. Era ținut în memorie pentru totdeauna,
 * iar aplicația stă deschisă pe telefon zile întregi: după șase ore poza nu se
 * mai încărca și nimic n-o mai cerea din nou. Se vedea doar la pozele venite
 * de pe server — cele făcute pe telefonul ăsta au blobul lor local, care
 * n-are termen.
 *
 *   node --test tests/storage.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFRESH_MARGIN_MS,
  SIGNED_URL_SECONDS,
  expired,
} from "../src/lib/storage.ts";

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

/** Un link semnat acum, cu durata lui adevărată. */
function fresh(issuedAt = NOW) {
  return { url: "https://exemplu/poza.jpg", expiresAt: issuedAt + SIGNED_URL_SECONDS * 1000 };
}

test("blobul local n-are termen", () => {
  assert.equal(expired({ url: "blob:local", expiresAt: null }, NOW), false);
});

test("linkul proaspăt e bun", () => {
  assert.equal(expired(fresh(), NOW), false);
});

test("linkul mort se cere din nou", () => {
  const dead = fresh(NOW - SIGNED_URL_SECONDS * 1000 - 1000);
  assert.equal(expired(dead, NOW), true);
});

test("se cere unul nou înainte să moară, nu după", () => {
  // Exact în marginea de siguranță: încă valabil, dar nu merită dat mai
  // departe — poza s-ar strica la mijlocul privitului.
  const aproape = { url: "u", expiresAt: NOW + REFRESH_MARGIN_MS - 1000 };
  assert.equal(expired(aproape, NOW), true);

  const inca = { url: "u", expiresAt: NOW + REFRESH_MARGIN_MS + 1000 };
  assert.equal(expired(inca, NOW), false);
});

test("un link de acum șase ore, pe o aplicație ținută deschisă", () => {
  const dimineata = fresh(NOW);
  const seara = NOW + 7 * 60 * 60 * 1000;
  assert.equal(expired(dimineata, NOW), false, "dimineața mergea");
  assert.equal(expired(dimineata, seara), true, "seara trebuie cerut din nou");
});
