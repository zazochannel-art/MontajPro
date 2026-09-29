/**
 * Planșa: aceeași scară, din patru părți, plus detaliul treptei.
 *
 * Vederile nu se desenează separat. Toate ies din același corp, privit din alt
 * loc — de aceea nu se pot contrazice. Dacă schimbi adâncimea treptei, se mișcă
 * și planul, și fața, și izometricul, în același timp și cu aceeași cifră. Un
 * desen tehnic în care vederile se contrazic e mai rău decât niciun desen:
 * omul taie după una din ele.
 *
 * Ce iese de aici e o descriere, nu pixeli: poligoane, linii și texte în
 * milimetri. Canvas-ul o desenează pe ecran, SVG-ul și PDF-ul o scriu pe
 * hârtie, din aceleași cifre. Nicăieri o captură de ecran.
 */
import { faceSet } from "./solid";
import type { FaceKind, Tone, Vec2, ViewName } from "./solid";
import { bestAzimuth, buildStair, footprint, outlineCenter } from "./stair-solid";
import type { StairBuild } from "./stair-solid";
import { derive, normalizeSpec } from "./stair-spec";
import type { StairSpec } from "./stair-spec";

export type Weight = "main" | "detail";

/**
 * Cum se scrie planșa: cu cerneală sau cu lemn.
 *
 * Nu e o schimbare de gust, ci două hârtii pentru doi oameni. Cea tehnică
 * pleacă la debitat, unde negru pe alb e singurul lucru care se citește lângă
 * un ferăstrău. Cea de lemn pleacă la client, unde o scară trebuie să arate a
 * scară, nu a schiță. Geometria e aceeași; se schimbă numai cerneala.
 */
export const FINISHES = ["tehnic", "lemn"] as const;
export type Finish = (typeof FINISHES)[number];

/**
 * Culorile planșei, scrise o singură dată.
 *
 * Canvas-ul, SVG-ul și PDF-ul citesc de aici. Dacă fiecare și-ar ține culorile
 * lui, planșa de pe ecran și cea de pe hârtie ar începe să se depărteze una de
 * alta pe nesimțite, iar clientul ar primi altceva decât a văzut.
 */
export interface Palette {
  paper: string;
  outline: string;
  /** Liniile de cotă. */
  thin: string;
  text: string;
  frame: string;
  warn: string;
  fill: Record<Tone, string>;
  /** Zidăria. Nu e lemn, deci nici culoare de lemn, nici fibră. */
  wall: Record<Tone, string>;
  /** Firul lemnului. `null` pe desenul tehnic: acolo n-are ce căuta. */
  grain: Record<Tone, string> | null;
  /** Grosimea liniilor. Lemnul se desenează mai subțire decât cerneala. */
  weight: Record<Weight, number>;
}

export const PALETTES: Record<Finish, Palette> = {
  tehnic: {
    paper: "#ffffff",
    outline: "#09090b",
    thin: "#52525b",
    text: "#18181b",
    frame: "#d4d4d8",
    warn: "#b45309",
    // Alb plin, nu transparent: treapta din față trebuie s-o acopere pe cea din spate.
    fill: { sus: "#ffffff", fata: "#ffffff", lateral: "#ffffff" },
    wall: { sus: "#ffffff", fata: "#ffffff", lateral: "#ffffff" },
    grain: null,
    weight: { main: 2, detail: 0.6 },
  },
  lemn: {
    paper: "#f5f1e8",
    outline: "#6b4423",
    thin: "#8a6a4a",
    text: "#3f2d1c",
    frame: "#e2d7c4",
    warn: "#a8510b",
    /*
     * Trei tonuri de stejar, nu unul singur. Fața de sus prinde lumina, cea din
     * față o prinde pieziș, cea laterală stă în umbră — exact regula după care
     * ochiul citește un obiect ca fiind solid. Cu o singură culoare, scara ar
     * arăta ca un decupaj din carton maro.
     */
    fill: { sus: "#e3b887", fata: "#cd9a5d", lateral: "#a97a45" },
    // Tencuială rece, ca lemnul să iasă în față. Aceleași trei trepte de lumină.
    wall: { sus: "#c3c6b6", fata: "#adb1a0", lateral: "#949889" },
    grain: { sus: "#c9a06f", fata: "#b4834a", lateral: "#96693a" },
    /*
     * Contur subțire pe lemn, gros pe desenul tehnic.
     * Aceeași linie care pe o planșă alb-negru se vede de la doi metri, pe un
     * desen colorat îl face să arate ca un personaj de desen animat: culoarea
     * duce deja forma, iar conturul n-are decât s-o așeze.
     */
    weight: { main: 1.1, detail: 0.55 },
  },
};

export interface SheetPolygon {
  points: Vec2[];
  weight: Weight;
  /** La ce parte din scară ține fața. */
  kind: FaceKind;
  /** Încotro privește fața. Din el iese umbra, în desenul cu lemn. */
  tone: Tone;
  /**
   * Cât de deschisă e fața asta față de tonul ei, cam între -3 și 3.
   *
   * Adună două lucruri: din ce scândură e tăiat blatul, și dacă stă sau nu în
   * umbra cuiva.
   */
  variant: number;
  /** Firul lemnului, ca linii — ca să rămână vector și în PDF. */
  grain: { a: Vec2; b: Vec2 }[];
}

export interface SheetLine {
  a: Vec2;
  b: Vec2;
  weight: Weight;
}

export type TextRole = "cota" | "numar" | "titlu";

export interface SheetText {
  at: Vec2;
  value: string;
  role: TextRole;
  anchor: "start" | "middle" | "end";
}

export interface Pane {
  id: string;
  title: string;
  polygons: SheetPolygon[];
  lines: SheetLine[];
  texts: SheetText[];
}

export interface Sheet {
  title: string;
  panes: Pane[];
  /** Gabaritul, scris o dată în indicatorul de jos. */
  footprint: { width: number; run: number; height: number };
  /** Ce nu e în regulă cu proporțiile. Se scrie pe planșă, nu se ascunde. */
  warnings: string[];
  /** Din ce parte e privită scara în izometric, în radiani. */
  azimuth: number;
}

export interface Box2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Milimetri, peste tot.
 *
 * Nicăieri centimetri, nici măcar la cotele mari: o planșă cu două unități pe
 * ea e felul în care cineva citește 21,3 și taie 213. Atelierul lucrează în
 * milimetri, așa că planșa vorbește în milimetri.
 */
export function mm(value: number): string {
  return `${Math.round(value)} mm`;
}

function unit(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

function shift(p: Vec2, dir: Vec2, distance: number): Vec2 {
  return { x: p.x + dir.x * distance, y: p.y + dir.y * distance };
}

export interface DimensionStyle {
  /** Cât de lungi sunt liniuțele oblice de la capete. */
  tick: number;
  /** Cât trec liniile ajutătoare dincolo de linia de cotă. */
  overrun: number;
}

/**
 * O cotă între două puncte, în stilul de pe planșele de tâmplărie.
 *
 * Linii ajutătoare din piesă până dincolo de linia de cotă, liniuțe oblice la
 * capete în loc de săgeți — se citesc la fel și când desenul e micșorat pe
 * telefon — și cifra la mijloc, mereu orizontală. Textul nu se rotește nici pe
 * cotele verticale: pe hârtie se citește cu capul drept.
 *
 * `offset` are semn, și semnul contează: normala e la stânga direcției, deci o
 * cotă trasă de jos în sus are pozitivul spre interiorul desenului. Cine cheamă
 * funcția alege partea; aici nu se ghicește, fiindcă o cotă căzută peste piesă
 * e o cotă pe care n-o citește nimeni.
 */
export function dimension(
  from: Vec2,
  to: Vec2,
  offset: number,
  label: string,
  style: DimensionStyle,
): { lines: SheetLine[]; texts: SheetText[] } {
  const along = unit(from, to);
  const normal: Vec2 = { x: -along.y, y: along.x };

  const a = shift(from, normal, offset);
  const b = shift(to, normal, offset);
  const past = offset >= 0 ? style.overrun : -style.overrun;

  const lines: SheetLine[] = [
    { a, b, weight: "detail" },
    { a: from, b: shift(from, normal, offset + past), weight: "detail" },
    { a: to, b: shift(to, normal, offset + past), weight: "detail" },
  ];

  // Liniuțele oblice: la 45° față de linia de cotă, adică along + normal.
  const tick: Vec2 = {
    x: (along.x + normal.x) * style.tick * 0.5,
    y: (along.y + normal.y) * style.tick * 0.5,
  };
  lines.push({
    a: { x: a.x - tick.x, y: a.y - tick.y },
    b: { x: a.x + tick.x, y: a.y + tick.y },
    weight: "detail",
  });
  lines.push({
    a: { x: b.x - tick.x, y: b.y - tick.y },
    b: { x: b.x + tick.x, y: b.y + tick.y },
    weight: "detail",
  });

  const middle: Vec2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // Cifra stă dincolo de linie, în aceeași parte în care a fost trasă cota.
  const away = offset >= 0 ? style.tick * 1.6 : -style.tick * 1.6;
  const texts: SheetText[] = [
    { at: shift(middle, normal, away), value: label, role: "cota", anchor: "middle" },
  ];

  return { lines, texts };
}

/** Cam un fir la fiecare atâția milimetri de lățime de piesă. */
const GRAIN_EVERY = 32;
const GRAIN_MIN = 2;
const GRAIN_MAX = 8;

/**
 * Zgomot statornic: aceeași intrare, aceeași cifră, de fiecare dată.
 *
 * Fără „statornic” n-ar merge nimic din ce urmează: planșa s-ar redesena
 * altfel la fiecare cadru, exportul n-ar semăna cu ecranul, iar testul care
 * cere ca aceleași cifre să dea aceeași planșă ar pica pe bună dreptate.
 */
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/** Un ton mutat spre deschis sau spre închis, cu `amount` între -1 și 1. */
function shade(hex: string, amount: number): string {
  const value = parseInt(hex.replace("#", ""), 16);
  const parts = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * (1 + amount)))),
  );
  return `#${parts.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Culoarea unei fețe: tonul ei, plus abaterea blatului ăstuia.
 *
 * Într-o scară adevărată nu există două blaturi la fel — sunt tăiate din
 * scânduri diferite, iar ochiul vede asta chiar când nu știe ce vede. O scară
 * desenată cu o singură culoare pe fiecare orientare arată turnată dintr-o
 * bucată de plastic. Abaterea e mică, cât să nu pară o greșeală de culoare.
 *
 * Pe desenul tehnic nu se întâmplă nimic: acolo umplerea albă are o treabă
 * anume — să acopere treapta din spate — și orice nuanță i-ar sta în drum.
 */
export function fillOf(ink: Palette, kind: FaceKind, tone: Tone, variant: number): string {
  const base = kind === "perete" ? ink.wall[tone] : ink.fill[tone];
  if (!ink.grain) return base;
  // Zidul n-are scânduri, deci n-are de ce să difere de la o bucată la alta.
  if (kind === "perete") return base;
  return shade(base, Math.max(-3, Math.min(3, variant)) * 0.05);
}

/** Grosimea unei linii în cerneala dată. */
export function strokeOf(ink: Palette, weight: Weight): number {
  return ink.weight[weight];
}

/** Cât de deschis e blatul treptei a n-a. Statornic, ca desenul să nu tremure. */
export function variantOf(step: number): number {
  return (noise(step * 1.7 + 0.3) - 0.5) * 2;
}

/**
 * Cât întunecă umbra o contratreaptă.
 *
 * Nu e o alegere de culoare, ci o umbră adevărată: contratreapta stă retrasă
 * sub nasul treptei de deasupra, deci primește mai puțină lumină decât muchia
 * care iese peste ea. Fără asta, muchia blatului și contratreapta ies în
 * aceeași nuanță și se lipesc într-o singură bandă lată — de aceea scara părea
 * făcută din blaturi care plutesc, în loc de trepte cu contratreaptă.
 */
const RISER_SHADOW = -2.4;

/**
 * Firul lemnului peste o față, ca linii tăiate exact pe conturul ei.
 *
 * Firele merg în lungul laturii lungi, fiindcă așa se debitează un blat: pe
 * fibră, nu de-a curmezișul. Sunt linii adevărate, nu o umplutură cu poză — de
 * aceea PDF-ul rămâne vector și se poate mări fără să se îmbâcsească.
 *
 * Câte sunt iese din lățimea piesei, nu dintr-o cifră fixă: patru fire pe o
 * treaptă de 28 cm arată rar, iar patru pe un blat de 4 cm arată ca un gard.
 * Și nu stau la distanțe egale — lemnul crescut la rigla nu există, iar ochiul
 * recunoaște imediat șirul perfect ca fiind desenat de o mașină.
 *
 * Tăierea se face pe fiecare latură: fața e un patrulater convex, deci o
 * dreaptă o taie în exact două puncte, iar între ele stă firul.
 */
export function grainLines(points: Vec2[], count?: number): { a: Vec2; b: Vec2 }[] {
  if (points.length < 3) return [];

  // Latura cea mai lungă dă direcția fibrei.
  let dir: Vec2 = { x: 1, y: 0 };
  let longest = 0;
  for (let i = 0; i < points.length; i += 1) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length > longest) {
      longest = length;
      dir = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    }
  }
  if (longest < 1e-6) return [];

  const normal: Vec2 = { x: -dir.y, y: dir.x };
  let low = Infinity;
  let high = -Infinity;
  for (const point of points) {
    const along = point.x * normal.x + point.y * normal.y;
    if (along < low) low = along;
    if (along > high) high = along;
  }
  const span = high - low;
  if (span < 1e-6) return [];

  const lines =
    count ?? Math.max(GRAIN_MIN, Math.min(GRAIN_MAX, Math.round(span / GRAIN_EVERY)));
  // Sămânța iese din locul feței, ca aceeași față să aibă mereu același fir.
  const seed = points[0].x * 0.37 + points[0].y * 0.71;
  const gap = span / (lines + 1);

  const out: { a: Vec2; b: Vec2 }[] = [];
  for (let i = 1; i <= lines; i += 1) {
    // Abaterea nu trece de o treime din pas: altfel firele se suprapun.
    const wobble = (noise(seed + i * 7.13) - 0.5) * gap * 0.66;
    const offset = low + gap * i + wobble;
    const hits: Vec2[] = [];

    for (let e = 0; e < points.length; e += 1) {
      const from = points[e];
      const to = points[(e + 1) % points.length];
      const fromSide = from.x * normal.x + from.y * normal.y - offset;
      const toSide = to.x * normal.x + to.y * normal.y - offset;
      if (fromSide === toSide) continue;
      const t = fromSide / (fromSide - toSide);
      if (t < 0 || t > 1) continue;
      hits.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }

    if (hits.length < 2) continue;
    // Capetele firului: cele două tăieturi cele mai depărtate una de alta.
    let a = hits[0];
    let b = hits[1];
    let widest = -1;
    for (let i0 = 0; i0 < hits.length; i0 += 1) {
      for (let i1 = i0 + 1; i1 < hits.length; i1 += 1) {
        const length = Math.hypot(hits[i1].x - hits[i0].x, hits[i1].y - hits[i0].y);
        if (length > widest) {
          widest = length;
          a = hits[i0];
          b = hits[i1];
        }
      }
    }
    if (widest > 1e-6) out.push({ a, b });
  }

  return out;
}

function extentOf(pane: Pane, skipWalls = false): Box2 | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const eat = (p: Vec2) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const polygon of pane.polygons) {
    if (skipWalls && polygon.kind === "perete") continue;
    polygon.points.forEach(eat);
  }
  for (const line of pane.lines) {
    eat(line.a);
    eat(line.b);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Cât de mari sunt liniuțele de cotă pentru un desen de mărimea asta.
 *
 * Proporțional cu piesa, nu fix: aceleași liniuțe de 40 mm arată cuminte pe o
 * scară de trei metri și acoperă tot pe un detaliu de treaptă de doi
 * centimetri. Fiindcă fiecare panou se încadrează apoi într-un chenar cam de
 * aceeași mărime, o fracțiune din piesă ajunge pe hârtie tot cam la fel — și
 * cotele arată la fel pe toată planșa, deși scările lor diferă de zece ori.
 */
function styleFor(box: Box2): DimensionStyle {
  const size = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  return { tick: size * 0.022, overrun: size * 0.03 };
}

/** Cât de departe de piesă trece prima cotă, a doua, a treia. */
function gapFor(box: Box2, level: number): number {
  const size = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  return size * (0.1 + 0.09 * level);
}

function viewPane(
  build: StairBuild,
  view: ViewName,
  id: string,
  title: string,
  azimuth = 0,
): Pane {
  const polygons: SheetPolygon[] = faceSet(build.solid, view, azimuth).map((face) => ({
    points: face.points,
    weight: "main",
    kind: face.kind,
    tone: face.tone,
    variant: variantOf(face.step) + (face.kind === "contratreapta" ? RISER_SHADOW : 0),
    // Fibra se vede pe fețele întoarse spre ochi; pe zid și în umbră n-are ce căuta.
    grain: face.tone === "lateral" || face.kind === "perete" ? [] : grainLines(face.points),
  }));
  return { id, title, polygons, lines: [], texts: [] };
}

/**
 * Cele două cote de gabarit ale unei vederi.
 *
 * Cea orizontală coboară sub piesă, cea verticală pleacă spre stânga — ambele
 * în afara desenului, niciodată peste el. Semnul lui `offset` iese din
 * convenția normalei: la o cotă trasă de jos în sus, afară înseamnă negativ.
 */
/**
 * Cele două cote de gabarit ale unei vederi.
 *
 * Se iau de pe scară, nu de pe zidărie: cota spune cât ține scara, iar dacă ar
 * cuprinde și zidul, cifra de pe planșă n-ar mai fi cea pe care o tai.
 */
function frameDimensions(
  pane: Pane,
  across: string,
  down: string,
): void {
  const box = extentOf(pane, true);
  if (!box) return;
  const style = styleFor(box);
  const gap = gapFor(box, 0);

  const horizontal = dimension(
    { x: box.minX, y: box.maxY },
    { x: box.maxX, y: box.maxY },
    gap,
    across,
    style,
  );
  const vertical = dimension(
    { x: box.minX, y: box.maxY },
    { x: box.minX, y: box.minY },
    -gap,
    down,
    style,
  );

  pane.lines.push(...horizontal.lines, ...vertical.lines);
  pane.texts.push(...horizontal.texts, ...vertical.texts);
}

/**
 * Detaliul treptei, în secțiune.
 *
 * Două trepte una peste alta, exact cât trebuie ca să se vadă de ce nasul e
 * nas: iese peste contratreaptă. Cotele scrise sunt cele care se dau la
 * debitat — adâncimea pe care calci și adâncimea întreagă a piesei sunt cifre
 * diferite, iar confuzia dintre ele e chiar felul în care se taie greșit un
 * blat.
 *
 * Cotele se împart pe patru laturi, câte una-două pe fiecare, fiindcă pe un
 * desen atât de mic două cote pe aceeași parte se acoperă.
 */
function detailPane(spec: StairSpec, rise: number): Pane {
  const { tread, thickness, nosing, riserThickness } = spec;

  // Piesele din detaliu sunt secțiuni prin lemn: se văd în plin, cu fibra pe lung.
  let piece = 0;
  const rect = (
    kind: FaceKind,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): SheetPolygon => {
    piece += 1;
    const points = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
    /*
     * Secțiunea nu primește umbra contratreptei: e o tăietură prin lemn, nu o
     * față luminată. Singura abatere e din ce scândură vine piesa.
     */
    return {
      points,
      weight: "main",
      kind,
      tone: "fata",
      variant: variantOf(piece),
      grain: grainLines(points),
    };
  };

  const polygons: SheetPolygon[] = [
    // Blatul de sus, cu nasul ieșit în stânga.
    rect("treapta", -nosing, 0, tread, thickness),
    // Contratreapta care coboară din spatele lui.
    rect("contratreapta", 0, thickness, riserThickness, rise),
    // Treapta de dedesubt, ca să se vadă peste ce iese nasul.
    rect("treapta", -tread - nosing, rise, 0, rise + thickness),
  ];

  const box: Box2 = {
    minX: -tread - nosing,
    minY: 0,
    maxX: tread,
    maxY: rise + thickness,
  };
  const style = styleFor(box);
  const one = gapFor(box, 0);
  const two = gapFor(box, 1);

  const lines: SheetLine[] = [];
  const texts: SheetText[] = [];
  const add = (part: { lines: SheetLine[]; texts: SheetText[] }) => {
    lines.push(...part.lines);
    texts.push(...part.texts);
  };

  /*
   * Fără nas, două dintre cote n-au ce spune: adâncimea întreagă a blatului e
   * chiar adâncimea pe care calci, iar ieșirea nasului e zero. Scrise oricum,
   * ar ieși aceeași cifră de două ori și o cotă de „0 mm” între două linii
   * suprapuse — adică un desen care pare greșit tocmai fiindcă e corect.
   */
  const hasNose = nosing > 0;

  // Deasupra: adâncimea pe care calci, apoi adâncimea întreagă a blatului.
  add(dimension({ x: 0, y: 0 }, { x: tread, y: 0 }, -one, mm(tread), style));
  if (hasNose) {
    add(dimension({ x: -nosing, y: 0 }, { x: tread, y: 0 }, -two, mm(tread + nosing), style));
  }
  // În dreapta: grosimea blatului.
  add(dimension({ x: tread, y: thickness }, { x: tread, y: 0 }, one, mm(thickness), style));
  // Dedesubt: ieșirea nasului, apoi grosimea contratreptei.
  if (hasNose) {
    add(
      dimension(
        { x: -nosing, y: rise + thickness },
        { x: 0, y: rise + thickness },
        one,
        mm(nosing),
        style,
      ),
    );
  }
  add(
    dimension(
      { x: 0, y: rise + thickness },
      { x: riserThickness, y: rise + thickness },
      hasNose ? two : one,
      mm(riserThickness),
      style,
    ),
  );
  // În stânga: înălțimea treptei.
  add(dimension({ x: -tread - nosing, y: rise }, { x: -tread - nosing, y: 0 }, -one, mm(rise), style));

  return { id: "detaliu", title: "Detaliu treaptă", polygons, lines, texts };
}

/**
 * Planșa întreagă.
 *
 * Ordinea panourilor e cea de pe o planșă adevărată: vederea din față și planul
 * răspund la „cât e”, izometricul la „cum arată”, detaliul la „cum se taie”.
 */
export function buildSheet(input: StairSpec, title = "Scară", azimuth?: number): Sheet {
  const spec = normalizeSpec(input);
  const build = buildStair(spec);
  const size = footprint(build);
  const info = derive(spec);
  // Fără unghi cerut, se ia cel din care scara se citește cel mai bine.
  const angle = azimuth === undefined ? bestAzimuth(build) : azimuth;

  const front = viewPane(build, "fata", "fata", "Vedere din față");
  frameDimensions(front, mm(size.width), mm(size.height));

  const plan = viewPane(build, "plan", "plan", "Plan (de sus)");
  for (const tread of build.treads) {
    const center = outlineCenter(tread.outline);
    plan.texts.push({ at: center, value: String(tread.step), role: "numar", anchor: "middle" });
  }
  frameDimensions(plan, mm(size.width), mm(size.run));

  // Vederea care arată panta: cea perpendiculară pe mersul scării.
  const side = viewPane(build, "lateral", "lateral", "Vedere laterală");
  frameDimensions(side, mm(size.run), mm(size.height));

  const iso = viewPane(build, "izometric", "izometric", "Vedere 3D", angle);

  return {
    title,
    panes: [front, plan, side, iso, detailPane(spec, spec.totalRise / spec.steps)],
    footprint: size,
    warnings: info.warnings,
    azimuth: angle,
  };
}

/** Cât loc ocupă un panou. Din el iese potrivirea în chenar, la desenare. */
export function paneExtent(pane: Pane): Box2 | null {
  return extentOf(pane);
}

/* ------------------------------------------------------------------ */
/* Așezarea în pagină                                                  */
/* ------------------------------------------------------------------ */

/**
 * Pagina, ca o planșă adevărată: lată pe hârtie și la calculator, înaltă pe
 * telefon. Aceeași descriere, două așezări — nu două desene.
 */
export const PAGE_WIDE = { width: 1600, height: 1000 };
export const PAGE_TALL = { width: 900, height: 1250 };

/** Cât din înălțimea paginii ține indicatorul de jos. */
const TITLE_BLOCK = 46;

/**
 * Unde stă fiecare panou, ca fracțiuni din zona de desen.
 *
 * Așezarea lată e cea de pe planșele de scări: în stânga, una sub alta,
 * vederea din față și planul — cele care răspund la „cât e”; la mijloc
 * detaliul și vederea laterală; în dreapta, mare, izometricul, fiindcă el e
 * cel la care se uită clientul.
 */
const WIDE_SLOTS: Record<string, [number, number, number, number]> = {
  fata: [0.0, 0.0, 0.34, 0.5],
  plan: [0.0, 0.5, 0.34, 0.5],
  detaliu: [0.34, 0.0, 0.28, 0.44],
  lateral: [0.34, 0.44, 0.28, 0.56],
  izometric: [0.62, 0.0, 0.38, 1.0],
};

/**
 * Pe telefon, două coloane — nu cinci panouri unul sub altul.
 *
 * O fâșie de cinci rânduri iese lungă și îngustă, iar ca s-o încapi în ecran
 * trebuie micșorată până când folosește o treime din lățime și restul rămâne
 * alb. Izometricul ia tot lățimea sus, fiindcă el se privește; celelalte patru
 * se strâng două câte două dedesubt.
 */
const TALL_SLOTS: Record<string, [number, number, number, number]> = {
  izometric: [0.0, 0.0, 1.0, 0.36],
  plan: [0.0, 0.36, 0.5, 0.32],
  lateral: [0.5, 0.36, 0.5, 0.32],
  fata: [0.0, 0.68, 0.5, 0.32],
  detaliu: [0.5, 0.68, 0.5, 0.32],
};

export interface PlacedPane {
  pane: Pane;
  /** Chenarul panoului în pagină. */
  frame: { x: number; y: number; width: number; height: number };
  /** Din milimetri în coordonatele paginii. */
  scale: number;
  tx: number;
  ty: number;
}

/** Un punct din desen, în pagină. */
export function place(placed: PlacedPane, p: Vec2): Vec2 {
  return { x: p.x * placed.scale + placed.tx, y: p.y * placed.scale + placed.ty };
}

/**
 * Planșa așezată în pagină.
 *
 * Fiecare panou se încadrează singur în chenarul lui, la scara lui — un detaliu
 * de treaptă și o scară de trei metri n-au cum să stea la aceeași scară pe
 * aceeași foaie. De asta are fiecare panou titlu: ca nimeni să nu măsoare cu
 * rigla pe planșă, ci să citească cota scrisă.
 */
export function layoutSheet(
  sheet: Sheet,
  tall: boolean,
): { page: { width: number; height: number }; panes: PlacedPane[] } {
  const page = tall ? PAGE_TALL : PAGE_WIDE;
  const drawHeight = page.height - TITLE_BLOCK;
  // Loc pentru titlul panoului, sus, și pentru aer în jur.
  const padding = 26;
  const titleSpace = 26;
  const placed: PlacedPane[] = [];

  const slots = tall ? TALL_SLOTS : WIDE_SLOTS;
  const slotOf = (id: string, index: number): [number, number, number, number] => {
    const slot = slots[id];
    if (slot) return slot;
    // Un panou pe care nu-l cunoaștem primește o bandă a lui, nu locul altuia.
    const count = Math.max(1, sheet.panes.length);
    return [0, index / count, 1, 1 / count];
  };

  sheet.panes.forEach((pane, index) => {
    const [fx, fy, fw, fh] = slotOf(pane.id, index);
    const frame = {
      x: fx * page.width,
      y: fy * drawHeight,
      width: fw * page.width,
      height: fh * drawHeight,
    };

    const box = extentOf(pane);
    if (!box) {
      placed.push({ pane, frame, scale: 1, tx: frame.x, ty: frame.y });
      return;
    }

    const contentWidth = Math.max(1, box.maxX - box.minX);
    const contentHeight = Math.max(1, box.maxY - box.minY);
    const usableWidth = Math.max(1, frame.width - padding * 2);
    const usableHeight = Math.max(1, frame.height - padding * 2 - titleSpace);
    const scale = Math.min(usableWidth / contentWidth, usableHeight / contentHeight);

    placed.push({
      pane,
      frame,
      scale,
      tx: frame.x + padding + (usableWidth - contentWidth * scale) / 2 - box.minX * scale,
      ty:
        frame.y +
        padding +
        titleSpace +
        (usableHeight - contentHeight * scale) / 2 -
        box.minY * scale,
    });
  });

  return { page, panes: placed };
}
