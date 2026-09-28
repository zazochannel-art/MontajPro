/**
 * Găsirea liniilor drepte într-o hartă de muchii: transformata Hough.
 *
 * Ideea, pe scurt: fiecare punct de muchie votează pentru toate dreptele care
 * ar putea trece prin el. Unde se adună multe voturi, chiar e o dreaptă. E
 * tocmai ce trebuie pentru o scară — muchia unei trepte e lungă și dreaptă,
 * iar zgomotul din jur e scurt și împrăștiat, deci nu strânge voturi.
 *
 * Dreapta se scrie ca `x·cos θ + y·sin θ = ρ`, fiindcă așa se poate scrie și
 * una verticală; cu `y = mx + n` panta ar fi ieșit infinită exact la treptele
 * fotografiate din față.
 */

export interface HoughLine {
  /** Distanța de la origine până la dreaptă. */
  rho: number;
  /** Unghiul normalei, în radiani. */
  theta: number;
  /** Câte puncte de muchie au votat-o. */
  votes: number;
  /** Capetele bucății care chiar are muchii sub ea. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Cât de lungă e bucata aceea. */
  length: number;
}

export interface HoughOptions {
  /** Câte trepte de unghi, peste tot intervalul. */
  thetaSteps?: number;
  /** Sub atâtea voturi, o adunare nu e dreaptă, e o coincidență. */
  minVotes?: number;
  /** Cât de aproape pot fi două drepte până să fie socotite una. */
  rhoTolerance?: number;
  /** Idem, pe unghi, în radiani. */
  thetaTolerance?: number;
}

/**
 * Acumulatorul: câte voturi are fiecare pereche (unghi, distanță).
 *
 * Se întoarce întreg, nu doar vârfurile, fiindcă `detect.ts` are nevoie să se
 * uite peste toate unghiurile ca să afle în ce direcție merg treptele.
 */
export interface Accumulator {
  /** Voturi, pe rânduri de unghi. */
  data: Int32Array;
  thetaSteps: number;
  rhoSteps: number;
  rhoOffset: number;
}

export function accumulate(
  mask: Uint8Array,
  width: number,
  height: number,
  options: HoughOptions = {},
): Accumulator {
  const thetaSteps = options.thetaSteps ?? 180;
  const diagonal = Math.ceil(Math.hypot(width, height));
  // ρ poate fi negativ, deci se mută tot intervalul în pozitiv.
  const rhoOffset = diagonal;
  const rhoSteps = diagonal * 2 + 1;
  const data = new Int32Array(thetaSteps * rhoSteps);

  const cos = new Float64Array(thetaSteps);
  const sin = new Float64Array(thetaSteps);
  for (let t = 0; t < thetaSteps; t += 1) {
    const theta = (t * Math.PI) / thetaSteps;
    cos[t] = Math.cos(theta);
    sin[t] = Math.sin(theta);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let t = 0; t < thetaSteps; t += 1) {
        const rho = Math.round(x * cos[t] + y * sin[t]) + rhoOffset;
        if (rho < 0 || rho >= rhoSteps) continue;
        data[t * rhoSteps + rho] += 1;
      }
    }
  }

  return { data, thetaSteps, rhoSteps, rhoOffset };
}

/**
 * Unghiul pe care merg cele mai multe muchii.
 *
 * Fotografia nu e niciodată dreaptă: omul stă strâmb, telefonul e înclinat,
 * scara urcă în diagonală. Căutând întâi direcția dominantă și abia apoi
 * liniile din jurul ei, treptele ies și dintr-o poză strâmbă — iar tocul ușii
 * și pervazul, care merg pe alt unghi, nu se amestecă printre ele.
 */
export function dominantTheta(accumulator: Accumulator): number {
  const { data, thetaSteps, rhoSteps } = accumulator;
  let best = 0;
  let bestScore = -1;

  for (let t = 0; t < thetaSteps; t += 1) {
    let score = 0;
    for (let r = 0; r < rhoSteps; r += 1) {
      const votes = data[t * rhoSteps + r];
      // Pătratul: o singură dreaptă tare contează mai mult decât o ceață de
      // voturi împrăștiate pe același unghi.
      score += votes * votes;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  return (best * Math.PI) / thetaSteps;
}

/**
 * Vârfurile din acumulator: dreptele adevărate.
 *
 * Se caută doar în jurul unghiului dominant, cu `spread` în ambele părți.
 * După ce se ia un vârf, vecinii lui se sting — altfel aceeași muchie, groasă
 * de trei pixeli, ar ieși ca trei drepte lipite.
 */
export function peaks(
  accumulator: Accumulator,
  theta: number,
  spread: number,
  options: HoughOptions = {},
): { rho: number; theta: number; votes: number }[] {
  const { data, thetaSteps, rhoSteps, rhoOffset } = accumulator;
  const minVotes = options.minVotes ?? 30;
  const rhoTolerance = options.rhoTolerance ?? 12;

  const center = Math.round((theta * thetaSteps) / Math.PI);
  const halfWidth = Math.max(1, Math.round((spread * thetaSteps) / Math.PI));

  const found: { rho: number; theta: number; votes: number; t: number; r: number }[] = [];
  for (let dt = -halfWidth; dt <= halfWidth; dt += 1) {
    // Unghiul e ciclic pe π: 179° și 1° sunt vecini.
    const t = ((center + dt) % thetaSteps + thetaSteps) % thetaSteps;
    for (let r = 0; r < rhoSteps; r += 1) {
      const votes = data[t * rhoSteps + r];
      if (votes < minVotes) continue;
      found.push({
        rho: r - rhoOffset,
        theta: (t * Math.PI) / thetaSteps,
        votes,
        t,
        r,
      });
    }
  }

  found.sort((a, b) => b.votes - a.votes);

  const kept: { rho: number; theta: number; votes: number }[] = [];
  const taken: { t: number; r: number }[] = [];
  for (const candidate of found) {
    /*
     * Se caută deja numai în jurul unui singur unghi, deci două adunări la
     * aceeași distanță sunt aceeași muchie văzută de două ori — una groasă de
     * trei pixeli votează pe trei rânduri vecine. Unghiul nu mai intră în
     * socoteală: prima variantă îl cerea apropiat, iar cele două capete ale
     * intervalului treceau drept muchii diferite.
     */
    const tooClose = taken.some(
      (other) => Math.abs(other.r - candidate.r) < rhoTolerance,
    );
    if (tooClose) continue;
    taken.push({ t: candidate.t, r: candidate.r });
    kept.push({ rho: candidate.rho, theta: candidate.theta, votes: candidate.votes });
  }

  return kept;
}

/**
 * Cât din dreaptă are chiar muchii sub ea.
 *
 * O dreaptă din Hough e infinită. Pe desen nu ne trebuie infinitul, ci bucata
 * care se sprijină pe ceva: de la primul până la ultimul punct de muchie care
 * cade pe ea. Așa muchia unei trepte se oprește unde se oprește treapta, nu la
 * marginea fotografiei.
 */
export function extent(
  line: { rho: number; theta: number; votes: number },
  mask: Uint8Array,
  width: number,
  height: number,
  tolerance = 2,
): HoughLine | null {
  const cos = Math.cos(line.theta);
  const sin = Math.sin(line.theta);

  let minT = Infinity;
  let maxT = -Infinity;
  let hits = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      if (Math.abs(x * cos + y * sin - line.rho) > tolerance) continue;
      // Poziția de-a lungul dreptei, măsurată pe direcția ei.
      const along = -x * sin + y * cos;
      if (along < minT) minT = along;
      if (along > maxT) maxT = along;
      hits += 1;
    }
  }

  if (!hits || minT === Infinity) return null;

  const baseX = line.rho * cos;
  const baseY = line.rho * sin;
  return {
    rho: line.rho,
    theta: line.theta,
    votes: line.votes,
    x1: baseX - minT * sin,
    y1: baseY + minT * cos,
    x2: baseX - maxT * sin,
    y2: baseY + maxT * cos,
    length: maxT - minT,
  };
}

/**
 * Poziția unei muchii pe direcția de urcare a scării.
 *
 * Cât de „sus” e muchia, măsurat pe normala unghiului dominant. Spre deosebire
 * de ρ, care e al fiecărei drepte cu unghiul ei, cifra asta le pune pe toate pe
 * aceeași riglă — și de aceea se poate spune că două drepte sunt aceeași
 * muchie.
 */
export function positionOn(line: HoughLine, theta: number): number {
  const midX = (line.x1 + line.x2) / 2;
  const midY = (line.y1 + line.y2) / 2;
  return midX * Math.cos(theta) + midY * Math.sin(theta);
}

/**
 * Unește muchiile care sunt, de fapt, aceeași.
 *
 * O muchie groasă de doi pixeli nu votează pentru o singură dreaptă, ci pentru
 * un evantai de drepte aproape identice: una la unghiul exact, cu toate
 * voturile, și câteva alături, cu bucăți din ea. Pe riglă însă cad toate în
 * același loc. Rămâne cea cu cele mai multe voturi — restul sunt umbra ei.
 */
export function mergeDuplicates(
  lines: HoughLine[],
  theta: number,
  minGap: number,
): HoughLine[] {
  const ranked = [...lines].sort((a, b) => b.votes - a.votes);
  const kept: { line: HoughLine; position: number }[] = [];

  for (const line of ranked) {
    const position = positionOn(line, theta);
    if (kept.some((other) => Math.abs(other.position - position) < minGap)) continue;
    kept.push({ line, position });
  }

  return kept
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.line);
}
