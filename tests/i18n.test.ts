/**
 * Testele traducerii.
 *
 * Cheia dicționarului e chiar textul românesc. Asta face ca româna să nu
 * poată fi stricată niciodată — dar numai dacă regula se ține. Aici verificăm
 * exact regula, nu conținutul: un dicționar crește, o promisiune nu.
 *
 *   node --test tests/i18n.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LANGUAGES,
  dictionarySize,
  isLang,
  translate,
} from "../src/lib/i18n.ts";
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from "../src/lib/constants.ts";
import { NAV_SECTIONS } from "../src/lib/nav.ts";

test("româna se întoarce neatinsă, oricare ar fi textul", () => {
  for (const text of ["Lucrări", "Un text care nu e nicăieri în dicționar"]) {
    assert.equal(translate("ro", text), text);
  }
});

test("un text fără traducere rămâne în română, nu dispare", () => {
  const odd = "Text care sigur n-are corespondent în rusă";
  assert.equal(translate("ru", odd), odd);
});

test("textele traduse chiar se schimbă", () => {
  assert.equal(translate("ru", "Lucrări"), "Работы");
  assert.equal(translate("ru", "Clienți"), "Клиенты");
  assert.notEqual(translate("ru", "Setări"), "Setări");
});

test("toate etichetele de navigație au corespondent", () => {
  for (const section of NAV_SECTIONS) {
    assert.notEqual(
      translate("ru", section.title),
      section.title,
      `secțiunea „${section.title}" n-are traducere`,
    );
    for (const item of section.items) {
      assert.notEqual(
        translate("ru", item.label),
        item.label,
        `„${item.label}" n-are traducere`,
      );
    }
  }
});

test("statusurile și tipurile de lucrare sunt traduse", () => {
  for (const label of Object.values(JOB_STATUS_LABELS)) {
    assert.notEqual(translate("ru", label), label, label);
  }
  for (const label of Object.values(JOB_TYPE_LABELS)) {
    assert.notEqual(translate("ru", label), label, label);
  }
});

test("limbile cunoscute se recunosc, restul nu", () => {
  assert.equal(isLang("ro"), true);
  assert.equal(isLang("ru"), true);
  assert.equal(isLang("en"), false);
  assert.equal(isLang(null), false);
  assert.deepEqual(
    LANGUAGES.map((item) => item.code),
    ["ro", "ru"],
  );
});

test("dicționarul nu se golește pe furiș", () => {
  assert.ok(dictionarySize() > 100);
});
