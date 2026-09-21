/**
 * Test de fum pentru MontajPro.
 *
 * Pornește un browser mobil (viewport de iPhone), parcurge fluxul real —
 * client nou, lucrare nouă, cronometru, plată, măsurătoare, ofertă — și verifică
 * ce vede utilizatorul. Rulează pe build-ul de producție.
 *
 *   node tests/smoke.mjs            # presupune serverul pe :3100
 *   BASE_URL=http://localhost:3000 node tests/smoke.mjs
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

let passed = 0;
const failures = [];
const consoleErrors = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// Mediile CI/agent au un Chromium preinstalat care poate să nu corespundă
// versiunii din node_modules; CHROMIUM_PATH îl indică explicit.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({
  ...devices["iPhone 13"],
  locale: "ro-RO",
});
const page = await context.newPage();

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

try {
  /* ----------------------------- pornire --------------------------- */
  section("Pornire și mod local");

  // Ecranul de autentificare trebuie să existe și să ofere modul local.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check(
    "ecranul de autentificare oferă modul local",
    await page.getByRole("button", { name: /Continuă în mod local/i }).isVisible(),
  );
  await page.getByRole("button", { name: /Continuă în mod local/i }).click();

  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  await page.getByRole("heading", { name: /Salut/i }).waitFor({ timeout: 15000 });
  check("dashboard-ul se încarcă", true);
  check(
    "bara de jos are butonul Adaugă",
    await page.getByRole("button", { name: "Adaugă", exact: true }).first().isVisible(),
  );

  /* ----------------------------- client ---------------------------- */
  section("Client nou");
  await page.goto(`${BASE}/clienti`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Client nou/i }).first().click();
  await page.getByPlaceholder("Ion Popescu").fill("Ion Popescu (test)");
  await page.getByPlaceholder("+373 69 123 456").fill("+37369123456");
  await page.getByPlaceholder("str. Ismail 45, Chișinău").fill("str. Ismail 45, Chișinău");
  await page.getByRole("button", { name: /Adaugă client/i }).click();
  await page.getByText("Ion Popescu (test)").first().waitFor({ timeout: 10000 });
  check("clientul apare în listă", true);

  /* ----------------------------- lucrare --------------------------- */
  section("Lucrare nouă");
  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").fill("Montaj scară stejar (test)");

  // Client din select (Radix).
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /Ion Popescu \(test\)/ }).click();

  await page.locator("#job-price").fill("12000");
  await page.locator("#job-advance").fill("5000");
  await page.getByRole("button", { name: /Creează lucrarea/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });
  const jobUrl = page.url();
  check("lucrarea s-a creat și s-a deschis", true);
  check(
    "prețul apare pe pagina lucrării",
    (await page.getByText(/12\.000 MDL/).count()) > 0,
  );
  check(
    "avansul introdus devine plată și scade restul",
    (await page.getByText(/rest 7\.000 MDL/).count()) > 0,
  );

  /* ----------------------------- cronometru ------------------------ */
  section("Start / stop lucrare");
  await page.getByRole("button", { name: /START LUCRARE/i }).click();
  await page.getByRole("button", { name: /FINALIZEAZ/i }).waitFor({ timeout: 10000 });
  check("cronometrul pornește", true);
  await page.getByRole("button", { name: /FINALIZEAZ/i }).click();
  await page.getByRole("button", { name: /START LUCRARE/i }).waitFor({ timeout: 10000 });
  check("cronometrul se oprește și salvează durata", true);

  /* ----------------------------- măsurători ------------------------ */
  section("Măsurători cu calcule automate");
  await page.goto(`${jobUrl}?tab=masuratori`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Măsurători/i }).click();
  await page.getByRole("button", { name: /Adaugă măsurătoare/i }).first().click();
  await page.locator("#m-steps").fill("15");
  await page.locator("#m-width").fill("100");
  await page.locator("#m-depth").fill("30");
  await page.locator("#m-height").fill("18");
  check(
    "suprafața treptelor se calculează automat",
    await page.getByText("Suprafață trepte").isVisible(),
  );
  check(
    "unghiul se calculează automat",
    await page.getByText("Unghi calculat").isVisible(),
  );
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText(/15 trepte|Suprafață trepte/).first().waitFor({ timeout: 10000 });
  check("măsurătoarea s-a salvat", true);

  /* ----------------------------- materiale ------------------------- */
  section("Materiale pe lucrare");
  await page.getByRole("tab", { name: /Materiale/i }).click();
  await page.getByRole("button", { name: /Adaugă material/i }).first().click();
  await page.getByPlaceholder("Adeziv parchet").fill("Lac poliuretanic");
  const materialNumbers = page.locator('input[inputmode="decimal"]');
  await materialNumbers.nth(0).fill("3");
  await materialNumbers.nth(1).fill("450");
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText("Lac poliuretanic").first().waitFor({ timeout: 10000 });
  check("materialul apare pe lucrare", true);
  check(
    "totalul materialelor se calculează",
    (await page.getByText(/1\.350 MDL/).count()) > 0,
  );

  /* ----------------------------- finanțe --------------------------- */
  section("Finanțe pe lucrare");
  await page.getByRole("tab", { name: /Finanțe/i }).click();
  await page.getByRole("button", { name: /Plată/i }).first().click();
  await page.locator("#payment-amount").fill("3000");
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText(/3\.000 MDL/).first().waitFor({ timeout: 10000 });
  check("plata s-a înregistrat", true);
  check(
    "restul de plată se recalculează (12.000 − 5.000 − 3.000)",
    (await page.getByText(/4\.000 MDL/).count()) > 0,
  );

  /* ----------------------------- pașii lucrării --------------------- */
  section("Pașii lucrării");
  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByText("Montaj scară stejar (test)").first().click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });
  await page.getByRole("button", { name: /Pune pașii pentru/i }).click();
  await page.getByText(/pași adăugați/i).waitFor({ timeout: 10000 });
  // exact: altfel prinde și butonul „Șterge Montat trepte”.
  const firstTask = page.getByLabel("Montat trepte", { exact: true });
  await firstTask.waitFor({ timeout: 10000 });
  check("șablonul pune pașii pe lucrare", true);
  await firstTask.click();
  await page.getByText(/^1 din/).waitFor({ timeout: 10000 });
  check("pasul bifat se numără", true);

  /* --------------------------- scadențar și fixe -------------------- */
  section("Scadențar și cheltuieli fixe");
  await page.getByRole("tab", { name: /Finanțe/i }).click();
  await page.getByRole("button", { name: /Împarte în 30/i }).click();
  await page.getByText("Avans la semnare").waitFor({ timeout: 10000 });
  check("scadențarul se împarte din preț", true);
  // 12.000 × 30% = 3.600 pe prima tranșă.
  check(
    "prima tranșă e 30% din preț",
    (await page.getByText(/3\.600 MDL/).count()) > 0,
  );

  await page.goto(`${BASE}/finante`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /^Fixe$/ }).click();
  await page.locator("#fixed-name").fill("Chirie depozit (test)");
  await page.locator("#fixed-amount").fill("1000");
  await page.getByRole("button", { name: /Adaugă cheltuiala fixă/i }).click();
  await page.getByText("Chirie depozit (test)").waitFor({ timeout: 10000 });
  check(
    "cheltuiala fixă se scade din luna curentă",
    (await page.getByText(/−1\.000 MDL/).count()) > 0,
  );

  /* ----------------------------- calculator ------------------------ */
  section("Calculator preț: poziția aduce prețul din setări");

  // Prețul are o singură sursă — tarifele din setări. Le punem acolo…
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  const stepRate = page.getByLabel("Montaj treaptă");
  await stepRate.waitFor({ timeout: 10000 });
  await stepRate.fill("500");
  await page.getByLabel("Manoperă la oră").fill("200");

  // …și ne asigurăm că s-au scris, reîncărcând pagina.
  await page.reload({ waitUntil: "networkidle" });
  const savedRate = page.getByLabel("Montaj treaptă");
  await savedRate.waitFor({ timeout: 10000 });
  check("tariful se salvează în setări", (await savedRate.inputValue()).includes("500"));

  // În calculator nu mai scriem niciun preț: linia pornește cu cel din setări.
  await page.goto(`${BASE}/calculator`, { waitUntil: "networkidle" });
  await page.getByRole("combobox").first().waitFor({ timeout: 10000 });
  const calcInputs = page.locator('input[inputmode="decimal"]');
  await calcInputs.nth(0).fill("15"); // trepte
  check(
    "prețul vine automat din setări (15 × 500)",
    (await page.getByText(/7\.500 MDL/).count()) > 0,
  );

  // Poziție aleasă pe o linie nouă: aduce și unitatea, și prețul.
  await page.getByRole("button", { name: /Adaugă serviciu/i }).click();
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: /Manoperă la oră/ }).click();
  check(
    "poziția aleasă aduce prețul cu ea (7.500 + 200)",
    (await page.getByText(/7\.700 MDL/).count()) > 0,
  );
  check(
    "poziția aleasă aduce și unitatea",
    (await page.getByText(/1 oră × 200 MDL/).count()) > 0,
  );

  /* ----------------------------- ofertă ---------------------------- */
  section("Ofertă");
  await page.goto(`${BASE}/oferte/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").fill("Ofertă montaj scară (test)");
  // Ca în calculator: alegem poziția, nu scriem niciun preț.
  await page.getByRole("combobox", { name: "Poziție" }).first().click();
  await page.getByRole("option", { name: /Montaj treaptă/ }).click();
  await page.locator('input[inputmode="decimal"]').first().fill("15");
  check(
    "poziția aleasă aduce prețul în ofertă (15 × 500)",
    (await page.getByText(/7\.500 MDL/).count()) > 0,
  );
  await page.getByRole("button", { name: /Creează oferta/i }).click();
  await page.waitForURL(/\/oferte\/[0-9a-f-]{36}/, { timeout: 15000 });
  check("oferta s-a creat", true);
  check("oferta are număr", (await page.getByText(/OFERTĂ #00001/).count()) > 0);
  check("oferta are total", (await page.getByText(/7\.500 MDL/).count()) > 0);

  /* --------------- ofertă → lucrare: fără încasare fantomă ---------- */
  section("Ofertă transformată în lucrare");
  // Avansul cerut în ofertă este o cerere, nu bani primiți: lucrarea creată
  // din ofertă trebuie să pornească de la zero încasat.
  await page.getByRole("link", { name: /Editează/i }).click();
  await page.waitForURL(/\/oferte\/[0-9a-f-]{36}\/editare/, { timeout: 15000 });
  await page.locator('input[inputmode="decimal"]').last().fill("2000"); // avans cerut
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.waitForURL(/\/oferte\/[0-9a-f-]{36}$/, { timeout: 15000 });
  check("avansul cerut apare pe ofertă", (await page.getByText(/2\.000 MDL/).count()) > 0);

  await page.getByRole("button", { name: /Fă lucrare/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });
  await page.getByRole("tab", { name: /Finanțe/i }).click();
  await page.waitForTimeout(600);
  const financeText = await page.locator("body").innerText();
  const paidLine = financeText.match(/Total încasat\s*\n?\s*([^\n]+)/);
  check(
    "lucrarea din ofertă pornește cu 0 încasat",
    !!paidLine && /^0\s/.test(paidLine[1].trim()),
    paidLine ? paidLine[1].trim() : "linia „Total încasat” nu a fost găsită",
  );
  check(
    "restul de plată este tot prețul lucrării",
    (await page.getByText(/7\.500 MDL/).count()) > 0,
  );

  /* ----------------------------- factură --------------------------- */
  section("Factură din lucrare");
  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByText("Montaj scară stejar (test)").first().click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });
  await page.getByRole("tab", { name: /Finanțe/i }).click();
  await page.getByRole("button", { name: /Fă factură/i }).click();
  await page.locator("#invoice-subtotal").fill("12000");
  await page.locator("#invoice-vat").fill("20");
  check(
    "totalul facturii include TVA",
    (await page.getByText(/14\.400 MDL/).count()) > 0,
  );
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.waitForURL(/\/facturi\/[0-9a-f-]{36}/, { timeout: 15000 });
  check("factura s-a creat și s-a deschis", true);
  await page.getByRole("button", { name: /Marchează achitată/i }).click();
  await page.getByText(/Achitată/).first().waitFor({ timeout: 10000 });
  check("factura poate fi marcată achitată", true);

  // PDF-ul e o fotografie a documentului: dacă html2canvas se împiedică de
  // vreun stil, aici se vede, nu pe telefonul clientului.
  const download = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: /^PDF$/ }).click();
  const file = await download;
  check(
    "factura se descarcă ca PDF",
    file.suggestedFilename().endsWith(".pdf"),
    file.suggestedFilename(),
  );

  /* ----------------------------- căutare --------------------------- */
  section("Căutare globală");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Caută" }).click();
  const searchDialog = page.getByRole("dialog");
  await searchDialog.getByPlaceholder(/Caută client/).fill("Ion");
  // Căutarea se face în dialog: fără scop, textul s-ar potrivi și cu pagina
  // de dedesubt, pe care dialogul o acoperă.
  const clientHit = searchDialog.getByRole("button", { name: /Ion Popescu \(test\)/ });
  await clientHit.first().waitFor({ timeout: 10000 });
  check("căutarea găsește clientul", true);
  await clientHit.first().click();
  await page.waitForURL(/\/clienti\/[0-9a-f-]{36}/, { timeout: 15000 });
  check("rezultatul duce la client", true);

  /* ----------------------------- navigare -------------------------- */
  section("Navigare în toate paginile");
  for (const [path, heading] of [
    ["/lucrari", /Lucrări/],
    ["/calendar", /Calendar/],
    ["/clienti", /Clienți/],
    ["/masuratori", /Măsurători/],
    ["/finante", /Finanțe/],
    ["/facturi", /Facturi/],
    ["/materiale", /Materiale/],
    ["/scule", /Scule/],
    ["/portofoliu", /Portofoliu/],
    ["/notificari", /Notificări/],
    ["/rapoarte", /Rapoarte/],
    ["/predari", /Procese-verbale/],
    ["/echipa", /Echipă/],
    ["/setari", /Setări/],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const visible = await page
      .getByRole("heading", { name: heading })
      .first()
      .isVisible()
      .catch(() => false);
    check(`pagina ${path} se încarcă`, visible);
  }

  /* ----------------------------- persistență ----------------------- */
  section("Persistența datelor");
  await page.reload({ waitUntil: "networkidle" });
  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByText("Montaj scară stejar (test)").first().waitFor({ timeout: 10000 });
  check("lucrarea supraviețuiește reîncărcării (IndexedDB)", true);

  /* ----------------------------- proiect --------------------------- */
  section("Proiecte");
  await page.goto(`${BASE}/proiecte`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Proiect nou/i }).first().click();
  await page.getByPlaceholder("Bloc Ismail 45, scara 2").fill("Bloc test, scara 2");
  await page.getByRole("button", { name: /Creează proiectul/i }).click();
  await page.getByText("Bloc test, scara 2").first().waitFor({ timeout: 10000 });
  check("proiectul apare în listă", true);

  await page.getByText("Bloc test, scara 2").first().click();
  await page.waitForURL(/\/proiecte\/[0-9a-f-]{36}/, { timeout: 15000 });
  await page.getByRole("combobox", { name: /Alege lucrarea/i }).click();
  await page.getByRole("option", { name: /Montaj scară stejar \(test\)/ }).click();
  await page.getByText("Montaj scară stejar (test)").first().waitFor({ timeout: 10000 });
  check("lucrarea se mută sub proiect", true);
  check(
    "totalul proiectului adună lucrările",
    (await page.getByText(/12\.000 MDL/).count()) > 0,
  );

  /* ----------------------------- mod șantier ----------------------- */
  section("Mod șantier");
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  await page.getByRole("switch", { name: /Mod șantier/i }).click();
  await page.getByRole("button", { name: /^Șantier$/ }).waitFor({ timeout: 10000 });
  check("modul șantier se aprinde", true);

  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByText(/prețurile sunt ascunse/i).first().waitFor({ timeout: 10000 });
  check(
    "prețurile dispar de pe cardurile de lucrări",
    (await page.getByText(/12\.000 MDL/).count()) === 0,
  );

  // Pastila din antet le aduce înapoi dintr-o apăsare.
  await page.getByRole("button", { name: /^Șantier$/ }).click();
  await page.getByText(/12\.000 MDL/).first().waitFor({ timeout: 10000 });
  check("o apăsare pe pastilă aduce cifrele înapoi", true);

  /* ----------------------------- primii pași ----------------------- */
  section("Primii pași");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Hai să pornim/i }).waitFor({ timeout: 10000 });
  check("cardul primilor pași apare pe contul nou", true);
  // Până aici verificările au pus tariful, au adăugat clientul și au deschis
  // lucrarea — trei pași din listă. Al patrulea, datele de pe ofertă, nu.
  const progress = page.getByText(/din [45] — durează/).first();
  await progress.waitFor({ timeout: 10000 });
  await page
    .waitForFunction(() => /3 din \d/.test(document.body.innerText), null, {
      timeout: 10000,
    })
    .catch(() => {});
  const progressText = await progress.innerText();
  check(
    "pașii deja făcuți se bifează singuri",
    /^3 din/.test(progressText),
    progressText,
  );
  check(
    "pasul rămas e cel nefăcut",
    (await page.getByText("Completează-ți datele").count()) > 0,
  );
  await page.getByRole("button", { name: /Ascunde primii pași/i }).click();
  await page
    .getByRole("heading", { name: /Hai să pornim/i })
    .waitFor({ state: "detached", timeout: 10000 });
  check("cardul primilor pași se poate închide", true);

  /* ----------------------------- arhivă ---------------------------- */
  section("Arhiva lucrărilor");
  await page.goto(jobUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Mută în arhivă/i }).click();
  await page.getByText("arhivată", { exact: true }).waitFor({ timeout: 10000 });
  check("lucrarea se poate arhiva", true);

  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Arhivă/ }).waitFor({ timeout: 10000 });
  check(
    "lucrarea arhivată iese din lista de zi cu zi",
    (await page.getByText("Montaj scară stejar (test)").count()) === 0,
  );
  await page.getByRole("tab", { name: /Arhivă/ }).click();
  await page.getByText("Montaj scară stejar (test)").first().waitFor({ timeout: 10000 });
  check("filtrul Arhivă o arată", true);

  // O scoatem înapoi: restul verificărilor lucrează cu ea.
  await page.goto(jobUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Scoate din arhivă/i }).click();
  await page.getByRole("button", { name: /Mută în arhivă/i }).waitFor({ timeout: 10000 });
  check("lucrarea se poate scoate din arhivă", true);

  /* ----------------------------- backup ---------------------------- */
  section("Backup");
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  await page.getByText(/Copii locale/i).waitFor({ timeout: 10000 });
  check("setările arată copiile locale", true);
  check(
    "arhivarea în masă are butonul ei",
    (await page.getByRole("button", { name: /Arhivează lucrările vechi/i }).count()) > 0,
  );

  /* ----------------------------- setări ---------------------------- */
  section("Schimbarea monedei");
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  // Așteptăm ca setările să fie încărcate (altfel selectul încă nu are valoare).
  const currencySelect = page.getByRole("combobox").first();
  await currencySelect.filter({ hasText: /MDL/ }).waitFor({ timeout: 10000 });
  await currencySelect.click();
  await page.getByRole("option", { name: /Euro/ }).click();
  await page.getByRole("combobox").first().filter({ hasText: /EUR/ }).waitFor({ timeout: 10000 });
  await page.goto(`${BASE}/finante`, { waitUntil: "networkidle" });
  await page.getByText(/EUR/).first().waitFor({ timeout: 10000 });
  check(
    "moneda se schimbă în toată aplicația",
    (await page.getByText(/EUR/).count()) > 0,
  );
  // înapoi la MDL, ca rularea următoare să pornească din aceleași condiții
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  const backToMDL = page.getByRole("combobox").first();
  await backToMDL.filter({ hasText: /EUR/ }).waitFor({ timeout: 10000 });
  await backToMDL.click();
  await page.getByRole("option", { name: /Leu moldovenesc/ }).click();

  /* ----------------------------- PWA ------------------------------- */
  section("PWA");
  const manifest = await page.request.get(`${BASE}/manifest.webmanifest`);
  check("manifestul este servit", manifest.ok());
  const manifestJson = await manifest.json();
  check("manifestul are iconițe", (manifestJson.icons ?? []).length >= 2);
  check("manifestul pornește standalone", manifestJson.display === "standalone");
  const sw = await page.request.get(`${BASE}/sw.js`);
  check("service worker-ul este servit", sw.ok());
  const offline = await page.request.get(`${BASE}/offline.html`);
  check("pagina offline există", offline.ok());

  /* ----------------------------- erori în consolă ------------------ */
  section("Consola");
  const realErrors = consoleErrors.filter(
    (error) =>
      !error.includes("favicon") &&
      !error.includes("Failed to load resource: the server responded with a status of 404"),
  );
  check("fără erori în consolă", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
} catch (error) {
  failures.push(`excepție: ${error.message}`);
  console.log(`\n✗ Excepție: ${error.message}`);
  await page.screenshot({ path: "tests/failure.png" }).catch(() => {});
} finally {
  await browser.close();
}

console.log(`\n${passed} verificări trecute, ${failures.length} eșecuri`);
if (failures.length) {
  console.log("\nEșecuri:");
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
