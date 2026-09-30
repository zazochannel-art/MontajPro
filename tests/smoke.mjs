/**
 * Test de fum pentru MontCraft.
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

/**
 * A apărut pe ecran, în timpul dat?
 *
 * O verificare scrisă ca „așteaptă o clipă, apoi numără” trece pe laptopul
 * meu și pică pe mașina din CI, care e mai înceată — nu fiindcă aplicația e
 * stricată, ci fiindcă n-a apucat să deseneze. Așteptarea pe element nu
 * slăbește verificarea: tot cere ca lucrul să fie acolo.
 */
/**
 * Alege un material din inventar și scrie cantitatea și prețul.
 *
 * Alegerea din inventar aduce cu ea numele, unitatea ȘI prețul din depozit
 * — toate într-o singură scriere de stare. Dacă începem să tastăm înainte ca
 * ea să se așeze, prețul nostru e suprascris cu cel din depozit (zero, pe un
 * material adăugat fără preț), iar linia iese fără preț. Pe mașina mea nu se
 * vedea; pe un runner mai lent, da — și atunci istoricul de preț rămâne cu un
 * singur punct, deci fără tendință.
 *
 * Așteptăm numele, care vine din aceeași scriere: dacă el e acolo, s-a așezat
 * tot. Apoi verificăm că prețul chiar a rămas cât am scris.
 */
async function pickMaterial(page, dialog, optionName, quantity, price) {
  await dialog.getByRole("combobox").first().waitFor({ timeout: 10000 });
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: optionName }).click();
  // Lista de opțiuni se închide cu o animație, iar cât e pe ecran înghite
  // apăsările. Dacă mergem mai departe peste ea, clicul pe Salvează se poate
  // pierde în ea fără să se vadă: dialogul rămâne deschis și linia nu se scrie.
  await page.getByRole("listbox").waitFor({ state: "detached", timeout: 10000 });

  const nameInput = dialog.getByPlaceholder("Adeziv parchet");
  await nameInput.waitFor({ timeout: 10000 });
  await expectValue(nameInput, optionName, 10000);

  const numbers = dialog.locator('input[inputmode="decimal"]');
  await numbers.nth(0).fill(quantity);
  await numbers.nth(1).fill(price);
  await expectValue(numbers.nth(1), new RegExp(`^${price}`), 5000);
}

/**
 * Salvează un dialog și așteaptă să se închidă.
 *
 * Închiderea e singura dovadă că salvarea a trecut: formularul închide abia
 * după ce scrierea s-a terminat. Așteptarea unui text în schimb nu dovedește
 * nimic — numele materialului se vede și în dialogul rămas deschis, așa că un
 * clic pierdut trecea nevăzut și lipsa liniei ieșea la iveală mult mai târziu,
 * la istoricul de preț, unde nu se mai înțelegea de unde vine.
 */
async function saveDialog(dialog) {
  await dialog.getByRole("button", { name: /^Salvează$/ }).click();
  await dialog.waitFor({ state: "detached", timeout: 15000 });
}

/**
 * Unde începe meniul fix de jos.
 *
 * Tot ce cade sub linia asta e acoperit de meniu și nu se mai poate apăsa, deci
 * e reperul după care se verifică dacă desenul a împins butoanele afară.
 */
async function navTop(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const nav = document.querySelector("nav.fixed, nav[class*='fixed']");
    return nav ? nav.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
  });
}

/** Așteaptă ca un câmp să aibă valoarea cerută, fără pauze ghicite. */
async function expectValue(locator, expected, timeout) {
  const deadline = Date.now() + timeout;
  let last = "";
  while (Date.now() < deadline) {
    last = (await locator.inputValue()) ?? "";
    if (expected instanceof RegExp ? expected.test(last) : last.includes(expected)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`câmpul a rămas „${last}”, se aștepta ${expected}`);
}

async function seen(locator, timeout = 10000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
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

  // De la pornire, aplicația cere poza „înainte” — peretele deja zgâriat,
  // parchetul vechi umflat. Apare o singură dată pe lucrare.
  const beforePrompt = page.getByRole("dialog").filter({
    hasText: /Fă o poză înainte/i,
  });
  await beforePrompt.waitFor({ timeout: 10000 });
  check("la START se cere poza „înainte”", true);
  await page.getByRole("button", { name: /Mai târziu/i }).click();
  await beforePrompt.waitFor({ state: "hidden", timeout: 10000 });
  check("„Mai târziu” închide fereastra fără să oprească cronometrul", true);

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

  // Semaforul treptei. 15 trepte de 18 cm cu călcătura de 30: 2×18+30 = 66,
  // adică exact la limita de sus — încă se urcă bine.
  check(
    "treapta bună primește verde",
    await page.getByText("Treptele se urcă bine").isVisible(),
  );

  // Treapta de 22 cm iese din orice limită: trebuie oprită, nu doar semnalată.
  await page.locator("#m-height").fill("22");
  await page.getByText("Treptele nu se vor urca bine").waitFor({ timeout: 10000 });
  check("treapta prea înaltă primește roșu", true);
  check(
    "i se spune și cum se repară",
    (await page.getByText(/trepte în loc de/).count()) > 0,
  );
  await page.locator("#m-height").fill("18");
  await page.getByText("Treptele se urcă bine").waitFor({ timeout: 10000 });
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
  // Mesajul prin care ceri restul: se scria de mână, adică de multe ori
  // nu se scria deloc.
  check(
    "ai de unde cere restul, cu suma deja scrisă în buton",
    (await page.getByRole("button", { name: /Cere restul de 4\.000 MDL/ }).count()) > 0,
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
  const quoteUrl = page.url();
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

  // Liniile ofertei erau poziții de scară, deci lucrarea e o scară — nu
  // „Altceva”, cum ieșea înainte, cu tot ce trage după sine: șablonul de
  // pași, lista de scule, media pe unitate.
  check(
    "lucrarea din ofertă știe ce fel de lucrare e",
    (await page.getByText(/Scară/).count()) > 0,
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
  // Titlul lucrării apare și în opțiunea tocmai apăsată, care se închide cu
  // animație: așteptăm cardul propriu-zis, care e o legătură, nu o opțiune.
  await page
    .getByRole("link", { name: /Montaj scară stejar \(test\)/ })
    .first()
    .waitFor({ timeout: 10000 });
  check("lucrarea se mută sub proiect", true);
  await page.getByText(/12\.000 MDL/).first().waitFor({ timeout: 10000 });
  check("totalul proiectului adună lucrările", true);

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

  /* ----------------------------- rusă ------------------------------ */
  section("Limba");
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  const langSelect = page.getByRole("combobox").nth(1);
  await langSelect.filter({ hasText: /Română/ }).waitFor({ timeout: 10000 });
  await langSelect.click();
  await page.getByRole("option", { name: /Русский/ }).click();
  // Setarea se scrie în IndexedDB înainte ca interfața s-o arate, deci
  // așteptarea de aici e și garanția că navigarea următoare n-o ia înaintea
  // scrierii.
  await page
    .getByRole("combobox")
    .nth(1)
    .filter({ hasText: /Русский/ })
    .waitFor({ timeout: 10000 });
  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Работы" }).waitFor({ timeout: 10000 });
  check("interfața trece în rusă", true);
  check(
    "ce n-are traducere rămâne în română, nu dispare",
    (await page.getByText("Montaj scară stejar (test)").count()) > 0,
  );

  // Înapoi la română, ca rularea următoare să pornească din aceleași condiții.
  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  const backToRo = page.getByRole("combobox").nth(1);
  await backToRo.filter({ hasText: /Русский/ }).waitFor({ timeout: 10000 });
  await backToRo.click();
  await page.getByRole("option", { name: /Română/ }).click();
  await page
    .getByRole("combobox")
    .nth(1)
    .filter({ hasText: /Română/ })
    .waitFor({ timeout: 10000 });
  await page.goto(`${BASE}/lucrari`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Lucrări" }).waitFor({ timeout: 10000 });
  check("comutarea înapoi în română merge", true);

  /* ----------------------------- garanții -------------------------- */
  section("Garanții");

  await page.goto(`${BASE}/garantii`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Garanții" }).waitFor({ timeout: 15000 });
  check("pagina de garanții se deschide", true);
  check(
    "fără predări, spune limpede de unde vin garanțiile",
    (await page.getByText(/procesul-verbal de predare/i).count()) > 0,
  );

  /* ----------------------------- clientul deja în agendă ----------- */
  section("Clientul deja în agendă, adăugat din lucrare");

  // Scenariul care pierdea munca: scrii o lucrare, apeși „+” la client, tastezi
  // un om pe care îl ai deja în agendă. Înainte, butonul de dublură te muta pe
  // fișa clientului și lucrarea scrisă pe jumătate se ducea. Acum îl alege.
  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").waitFor({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.getByPlaceholder("Montaj scară stejar").fill("Lucrare pe jumătate (test)");
  await page.locator("#job-price").fill("7777");
  await page.getByRole("button", { name: "Client nou" }).first().click();
  await page.locator("#client-name").waitFor({ timeout: 10000 });
  await page.locator("#client-name").fill("Ion Popescu (test)");

  const pickExisting = page.getByRole("button", { name: /^Alege pe / });
  await pickExisting.first().waitFor({ timeout: 10000 });
  check("clientul deja existent e semnalat, cu opțiunea de a-l alege", true);

  await pickExisting.first().click();
  await page.waitForTimeout(1500);
  check(
    "rămâi în lucrare, nu ești mutat pe fișa clientului",
    new URL(page.url()).pathname === "/lucrari/nou",
    `ești la ${new URL(page.url()).pathname}`,
  );
  check(
    "ce scrisesei în lucrare nu s-a pierdut",
    (await page.getByPlaceholder("Montaj scară stejar").inputValue()) ===
      "Lucrare pe jumătate (test)" &&
      (await page.locator("#job-price").inputValue()) === "7777",
  );
  check(
    "clientul găsit a fost pus pe lucrare",
    (await page.getByRole("combobox").first().innerText()).includes("Ion Popescu (test)"),
  );

  /* ----------------------------- sculele zilei --------------------- */
  section("Sculele de luat azi");

  // Drumul înapoi după ferăstrăul uitat acasă costă o oră. Scula se leagă de
  // tipul de lucrare, iar dimineața lista se face singură.
  await page.goto(`${BASE}/scule`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sculă nouă/i }).first().click();
  const toolDialog = page.getByRole("dialog");
  await toolDialog.getByPlaceholder("Ferăstrău circular").waitFor({ timeout: 10000 });
  await toolDialog.getByPlaceholder("Ferăstrău circular").fill("Ferăstrău (test)");
  await toolDialog.getByRole("button", { name: /Scară/ }).click();
  await toolDialog.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText("Ferăstrău (test)").first().waitFor({ timeout: 10000 });
  check("scula se salvează cu tipul de lucrare pus", true);
  check(
    "tipul se vede pe fișa sculei",
    (await page.getByText(/Scară/).count()) > 0,
  );

  // O lucrare de azi, ca lista să aibă pentru ce se face.
  const todayKey = new Date().toISOString().slice(0, 10);
  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").waitFor({ timeout: 15000 });
  await page.getByPlaceholder("Montaj scară stejar").fill("Scară de azi (test)");
  await page.locator("#job-date").fill(todayKey);
  await page.locator("#job-price").fill("5000");
  await page.getByRole("button", { name: /Creează lucrarea/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText("De luat azi").first().waitFor({ timeout: 15000 });
  check("lista de scule apare pe ziua cu lucrări", true);
  check(
    "scula legată de tipul zilei intră în listă",
    (await page.getByRole("button", { name: "Ferăstrău (test)" }).count()) > 0,
  );
  await page.getByRole("button", { name: "Ferăstrău (test)" }).click();
  check(
    "scula se bifează pe măsură ce încarci mașina",
    (await page.getByText("1/1").count()) > 0,
  );

  /* ----------------------------- înainte să pleci ------------------ */
  section("Lista de dinainte de plecare");

  await page.goto(`${jobUrl}`, { waitUntil: "networkidle" });
  await page.getByText("Înainte să pleci").first().waitFor({ timeout: 15000 });
  check("lucrarea începută arată ce mai e de făcut înainte de plecare", true);
  check(
    "lista spune câte lucruri au rămas",
    (await page.getByText(/rămas|rămase|Poți pleca/i).count()) > 0,
  );

  /* ----------------------------- restul de material ---------------- */
  section("Materialul rămas se întoarce în depozit");

  // Din zece pachete cumpărate intră opt în podea. Fără pasul ăsta, data
  // viitoare cumperi din nou ce ai deja în pod.
  await page.goto(`${BASE}/materiale`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Material nou/i }).first().click();
  const stockDialog = page.getByRole("dialog");
  await stockDialog.getByPlaceholder("Parchet stejar 14mm").waitFor({ timeout: 10000 });
  await stockDialog.getByPlaceholder("Parchet stejar 14mm").fill("Parchet stejar (test)");
  await stockDialog.locator('input[inputmode="decimal"]').first().fill("10");
  await stockDialog.getByRole("button", { name: /^Salvează$/ }).click();
  await page.getByText("Parchet stejar (test)").first().waitFor({ timeout: 10000 });
  check("materialul intră în depozit", true);

  await page.goto(`${jobUrl}?tab=materiale`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Materiale/i }).click();
  await page.getByRole("button", { name: /Adaugă material/i }).first().click();
  const jobMaterialDialog = page.getByRole("dialog");
  // Prețul contează și pentru istoricul de preț, verificat mai jos.
  await pickMaterial(
    page,
    jobMaterialDialog,
    /Parchet stejar \(test\)/,
    "8",
    "160",
  );
  await saveDialog(jobMaterialDialog);
  await page.getByText("Parchet stejar (test)").first().waitFor({ timeout: 10000 });

  await page
    .getByRole("checkbox", { name: /Marchează Parchet stejar \(test\) drept cumpărat/i })
    .click();
  const leftoverButton = page.getByRole("button", { name: /a rămas material/i });
  await leftoverButton.waitFor({ timeout: 10000 });
  check("materialul cumpărat poate fi pus înapoi în depozit", true);

  await leftoverButton.click();
  const leftoverInput = page.getByLabel(/Cât a rămas din Parchet stejar/i);
  await leftoverInput.waitFor({ timeout: 10000 });
  await leftoverInput.fill("2");
  await page.getByRole("button", { name: /Pune în stoc/i }).click();
  await page
    .getByRole("button", { name: /pus la loc 2/i })
    .waitFor({ timeout: 10000 });
  check("cantitatea întoarsă rămâne scrisă pe linie", true);

  await page.goto(`${BASE}/materiale`, { waitUntil: "networkidle" });
  await page.getByText("Parchet stejar (test)").first().waitFor({ timeout: 10000 });
  check(
    "stocul crește cu ce s-a întors",
    (await page.getByText(/\b12\b/).count()) > 0,
  );

  /* ----------------------------- prețul clientului ----------------- */
  section("Prețul pe clientul din fața ta");

  await page.goto(`${BASE}/clienti`, { waitUntil: "networkidle" });
  await page.getByText("Ion Popescu (test)").first().click();
  await page.waitForURL(/\/clienti\/[0-9a-f-]{36}/, { timeout: 15000 });
  await page.getByRole("button", { name: /Editează/i }).first().click();
  const clientDialog = page.getByRole("dialog");
  const adjustInput = clientDialog
    .locator("input[inputmode='decimal'], input[type='number']")
    .last();
  await adjustInput.waitFor({ timeout: 10000 });
  await adjustInput.fill("-10");
  await clientDialog.getByRole("button", { name: /Salvează/i }).click();
  await clientDialog.waitFor({ state: "hidden", timeout: 10000 });
  check("clientul primește o reducere pe fișa lui", true);

  await page.goto(`${BASE}/calculator`, { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Client" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByRole("option", { name: /Ion Popescu \(test\)/ }).click();
  check(
    "reducerea clientului se vede în calculator",
    (await page.getByText(/−10%/).count()) > 0,
  );
  check(
    "calculatorul spune limpede că prețurile sunt deja ajustate",
    (await page.getByText(/sunt deja cu/i).count()) > 0,
  );

  /* ----------------------------- săptămâna ------------------------- */
  section("Cât ai liber săptămâna asta");

  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle" });
  await page.getByText("Săptămâna asta").first().waitFor({ timeout: 15000 });
  check("capacitatea săptămânii apare în calendar", true);

  const blockToday = page.getByRole("button", { name: `Blochează ziua de ${todayKey}` });
  await blockToday.waitFor({ timeout: 10000 });
  await blockToday.click();
  await page
    .getByRole("button", { name: `Eliberează ziua de ${todayKey}` })
    .waitFor({ timeout: 10000 });
  check("o zi se poate bloca dintr-o apăsare", true);
  await page.getByRole("button", { name: `Eliberează ziua de ${todayKey}` }).click();
  await blockToday.waitFor({ timeout: 10000 });
  check("și se eliberează la loc", true);

  /* ----------------------------- linkuri publice ------------------- */
  section("Linkurile publice");

  await page.goto(`${BASE}/setari`, { waitUntil: "networkidle" });
  await page.getByText("Linkuri publice").first().waitFor({ timeout: 15000 });
  check("setările au secțiunea de linkuri publice", true);

  const portfolioSwitch = page.getByRole("switch", {
    name: /Pornește linkul pentru portofoliul/i,
  });
  await portfolioSwitch.waitFor({ timeout: 10000 });
  await portfolioSwitch.click();
  const publicLink = page.getByText(/\/lucrari-publice\//).first();
  await publicLink.waitFor({ timeout: 10000 });
  check("linkul de portofoliu se face la o apăsare", true);

  await portfolioSwitch.click();
  await publicLink.waitFor({ state: "hidden", timeout: 10000 });
  check("oprirea linkului îl face să dispară pe loc", true);

  /* ----------------------------- ce mai am de făcut ---------------- */
  section("De terminat, pe toate lucrările");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText("De terminat").first().waitFor({ timeout: 15000 });
  check("dimineața vezi toți pașii nebifați, din toate lucrările", true);

  const firstStep = page.getByRole("checkbox", { name: /Bifează / }).first();
  await firstStep.waitFor({ timeout: 10000 });
  const stepLabel = await firstStep.getAttribute("aria-label");
  await firstStep.click();
  await page.waitForTimeout(1200);
  check(
    "pasul se bifează de pe prima pagină, fără să intri în lucrare",
    (await page.getByRole("checkbox", { name: stepLabel }).count()) === 0,
    `„${stepLabel}” ar fi trebuit să dispară din listă`,
  );

  /* ----------------------------- portofoliul public ---------------- */
  section("Portofoliul public");

  // Bifa asta e singurul lucru care hotărăște ce se vede prin linkul public.
  // Fără ea, linkul din Setări duce la o pagină goală.
  await page.goto(`${BASE}/portofoliu`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Portofoliu" }).waitFor({ timeout: 15000 });
  check(
    "fără nicio lucrare bifată, se spune limpede că nu vede nimeni nimic",
    (await page.getByText(/linkul public e oprit|bifează lucrările/i).count()) > 0,
  );

  // Portofoliul arată lucrările terminate, iar până aici niciuna nu e.
  await page.goto(`${jobUrl}/editare`, { waitUntil: "networkidle" });
  await page.locator("#job-title").waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const statusSelect = page.getByRole("combobox").last();
  await statusSelect.click();
  await page.getByRole("option", { name: /^Finalizată$/ }).click();
  await page.getByRole("button", { name: /Salvează/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}$/, { timeout: 15000 });

  await page.goto(`${BASE}/portofoliu`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Portofoliu" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);

  const portfolioSwitches = page.getByRole("switch", { name: /în portofoliul public/i });
  const hasFinished = (await portfolioSwitches.count()) > 0;
  check("lucrarea terminată are bifa de portofoliu public", hasFinished);

  if (hasFinished) {
    await portfolioSwitches.first().click();
    await page.getByText("Se vede public").first().waitFor({ timeout: 10000 });
    check("lucrarea se poate arăta public dintr-o apăsare", true);
    check(
      "se spune și că linkul e încă oprit",
      (await page.getByText(/linkul public e oprit/i).count()) > 0,
    );
    await portfolioSwitches.first().click();
    await page.getByText("Doar pentru tine").first().waitFor({ timeout: 10000 });
    check("și se scoate la loc", true);
  }

  /* ----------------------------- oferta pierdută ------------------- */
  section("De ce n-a ieșit oferta");

  await page.goto(quoteUrl, { waitUntil: "networkidle" });
  await page.getByText(/OFERTĂ #00001/).waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: /Refuzată/i }).click();
  const rejectDialog = page.getByRole("dialog");
  await rejectDialog.getByText(/De ce n-a ieșit/i).waitFor({ timeout: 10000 });
  check("refuzul întreabă motivul, cât încă îl mai știi", true);

  await rejectDialog.getByRole("button", { name: /Prea scump/i }).click();
  await rejectDialog.getByRole("button", { name: /^Salvează$/ }).click();
  await rejectDialog.waitFor({ state: "hidden", timeout: 10000 });
  await page.getByRole("button", { name: /Prea scump/i }).waitFor({ timeout: 10000 });
  check("motivul rămâne scris pe ofertă", true);

  await page.goto(`${BASE}/rapoarte`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Rapoarte" }).waitFor({ timeout: 15000 });
  await page.getByRole("heading", { name: "Oferte" }).waitFor({ timeout: 15000 });
  check("rapoartele numără ofertele câștigate și pierdute", true);
  check(
    "motivul refuzului se vede în raport",
    (await page.getByText(/Prea scump/i).count()) > 0,
  );

  /* ----------------------------- oferta expirată ------------------- */
  section("Oferta trecută de termen");

  // Baza refuză deja o ofertă expirată — `quote_by_token` filtrează după
  // `valid_until`. Până acum aplicația tăcea, deci îi dădeai ghes unui om
  // care n-avea ce deschide.
  await page.goto(`${quoteUrl}/editare`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="date"]').first().fill("2026-09-01");
  await page.getByRole("button", { name: /^Salvează$/ }).click();
  await page.waitForURL(/\/oferte\/[0-9a-f-]{36}$/, { timeout: 15000 });

  // Oferta e refuzată din secțiunea de mai devreme; o punem înapoi pe „trimisă”,
  // fiindcă doar una încă în joc poate expira.
  await page.getByRole("button", { name: /Marchează trimisă/i }).click();
  await page.waitForTimeout(1200);

  const expiredNotice = page.getByText(/Termenul a trecut pe/i);
  await expiredNotice.waitFor({ timeout: 10000 });
  check("oferta expirată o spune pe față, nu tace", true);
  check(
    "se explică de ce contează: clientul nu mai vede nimic",
    (await page.getByText(/nu mai vede nimic/i).count()) > 0,
  );

  await page.getByRole("button", { name: /Încă 14 zile/i }).click();
  await expiredNotice.waitFor({ state: "hidden", timeout: 10000 });
  check("prelungirea repune oferta în joc dintr-o apăsare", true);

  await page.goto(`${BASE}/oferte`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check(
    "după prelungire, lista n-o mai arată expirată",
    (await page.getByText(/expirată de/i).count()) === 0,
  );

  /* ----------------------------- legenda pozei --------------------- */
  section("Legenda pe poză");

  await page.goto(`${jobUrl}?tab=poze`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Poze/i }).click();
  await page.waitForTimeout(1200);
  /*
   * O poză adevărată, pusă prin inputul de fișier — același pe care îl
   * deschide butonul „Adaugă”. Un PNG de 8×8 e destul: ne interesează
   * legenda, nu poza.
   */
  const PNG_8x8 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJUlEQVR4nGP8//8/AzGAiShVoxpHNY5qHNU4qnFU46jGUY3DUSMANmsD/XdCPRAAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .locator('input[type="file"]:not([capture])')
    .first()
    .setInputFiles({ name: "poza.png", mimeType: "image/png", buffer: PNG_8x8 });
  await page.waitForTimeout(2500);

  const anyPhoto = page.locator("button.relative.aspect-square").first();
  const hasPhoto = (await anyPhoto.count()) > 0;
  check("poza se adaugă de pe telefon", hasPhoto);

  if (hasPhoto) {
    await anyPhoto.click();
    const captionInput = page.getByLabel("Legenda pozei");
    await captionInput.waitFor({ timeout: 10000 });
    check("poza deschisă poate primi o legendă", true);
    await captionInput.fill("Crăpătura era înainte să venim (test)");
    await page.getByRole("button", { name: /^Salvează$/ }).click();
    await page.getByText(/Legendă salvată/i).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Închide/i }).click();
    await page.waitForTimeout(800);
    check(
      "legenda se vede pe miniatură, fără să deschizi poza",
      (await page.getByText("Crăpătura era înainte să venim (test)").count()) > 0,
    );
  }

  /* ----------------------------- lucrarea, la client --------------- */
  section("Clientul își vede lucrarea");

  await page.goto(`${jobUrl}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  // Fără cloud configurat, butonul nu apare deloc: un link public fără server
  // n-ar duce nicăieri.
  const shareButton = page.getByRole("button", { name: /Arată-i clientului lucrarea/i });
  check(
    "fără cloud, linkul pentru client nu se oferă degeaba",
    (await shareButton.count()) === 0,
  );

  /* ----------------------------- prețul materialului --------------- */
  section("Prețul materialului, în timp");

  // O a doua lucrare cu același material din depozit, la alt preț: abia
  // atunci există o tendință.
  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").waitFor({ timeout: 15000 });
  await page.getByPlaceholder("Montaj scară stejar").fill("A doua lucrare (test)");
  await page.locator("#job-price").fill("3000");
  await page.getByRole("button", { name: /Creează lucrarea/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });

  await page.getByRole("tab", { name: /Materiale/i }).click();
  await page.getByRole("button", { name: /Adaugă material/i }).first().click();
  const secondDialog = page.getByRole("dialog");
  await pickMaterial(
    page,
    secondDialog,
    /Parchet stejar \(test\)/,
    "5",
    "200",
  );
  await saveDialog(secondDialog);
  await page.getByText("Parchet stejar (test)").first().waitFor({ timeout: 10000 });

  await page.goto(`${BASE}/materiale`, { waitUntil: "networkidle" });
  await page.getByText("Parchet stejar (test)").first().waitFor({ timeout: 15000 });
  /*
   * Verificarea asta a picat de trei ori în CI și niciodată local, iar din cod
   * nu se vede de ce: cu două linii la prețuri diferite, „același preț” e
   * imposibil, deci singura cale de a nu apărea tendința e ca una din linii să
   * nu intre în socoteală — ștearsă, fără legătură cu inventarul, sau cu preț
   * zero. Așa că atunci când pică, își citește singură datele din baza locală
   * și spune care e. Un eșec care nu-și spune cauza se repetă.
   */
  const trendLine = page.getByText(/% față de|același preț ca în/).first();
  const trendShown = await seen(trendLine, 15000);
  const trendText = trendShown ? ((await trendLine.textContent()) ?? "").trim() : "";
  let trendDetail = trendShown ? `scrie „${trendText}”` : "nu apare nicio tendință de preț";

  if (!/% față de/.test(trendText)) {
    const lines = await page.evaluate(async () => {
      const request = indexedDB.open("montajpro");
      const db = await new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
      if (!db || !db.objectStoreNames.contains("job_materials")) return "baza lipsește";
      const store = db.transaction("job_materials").objectStore("job_materials");
      const rows = await new Promise((resolve) => {
        const all = store.getAll();
        all.onsuccess = () => resolve(all.result);
        all.onerror = () => resolve([]);
      });
      return rows.map((row) => ({
        nume: row.name,
        pret: row.unit_price,
        material: row.material_id,
        sters: row.deleted_at,
        creat: row.created_at,
      }));
    });
    trendDetail += ` | linii de material: ${JSON.stringify(lines)}`;
  }

  check(
    "materialul cumpărat de două ori arată cât s-a schimbat prețul",
    /% față de/.test(trendText),
    trendDetail,
  );

  /* ----------------------------- lucrarea de mai multe zile -------- */
  section("Lucrarea care ține mai multe zile");

  /*
   * Trei zile pornind de azi, ca să cadă în săptămâna pe care o arată banda
   * de capacitate — acolo se vede că orele se împart, nu se îngrămădesc.
   */
  const spanStart = new Date();
  const dayOne = spanStart.toISOString().slice(0, 10);
  const dayThree = new Date(spanStart.getTime() + 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").waitFor({ timeout: 15000 });
  await page.getByPlaceholder("Montaj scară stejar").fill("Scară de trei zile (test)");
  await page.locator("#job-date").fill(dayOne);
  await page.locator("#job-end-date").fill(dayThree);
  await page.locator("#job-hours").fill("24");
  await page.locator("#job-price").fill("20000");
  await page.getByRole("button", { name: /Creează lucrarea/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });
  const longJobUrl = page.url();
  check("lucrarea poate ține mai multe zile", true);
  check(
    "fișa spune din câte zile e făcută",
    await seen(page.getByText(/3 zile, până pe/i)),
  );

  /*
   * Cifra care mințea: 24 de ore stăteau toate pe prima zi, deci săptămâna
   * ieșea suprarezervată luni și liberă marți-miercuri. Acum se împart.
   */
  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle" });
  await page.getByText("Săptămâna asta").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const strip = await page
    .locator("button[aria-label^='Blochează ziua'], button[aria-label^='Eliberează ziua']")
    .allInnerTexts();
  check(
    "orele se împart pe zilele lucrării, nu stau toate pe prima",
    !strip.some((text) => text.includes("24")),
    `banda zilelor: ${strip.join(" | ")}`,
  );
  check(
    "fiecare zi a lucrării primește partea ei",
    strip.filter((text) => text.includes("8")).length >= 2,
    `banda zilelor: ${strip.join(" | ")}`,
  );

  /* ----------------------------- ziua blocată ---------------------- */
  section("Avertismentele de zi");

  await page.goto(`${jobUrl}/editare`, { waitUntil: "networkidle" });
  await page.locator("#job-title").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const todayForBlock = new Date().toISOString().slice(0, 10);
  await page.locator("#job-date").fill(todayForBlock);
  await page.getByRole("button", { name: /Salvează/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}$/, { timeout: 15000 });

  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle" });
  const blockToday2 = page.getByRole("button", { name: `Blochează ziua de ${todayForBlock}` });
  await blockToday2.waitFor({ timeout: 15000 });
  await blockToday2.click();
  check(
    "blocând o zi cu lucrări, se spune că rămân acolo",
    await seen(page.getByText(/rămâne programată atunci|rămân programate atunci/i)),
  );
  await page.getByRole("button", { name: `Eliberează ziua de ${todayForBlock}` }).click();
  await page.waitForTimeout(800);

  /* ----------------------------- adrese multiple ------------------- */
  section("Clientul cu mai multe adrese");

  await page.goto(`${BASE}/clienti`, { waitUntil: "networkidle" });
  await page.getByText("Ion Popescu (test)").first().click();
  await page.waitForURL(/\/clienti\/[0-9a-f-]{36}/, { timeout: 15000 });
  await page.getByRole("button", { name: /Editează/i }).first().click();
  const addrDialog = page.getByRole("dialog");
  await addrDialog.getByRole("button", { name: /Încă o adresă/i }).waitFor({ timeout: 10000 });
  await addrDialog.getByRole("button", { name: /Încă o adresă/i }).click();
  await addrDialog.getByLabel("Numele adresei 1", { exact: true }).fill("Apartamentul 2");
  await addrDialog.getByLabel("Adresa 1", { exact: true }).fill("str. Dacia 12, ap. 2");
  await addrDialog.getByRole("button", { name: /Salvează/i }).click();
  await addrDialog.waitFor({ state: "hidden", timeout: 10000 });
  check("clientul poate avea mai multe adrese", true);

  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").waitFor({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /Ion Popescu \(test\)/ }).click();
  await page.waitForTimeout(800);
  const pickAddress = page.getByRole("button", { name: /Apartamentul 2/ });
  await pickAddress.waitFor({ timeout: 10000 });
  check("adresele știute apar ca butoane pe lucrare", true);
  await pickAddress.click();
  check(
    "adresa aleasă intră în câmp, fără s-o retastezi",
    (await page.locator("#job-address").inputValue()) === "str. Dacia 12, ap. 2",
  );

  /* ----------------------------- pusă pe pauză --------------------- */
  section("Lucrarea pusă pe pauză");

  await page.goto(`${longJobUrl}/editare`, { waitUntil: "networkidle" });
  await page.locator("#job-title").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const statusSelect2 = page.getByRole("combobox").last();
  await statusSelect2.click();
  await page.getByRole("option", { name: /^În așteptare$/ }).click();
  await page.getByRole("button", { name: /Salvează/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}$/, { timeout: 15000 });
  check(
    "lucrarea se poate pune în așteptare",
    await seen(page.getByText("În așteptare")),
  );

  /* ----------------------------- înapoi la furnizor ---------------- */
  section("Materialul dus înapoi la furnizor");

  await page.goto(`${jobUrl}?tab=materiale`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Materiale/i }).click();
  await page.waitForTimeout(1200);
  const supplierButton = page.getByRole("button", { name: /ai dus ceva înapoi la furnizor/i });
  await supplierButton.first().waitFor({ timeout: 10000 });
  check("materialul cumpărat poate fi dus înapoi la furnizor", true);

  await supplierButton.first().click();
  const supplierInput = page.getByLabel(/Cât ai dus înapoi din/i);
  await supplierInput.waitFor({ timeout: 10000 });
  await supplierInput.fill("2");
  await page.getByRole("button", { name: /^Notează$/ }).click();
  await page.getByText(/de recuperat/i).first().waitFor({ timeout: 10000 });
  check("se notează cât ai de recuperat", true);

  await page.goto(`${BASE}/finante`, { waitUntil: "networkidle" });
  await page.getByText("De recuperat de la furnizor").first().waitFor({ timeout: 15000 });
  check("banii de recuperat se văd în finanțe, nu se pierd", true);

  /* ----------------------------- restanța pe vechime --------------- */
  section("Restanțele pe vechime și ce-a rămas neînchis");

  // O lucrare finalizată, cu preț și fără niciun ban încasat: exact cazul pe
  // care „Plată restantă” îl semnala fără să spună niciodată de când.
  await page.goto(`${BASE}/lucrari/nou`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Montaj scară stejar").fill("Restanță veche (test)");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /Ion Popescu \(test\)/ }).click();
  await page.locator("#job-price").fill("4000");
  await page.getByRole("button", { name: /Creează lucrarea/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}/, { timeout: 15000 });
  const debtUrl = page.url();

  // Statusul se pune de pe pagina de editare, unde selectul lui e ultimul —
  // la creare, formularul are un câmp în plus și ordinea nu mai ține.
  await page.goto(`${debtUrl}/editare`, { waitUntil: "networkidle" });
  await page.locator("#job-title").waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: /^Finalizată$/ }).click();
  await page.getByRole("button", { name: /Salvează/i }).click();
  await page.waitForURL(/\/lucrari\/[0-9a-f-]{36}$/, { timeout: 15000 });
  check("lucrarea finalizată fără plată s-a creat", true);

  await page.goto(`${BASE}/finante`, { waitUntil: "networkidle" });
  check(
    "restanțele se văd împărțite pe vechime",
    await seen(page.getByText("De încasat, pe vechime")),
  );
  check(
    "restanța de azi e trecută ca proaspătă, nu ca veche",
    await seen(page.getByText(/de azi/i)),
  );

  // Aceeași lucrare n-are nici poză „după”, nici proces-verbal, nici bani:
  // pe tabloul de bord trebuie să apară printre cele rămase neînchise.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "ce-a rămas neînchis se adună pe prima pagină",
    await seen(page.getByText("Rămase neînchise")),
  );
  check(
    "lucrarea fără proces-verbal apare acolo",
    await seen(page.getByText("Restanță veche (test)")),
  );

  /* ----------------------------- pragul zilei ---------------------- */
  section("Pragul zilei");

  // Cheltuiala fixă a fost adăugată mai devreme, la scadențar.
  await page.goto(`${BASE}/finante`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Fixe/i }).click();
  check(
    "cheltuielile fixe se întorc ca prag pe zi",
    await seen(page.getByText("Pragul zilei")),
  );
  check(
    "pragul spune din ce iese",
    await seen(page.getByText(/zile lucrătoare/i)),
  );

  /* ----------------------------- raftul care doarme ---------------- */
  section("Materialul care doarme pe raft");

  // Materialul din testul ăsta a fost adăugat adineauri, deci NU are voie să
  // apară ca adormit. Verificarea e pe negativ dinadins: o listă care ar
  // striga „stă de mult” despre ce-ai cumpărat azi ar fi mai rea decât una
  // care lipsește.
  await page.goto(`${BASE}/materiale`, { waitUntil: "networkidle" });
  await page.getByText("Parchet stejar (test)").first().waitFor({ timeout: 15000 });
  check(
    "materialul proaspăt nu e trecut ca adormit",
    (await page.getByText("Stă pe raft de mult").count()) === 0,
  );

  /* ----------------------------- desenul scării -------------------- */
  section("Fotografia devine desen tehnic");

  await page.goto(`${BASE}/design`, { waitUntil: "networkidle" });
  check(
    "pagina Design se deschide",
    await seen(page.getByRole("heading", { name: "Design" })),
  );
  check(
    "cere o fotografie înainte de orice",
    await seen(page.getByRole("button", { name: /Încarcă fotografia/i })),
  );

  /*
   * O „scară” desenată pe loc: dungi orizontale la distanțe egale. Nu e o
   * fotografie adevărată, dar are exact ce caută citirea — muchii lungi,
   * paralele și regulate — iar aici se știe răspunsul corect, ceea ce pe o
   * poză de pe telefon n-ar fi adevărat.
   */
  const stairPng = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 450;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#222222";
    ctx.fillRect(0, 0, 600, 450);
    ctx.strokeStyle = "#eeeeee";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const y = 40 + i * 48;
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(540, y);
      ctx.stroke();
    }
    return canvas.toDataURL("image/png").split(",")[1];
  });

  await page.setInputFiles('input[type="file"]', {
    name: "scara.png",
    mimeType: "image/png",
    buffer: Buffer.from(stairPng, "base64"),
  });
  await page.getByRole("button", { name: /Generează desenul/i }).waitFor({ timeout: 15000 });
  check("fotografia intră în canvas", true);

  await page.getByRole("button", { name: /Generează desenul/i }).click();
  check(
    "din opt muchii ies șapte trepte",
    await seen(page.getByText(/7 trepte detectate/), 20000),
  );
  check(
    "se spune răspicat că desenul e estimativ până la calibrare",
    await seen(page.getByText(/Estimativ — necalibrat/i)),
  );

  await page.getByRole("button", { name: /^Unelte$/ }).click();
  check(
    "uneltele se trag de jos pe telefon",
    await seen(page.getByRole("heading", { name: "Treptele" })),
  );
  check(
    "măsurile stau în unități cât timp nu e calibrat",
    await seen(page.getByText(/\d+ u × \d+ u/)),
  );
  check(
    "încrederea detectării e afișată",
    await seen(page.getByText(/Încredere/i)),
  );

  // Desenul e vectorial, deci se poate scoate ca atare.
  check(
    "exportul SVG e disponibil",
    await page.getByRole("button", { name: "SVG", exact: true }).isEnabled(),
  );

  /*
   * Aici pânza e masă de lucru — pe ea tragi muchiile treptelor — deci n-o pot
   * strînge cât să încapă tot pe un ecran fără s-o fac nefolosibilă. Butoanele
   * ei stau sub desen și ajungi la ele derulând, ceea ce e în regulă. Ce nu e
   * în regulă e să rămână sub meniul fix și după ce ai derulat până la capăt:
   * atunci se văd, dar nu se mai pot apăsa.
   */
  await page.getByRole("button", { name: /^Ascunde uneltele$/ }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  const navFoto = await page.evaluate(() => {
    const nav = document.querySelector("nav.fixed, nav[class*='fixed']");
    return nav ? nav.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
  });
  const salvFoto = await page.getByRole("button", { name: "Salvează" }).first().boundingBox();
  check(
    "butoanele desenului din fotografie se pot apăsa după ce derulezi",
    salvFoto.y >= 0 && salvFoto.y + salvFoto.height <= navFoto,
    `butonul stă între ${Math.round(salvFoto.y)} și ${Math.round(salvFoto.y + salvFoto.height)}, meniul începe la ${Math.round(navFoto)}`,
  );

  /* --------------------- scara desenată din cifre ------------------- */
  section("Scara desenată din cifre");

  /*
   * Drumul celălalt spre desen, și motivul pentru care există: o fotografie are
   * un singur punct de vedere, deci nu spune cât e scara de lată, cât intră în
   * perete și în ce parte se cotește. Din cifre ies toate patru vederile
   * deodată, potrivite între ele — inclusiv fără nicio poză, ceea ce se
   * verifică aici pornind de la pagina goală.
   */
  await page.goto(`${BASE}/design`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Din cifre" }).click();
  await page.locator("canvas").first().waitFor({ timeout: 10000 });
  check("planșa se face fără nicio fotografie", await seen(page.locator("canvas").first()));

  await page.getByRole("button", { name: "Cifrele scării" }).click();
  check("cifrele scării se trag de jos", await seen(page.getByText("Înălțime totală")));

  const totalRise = page.getByText("Înălțime totală").locator("..").locator("input").first();
  const stepCount = page.getByText("Număr de trepte").locator("..").locator("input").first();
  check("cifrele se citesc întregi în câmp", (await totalRise.inputValue()) === "2800");

  // 2800 pe 16 trepte face 175 mm — cifra trebuie să iasă singură.
  check("înălțimea treptei se socotește singură", await seen(page.getByText("175 mm")));

  await stepCount.fill("10");
  check("o scară abruptă o spune pe față", await seen(page.getByText(/se urcă greu/), 5000));

  await stepCount.fill("16");
  await expectValue(stepCount, "16", 5000);

  const before = await page.locator("canvas").first().screenshot();
  await page.getByRole("button", { name: "Rotește" }).click();
  await page.waitForTimeout(400);
  const after = await page.locator("canvas").first().screenshot();
  check("vederea 3D se rotește", !before.equals(after));

  /*
   * Două hârtii pentru doi oameni: cea de lemn pleacă la client, cea tehnică la
   * debitat. Geometria e aceeași — se verifică aici că se schimbă doar cerneala,
   * adică se schimbă ceva pe ecran, dar planșa rămâne planșă.
   */
  const wood = await page.locator("canvas").first().screenshot();
  await page.getByRole("button", { name: "Desen tehnic" }).click();
  await page.waitForTimeout(400);
  const ink = await page.locator("canvas").first().screenshot();
  check("cerneala se schimbă între lemn și desen tehnic", !wood.equals(ink));
  await page.getByRole("button", { name: "Lemn" }).click();

  // Muchia treptei: cu nas sau dreaptă, fără buza care iese peste contratreaptă.
  check("nasul are câmpul lui cât timp există", await seen(page.getByText("Ieșire nas")));
  await page.getByText("Muchia treptei").locator("..").getByRole("combobox").click();
  await page.getByRole("option", { name: /Muchie dreaptă/ }).click();
  await page.waitForTimeout(500);
  check(
    "fără nas, câmpul lui dispare cu totul",
    !(await page.getByText("Ieșire nas").isVisible()),
  );

  /*
   * Pereții casei scării: din ei iese colțul pe care se taie treptele în
   * evantai, deci se verifică și că se pot scoate, nu doar că există.
   */
  const withWalls = await page.locator("canvas").first().screenshot();
  await page.getByText("Pereții casei scării").locator("..").locator('button[role="switch"]').click();
  await page.waitForTimeout(500);
  check(
    "pereții se pot scoate de pe planșă",
    !withWalls.equals(await page.locator("canvas").first().screenshot()),
  );

  check(
    "planșa se exportă ca PDF",
    await page.getByRole("button", { name: "PDF" }).isEnabled(),
  );

  /*
   * Talpa de beton: scara turnată are sub trepte o placă înclinată, așa cum se
   * vede în secțiunea unui constructor. Se verifică pe planșă, nu în formular.
   */
  const faraBeton = await page.locator("canvas").first().screenshot();
  await page.getByText("Talpă de beton").locator("..").locator('button[role="switch"]').click();
  await page.waitForTimeout(500);
  check(
    "talpa de beton se vede pe planșă",
    !faraBeton.equals(await page.locator("canvas").first().screenshot()),
  );
  check("grosimea tălpii se poate schimba", await seen(page.getByText("Grosimea tălpii")));

  /*
   * Degetul pe planșă. Trei lucruri se pot strica separat, deci se verifică
   * separat:
   *
   *  1. mijlocul desenului chiar e desenul. O bară lipită de marginea de jos se
   *     ridică peste ce e înaintea ei în pagină, adică peste planșă, și înghite
   *     atingerea fără să se vadă de ce: desenul se vede, dar nu-l poți mișca.
   *  2. un deget îl mută;
   *  3. două degete îl măresc.
   *
   * Atingerile se trimit prin CDP, fiindcă `mouse` nu naște `pointerdown` cu
   * două degete și n-ar verifica tocmai ce s-a stricat pe telefon.
   */
  // Cum stă omul de fapt: cu panoul de cifre strîns, ca să vadă desenul mare.
  // Cu panoul deschis pagina e lungă și orice bară lipită plutește peste
  // formular, nu peste planșă — adică exact cazul în care greșeala nu se vede.
  await page.getByRole("button", { name: "Ascunde cifrele" }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const sheetBox = await page.locator("canvas").first().boundingBox();
  const mx = sheetBox.x + sheetBox.width / 2;
  const my = sheetBox.y + sheetBox.height / 2;
  const subDeget = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.tagName ?? "nimic",
    [mx, my],
  );
  check("mijlocul planșei e planșa, nu altceva peste ea", subDeget === "CANVAS", `am găsit ${subDeget}`);

  // Marginea de jos a planșei trebuie să rămână deasupra meniului fix.
  const navSus = await navTop(page);
  check(
    "planșa se termină deasupra meniului de jos",
    sheetBox.y + sheetBox.height <= navSus,
    `planșa ajunge la ${Math.round(sheetBox.y + sheetBox.height)}, meniul începe la ${Math.round(navSus)}`,
  );

  /*
   * Butoanele planșei trebuie să rămână deasupra meniului fix. Altfel planșa le
   * împinge sub el și nu se mai pot apăsa: desenul se vede, dar nu-l mai poți
   * roti, schimba ori salva. Se verifică ultimul buton, cel mai de jos.
   */
  const salveaza = await page.getByRole("button", { name: "Salvează" }).first().boundingBox();
  check(
    "butoanele planșei rămân deasupra meniului de jos",
    salveaza.y + salveaza.height <= navSus,
    `butonul ajunge la ${Math.round(salveaza.y + salveaza.height)}, meniul începe la ${Math.round(navSus)}`,
  );

  // Butonul rotund de adăugare plutește fix deasupra meniului, aproape de
  // Salvează. Dacă ajunge peste el, apăsarea deschide altceva.
  const subSalveaza = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.textContent?.trim() ?? "nimic",
    [salveaza.x + salveaza.width / 2, salveaza.y + salveaza.height / 2],
  );
  check(
    "mijlocul butonului Salvează e chiar el",
    subSalveaza === "Salvează",
    `sub deget am găsit „${subSalveaza}”`,
  );

  const touch = await page.context().newCDPSession(page);
  const drawn = () => page.locator("canvas").first().screenshot();
  const finger = (type, points) =>
    touch.send("Input.dispatchTouchEvent", { type, touchPoints: points });

  const inainteDeMutare = await drawn();
  await finger("touchStart", [{ x: mx, y: my, id: 1 }]);
  for (let i = 1; i <= 5; i++) await finger("touchMove", [{ x: mx + i * 10, y: my + i * 5, id: 1 }]);
  await finger("touchEnd", []);
  await page.waitForTimeout(400);
  check("planșa se mută cu un deget", !inainteDeMutare.equals(await drawn()));

  const inainteDeMarire = await drawn();
  const pair = (gap) => [
    { x: mx - gap, y: my, id: 1 },
    { x: mx + gap, y: my, id: 2 },
  ];
  await finger("touchStart", pair(50));
  for (let i = 1; i <= 5; i++) await finger("touchMove", pair(50 + i * 12));
  await finger("touchEnd", []);
  await page.waitForTimeout(400);
  check("planșa se mărește cu două degete", !inainteDeMarire.equals(await drawn()));

  /* ----------------------------- zona sigură ----------------------- */
  section("Zona sigură (telefon cu aplicația instalată)");

  // Aplicația instalată desenează pagina până sub bara de stare și sub bara de
  // gesturi. Emulăm marginile astea prin CDP — altfel `env(safe-area-inset-*)`
  // e mereu 0 în browserul de test și n-am verifica nimic.
  const INSET_TOP = 48;
  const INSET_BOTTOM = 34;
  const safeContext = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "ro-RO",
  });
  const safePage = await safeContext.newPage();
  let safeEmulated = false;
  try {
    const cdp = await safeContext.newCDPSession(safePage);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: INSET_TOP, left: 0, right: 0, bottom: INSET_BOTTOM },
    });
    safeEmulated = true;
  } catch (error) {
    console.log(`  ! emularea zonei sigure nu e disponibilă în acest Chromium: ${error.message.split("\n")[0]}`);
  }

  if (safeEmulated) {
    await safePage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const loginPadding = await safePage.evaluate(
      () => parseFloat(getComputedStyle(document.querySelector(".aurora")).paddingTop) || 0,
    );
    check(
      "ecranul de autentificare coboară sub bara de stare",
      loginPadding >= INSET_TOP,
      `padding-top=${loginPadding}px, bara are ${INSET_TOP}px`,
    );

    await safePage.getByRole("button", { name: /Continuă în mod local/i }).click();
    await safePage.waitForURL(`${BASE}/`, { timeout: 15000 });
    await safePage.locator("header").first().waitFor({ timeout: 15000 });

    const headerBox = await safePage.locator("header").first().boundingBox();
    const firstControl = await safePage.locator("header svg").first().boundingBox();
    check(
      "antetul acoperă bara de stare",
      headerBox.y <= 0.5 && headerBox.height > INSET_TOP,
      `y=${headerBox?.y}, h=${headerBox?.height}`,
    );
    check(
      "conținutul antetului rămâne sub bara de stare",
      firstControl.y >= INSET_TOP,
      `primul element la y=${firstControl?.y}, bara are ${INSET_TOP}px`,
    );

    // `nav:visible` = bara de jos; bara laterală e tot un `nav`, dar ascuns pe telefon.
    const viewportHeight = safePage.viewportSize().height;
    const navLabel = await safePage.locator("nav:visible a span").last().boundingBox();
    const navBottom = navLabel.y + navLabel.height;
    check(
      "bara de jos rămâne deasupra barei de gesturi",
      navBottom <= viewportHeight - INSET_BOTTOM,
      `text până la y=${navBottom}, ecranul are ${viewportHeight}px, bara ${INSET_BOTTOM}px`,
    );
  }
  await safeContext.close();

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
