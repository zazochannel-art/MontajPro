/**
 * Un PostgREST fals, cât să poată vorbi clientul Supabase adevărat cu el.
 *
 * Testele de sincronizare nu au nevoie de un Postgres întreg — au nevoie de un
 * server care se poartă ca API-ul: filtrează după `synced_at`, sortează,
 * pagineaza și face upsert pe `id`. Ceasul serverului este un contor, ca
 * ordinea să fie mereu aceeași.
 */
import { createServer } from "node:http";

export function createFakeBackend() {
  /** table -> Map<id, row> */
  const tables = new Map();
  /** Tabele care trebuie să refuze scrierea (pentru testul de izolare). */
  const rejecting = new Set();
  /** Tabele care refuză citirea, ca să se poată testa izolarea la pull. */
  const rejectingReads = new Set();
  const uploads = [];
  let clock = 0;

  const nextStamp = () => {
    clock += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString();
  };

  const tableOf = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };

  const readBody = (request) =>
    new Promise((resolve) => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => resolve(Buffer.concat(chunks)));
    });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const send = (status, payload, headers = {}) => {
      const body = payload === undefined ? "" : JSON.stringify(payload);
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...headers,
      });
      response.end(body);
    };

    // Încărcarea pozelor: ne interesează doar că s-a întâmplat.
    if (url.pathname.startsWith("/storage/v1/object/")) {
      await readBody(request);
      uploads.push(url.pathname.replace("/storage/v1/object/", ""));
      return send(200, { Key: url.pathname });
    }

    const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (!match) return send(404, { message: "necunoscut" });
    const name = match[1];

    if (request.method === "GET" && rejectingReads.has(name)) {
      return send(500, { message: `citire refuzată pentru ${name}` });
    }

    if (request.method === "POST") {
      if (rejecting.has(name)) {
        return send(409, {
          code: "23505",
          message: `duplicate key value violates unique constraint on ${name}`,
        });
      }
      const raw = await readBody(request);
      const rows = JSON.parse(raw.toString() || "[]");
      const store = tableOf(name);
      for (const row of Array.isArray(rows) ? rows : [rows]) {
        store.set(row.id, { ...row, synced_at: nextStamp() });
      }
      return send(201, []);
    }

    if (request.method === "GET") {
      const store = tableOf(name);
      let rows = [...store.values()];

      // Filtrele trimise de client: `synced_at=gt.<iso>`
      for (const [key, value] of url.searchParams.entries()) {
        if (key === "select" || key === "order") continue;
        const [operator, ...rest] = value.split(".");
        const operand = rest.join(".");
        if (operator === "gt") rows = rows.filter((row) => String(row[key]) > operand);
        if (operator === "eq") rows = rows.filter((row) => String(row[key]) === operand);
      }

      const order = url.searchParams.get("order");
      if (order) {
        const [column, direction] = order.split(".");
        rows.sort((a, b) =>
          direction === "desc"
            ? String(b[column]).localeCompare(String(a[column]))
            : String(a[column]).localeCompare(String(b[column])),
        );
      }

      const range = request.headers.range;
      if (range) {
        const [from, to] = range.replace("items=", "").split("-").map(Number);
        rows = rows.slice(from, to + 1);
      }

      return send(200, rows);
    }

    if (request.method === "DELETE") {
      const store = tableOf(name);
      for (const [key, value] of url.searchParams.entries()) {
        const [operator, ...rest] = value.split(".");
        if (operator !== "eq") continue;
        const operand = rest.join(".");
        for (const [id, row] of store) {
          if (String(row[key]) === operand) store.delete(id);
        }
      }
      return send(204);
    }

    if (request.method === "OPTIONS") return send(200, {});
    return send(405, { message: "metodă nepermisă" });
  });

  return {
    server,
    tables,
    uploads,
    rows: (name) => [...tableOf(name).values()],
    seed: (name, row) => tableOf(name).set(row.id, { ...row, synced_at: nextStamp() }),
    reject: (name) => rejecting.add(name),
    allow: (name) => rejecting.delete(name),
    rejectReads: (name) => rejectingReads.add(name),
    allowReads: (name) => rejectingReads.delete(name),
    listen: () =>
      new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () =>
          resolve(`http://127.0.0.1:${server.address().port}`),
        );
      }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
