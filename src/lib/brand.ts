/**
 * Forma mărcii MontCraft, într-un singur loc.
 *
 * Căile sunt trasate din logoul tipărit — conturul pieselor a fost măsurat din
 * imagine, nu desenat din amintire. Componenta din aplicație și scriptul care
 * face iconițele PWA citesc de aici, ca să nu existe două adevăruri despre cum
 * arată marca.
 *
 * „M"-ul e din două piese care nu se ating: cea de lemn — piciorul din stânga
 * și diagonala care coboară — și cea de beton, cu vârful ascuțit și piciorul
 * drept. Scara stă în golul dintre ele.
 */

/** Marca e mai lată decât înaltă; raportul vine din logo. */
export const BRAND_VIEWBOX = "0 0 100 72";
export const BRAND_WIDTH = 100;
export const BRAND_HEIGHT = 72;

/**
 * Colțul din stânga jos e tăiat în trepte drepte, nu pieziș cum a ieșit din
 * trasare: acolo, pe firmă, scara acoperă piciorul de lemn, iar o linie
 * strâmbă moștenită din umbra fotografiei arată a greșeală, nu a intenție.
 */
export const BRAND_WOOD_PATH =
  "M 0 0 L 38 23 L 62 39 L 63 48 L 62 55 L 61 55 L 16 25 L 15 25 L 16 52 L 7 52 L 7 58 L 0 58 Z";

export const BRAND_CONCRETE_PATH =
  "M 100 1 L 100 71 L 84 66 L 84 26 L 66 38 L 55 30 L 64 23 L 99 1 Z";

/**
 * Scara, ca linie frântă de grosime constantă.
 *
 * Trasarea din fotografie a ieșit ușor strâmbă — poza logoului are o umbră și
 * o urmă de perspectivă. Treptele sunt drepte în realitate, deci aici sunt
 * drepte: patru trepte egale, pe axe.
 */
export const BRAND_STAIRS_PATH =
  "M 40 42 L 40 48.5 L 32 48.5 L 32 55 L 24 55 L 24 61.5 L 16 61.5 L 16 68 L 3.5 68";
export const BRAND_STAIRS_WIDTH = 7;

export const BRAND_WOOD = "#b5723e";
export const BRAND_CONCRETE = "#e8e6e0";
