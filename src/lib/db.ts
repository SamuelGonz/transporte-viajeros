import { createClient, type Client } from "@libsql/client";

// El mismo código sirve para desarrollo y producción:
//  - En local, si no defines variables, usa un fichero SQLite (progreso.db).
//  - En producción (Turso), define TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.
let client: Client | null = null;
let ready: Promise<void> | null = null;

function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    return createClient({ url, authToken });
  }
  // Fallback local: fichero en la raíz del proyecto.
  return createClient({ url: "file:progreso.db" });
}

async function ensureSchema(c: Client): Promise<void> {
  // Un registro por cada respuesta dada.
  await c.execute(`
    CREATE TABLE IF NOT EXISTS attempts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT    NOT NULL,
      dataset     TEXT    NOT NULL,
      block       TEXT    NOT NULL,
      selected    TEXT,
      correct     INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await c.execute(
    `CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts (question_id)`
  );
}

export async function getDb(): Promise<Client> {
  if (!client) {
    client = createDbClient();
    ready = ensureSchema(client);
  }
  await ready;
  return client;
}
