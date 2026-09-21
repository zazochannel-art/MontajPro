/**
 * Forma și culorile mărcii MontCraft, într-un singur loc.
 *
 * Conturul e trasat din logo, nu desenat din amintire: pixelii au fost
 * împărțiți în lemn și beton, s-au găsit piesele legate între ele, li s-a
 * urmărit marginea și s-a simplificat până au rămas colțurile. Componenta din
 * aplicație și scriptul care face iconițele citesc de aici, ca să nu existe
 * două adevăruri despre cum arată marca.
 *
 * „M"-ul e din două piese care nu se ating: cea de lemn — piciorul din stânga
 * și diagonala care coboară — și cea de beton, cu vârful ascuțit și piciorul
 * drept. Scara urcă în golul dintre ele.
 */

/** Marca e mai lată decât înaltă; raportul vine din logo. */
export const BRAND_VIEWBOX = "0 0 100 74";
export const BRAND_WIDTH = 100;
export const BRAND_HEIGHT = 74;

export const BRAND_WOOD_PATH =
  "M 0 0 L 62 39.5 L 63 56 L 16 25.5 L 15.5 52 L 7.5 52 L 7.5 59 L 0 59 Z";

export const BRAND_CONCRETE_PATH =
  "M 98.5 0 L 100 1 L 100 73.5 L 84 66.5 L 84 28 L 67 37 L 55.5 30 Z";

/**
 * Scara, ca linie frântă de grosime constantă.
 *
 * Treptele sunt regulate, pe axe. Din trasare ieșeau ușor inegale — de la
 * marginile fotografiei —, iar la mărimea unei iconițe o treaptă strâmbă
 * arată a greșeală, nu a intenție.
 *
 * Capătul de sus urcă dinadins mai mult decât se vede: piesa de lemn se
 * desenează peste el și îl taie exact pe diagonală, ca pe firmă.
 */
export const BRAND_STAIRS_PATH =
  "M 35.9 36 L 35.9 48.6 L 28 48.6 L 28 55.9 L 20.1 55.9 L 20.1 63.2 L 12.2 63.2 L 12.2 70.5 L 0 70.5";
export const BRAND_STAIRS_WIDTH = 7;

/** Culorile măsurate din logo. */
export const BRAND_WOOD = "#d29158";
export const BRAND_CONCRETE = "#eeeeee";
