/**
 * Româna și rusa.
 *
 * Jumătate din Moldova lucrează în rusă. Aplicația s-a scris direct în
 * română, cu textele în cod — de aceea cheia dicționarului **este** textul
 * românesc. Două urmări bune: româna nu trebuie tradusă niciodată (e deja
 * acolo, în cod, completă), iar un text căruia încă nu i s-a scris
 * corespondentul apare în română în loc să apară gol sau ca „missing.key".
 *
 * Deci lipsa unei traduceri e o neplăcere, nu o pagină stricată.
 */

export const LANGUAGES = [
  { code: "ro", label: "Română" },
  { code: "ru", label: "Русский" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

export function isLang(value: unknown): value is Lang {
  return value === "ro" || value === "ru";
}

/**
 * Textele traduse, cu româna drept cheie.
 *
 * Acoperă scheletul aplicației și ecranele umblate zilnic: navigația,
 * statusurile, tipurile de lucrare, butoanele care se repetă peste tot,
 * titlurile de pagină. Restul cade pe română până i se scrie corespondentul.
 */
const RU: Record<string, string> = {
  /* ---------------------------- navigație --------------------------- */
  Principal: "Основное",
  "Pe teren": "На объекте",
  Resurse: "Ресурсы",
  Cont: "Аккаунт",
  Dashboard: "Сводка",
  Lucrări: "Работы",
  Calendar: "Календарь",
  Clienți: "Клиенты",
  Proiecte: "Проекты",
  Măsurători: "Замеры",
  "Calculator preț": "Расчёт цены",
  Oferte: "Предложения",
  Finanțe: "Финансы",
  Rapoarte: "Отчёты",
  Facturi: "Счета",
  "Procese-verbale": "Акты приёмки",
  Garanții: "Гарантии",
  Materiale: "Материалы",
  Scule: "Инструменты",
  Portofoliu: "Портфолио",
  Echipă: "Бригада",
  Notificări: "Уведомления",
  Coș: "Корзина",
  Setări: "Настройки",
  Acasă: "Главная",
  Bani: "Деньги",
  Măsuri: "Замеры",
  Meniu: "Меню",
  Caută: "Поиск",
  Înapoi: "Назад",
  Azi: "Сегодня",

  /* ---------------------------- butoane ----------------------------- */
  Adaugă: "Добавить",
  Salvează: "Сохранить",
  Anulează: "Отмена",
  Renunță: "Отмена",
  Șterge: "Удалить",
  Editează: "Изменить",
  Duplică: "Дублировать",
  Export: "Экспорт",
  Import: "Импорт",
  Exportă: "Экспорт",
  Importă: "Импорт",
  Copiază: "Копировать",
  Trimite: "Отправить",
  "Lucrare nouă": "Новая работа",
  "Client nou": "Новый клиент",
  "Ofertă nouă": "Новое предложение",
  "Proiect nou": "Новый проект",
  "Adaugă client": "Добавить клиента",
  "Adaugă măsurătoare": "Добавить замер",
  "Creează lucrarea": "Создать работу",
  "Creează proiectul": "Создать проект",

  /* ------------------------ statusuri lucrare ----------------------- */
  Ofertă: "Предложение",
  Confirmată: "Подтверждена",
  "În lucru": "В работе",
  "În așteptare": "В ожидании",
  Finalizată: "Завершена",
  Problemă: "Проблема",
  Arhivă: "Архив",
  Toate: "Все",

  /* -------------------------- tipuri lucrare ------------------------ */
  Scări: "Лестницы",
  Scară: "Лестница",
  Parchet: "Паркет",
  Plintă: "Плинтус",
  Altceva: "Другое",

  /* ---------------------------- dashboard --------------------------- */
  Salut: "Привет",
  "Lucrări active": "Активные работы",
  "Bani de încasat": "К получению",
  "Încasări luna asta": "Поступления за месяц",
  "Cheltuieli luna asta": "Расходы за месяц",
  "Profit estimat": "Ожидаемая прибыль",
  "Ore lucrate": "Отработано часов",
  "Materiale necesare": "Нужны материалы",
  "Oferte trimise": "Отправленные предложения",
  Astăzi: "Сегодня",
  "Lucrări recente": "Последние работы",
  "Nicio lucrare programată azi": "На сегодня работ не назначено",
  "Ruta zilei": "Маршрут дня",
  "Deschide în hartă": "Открыть на карте",
  "De luat azi": "Взять сегодня",
  "De terminat": "Доделать",
  "De încărcat din depozit": "Загрузить со склада",

  /* ----------------------------- bani ------------------------------- */
  Preț: "Цена",
  Avans: "Аванс",
  Rest: "Остаток",
  Total: "Итого",
  Încasări: "Поступления",
  Cheltuieli: "Расходы",
  Profit: "Прибыль",
  Avansuri: "Авансы",
  "Câștig pe oră": "Заработок в час",
  "De pus deoparte": "Отложить",
  "Cât intră, cât iese, cât rămâne": "Сколько приходит, уходит и остаётся",
  "Următoarele 4 săptămâni": "Следующие 4 недели",

  /* ---------------------------- setări ------------------------------ */
  Profil: "Профиль",
  Monedă: "Валюта",
  Unități: "Единицы",
  TVA: "НДС",
  Impozit: "Налог",
  Limbă: "Язык",
  "Tarife implicite": "Базовые расценки",
  "Poziții proprii": "Свои позиции",
  Backup: "Резервная копия",
  "Mod șantier": "Режим объекта",
  "Date demo": "Демо-данные",
  "Ieși din cont": "Выйти",

  /* ---------------------------- diverse ----------------------------- */
  "Fără client": "Без клиента",
  "Fără proiect": "Без проекта",
  Client: "Клиент",
  Adresă: "Адрес",
  Telefon: "Телефон",
  Notițe: "Заметки",
  Data: "Дата",
  Ora: "Время",
  Nume: "Имя",
  Cantitate: "Количество",
  Unitate: "Единица",
  "Preț unitar": "Цена за единицу",
  Proiect: "Проект",
  "Se încarcă...": "Загрузка...",
  "prețurile sunt ascunse": "цены скрыты",
  "Toate comenzile tale": "Все твои заказы",
  "Programul tău pe zile": "Твой график по дням",
  "Stocul tău și ce mai ai de cumpărat": "Твой склад и что нужно купить",
  "Alege poziția, pune cantitatea — prețul vine din setări":
    "Выбери позицию, укажи количество — цена берётся из настроек",
  "Un bloc, o scară, o casă — lucrările care merg împreună":
    "Дом, подъезд, объект — работы, которые идут вместе",
  "Profil, monedă, tarife și backup": "Профиль, валюта, расценки и копии",
};

/** Traduce un text. Ce n-are corespondent rămâne în română. */
export function translate(lang: Lang, text: string): string {
  if (lang === "ro") return text;
  return RU[text] ?? text;
}

/** Câte texte au corespondent — folosit de teste, ca dicționarul să nu putrezească. */
export function dictionarySize(): number {
  return Object.keys(RU).length;
}
