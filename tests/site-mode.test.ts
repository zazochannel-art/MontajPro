/**
 * Testele modului șantier.
 *
 * Ce dispare din navigație e o promisiune făcută omului care ține telefonul
 * lângă client. Dacă o pagină de bani rămâne la vedere, promisiunea e ruptă
 * fix în momentul în care conta.
 *
 *   node --test tests/site-mode.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOTTOM_NAV,
  NAV_SECTIONS,
  visibleBottomNav,
  visibleSections,
} from "../src/lib/nav.ts";

const MONEY = ["/finante", "/rapoarte", "/facturi"];

function hrefs(sections: { items: { href: string }[] }[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.href));
}

test("în mod normal nu se ascunde nimic", () => {
  assert.deepEqual(visibleSections(false), NAV_SECTIONS);
  assert.deepEqual(visibleBottomNav(false), BOTTOM_NAV);
});

test("pe șantier dispar paginile cu bani", () => {
  const visible = hrefs(visibleSections(true));
  for (const page of MONEY) assert.ok(!visible.includes(page), page);
  // Restul rămâne întreg: lucrări, calendar, măsurători, poze.
  assert.ok(visible.includes("/lucrari"));
  assert.ok(visible.includes("/masuratori"));
  assert.ok(visible.includes("/setari"));
});

test("nicio secțiune nu rămâne un titlu gol", () => {
  for (const section of visibleSections(true)) {
    assert.ok(section.items.length > 0, section.title);
  }
});

test("locul „Banilor” din bara de jos îl ia măsurătoarea", () => {
  const bar = visibleBottomNav(true);
  assert.equal(bar.length, BOTTOM_NAV.length);
  assert.ok(!bar.some((item) => MONEY.includes(item.href)));
  assert.ok(bar.some((item) => item.href === "/masuratori"));
});
