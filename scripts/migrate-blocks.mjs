// Migración puntual: reasigna a cada intento su bloque real.
//
// Los exámenes de "Todos los bloques" guardaban block='all' en la tabla
// attempts, lo que rompía las estadísticas por bloque y los repasos filtrados.
// Este script busca el bloque real de cada pregunta en src/data y actualiza
// los intentos cuyo bloque guardado no coincide.
//
// Uso:
//   node scripts/migrate-blocks.mjs           # simulación (no escribe nada)
//   node scripts/migrate-blocks.mjs --apply   # aplica los cambios
//
// Sin TURSO_DATABASE_URL usa la BD local (progreso.db). Lee .env.local/.env
// si existen, así que para migrar Turso basta con tener ahí las variables.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APPLY = process.argv.includes("--apply");

// Carga variables de .env.local / .env sin sobrescribir las ya definidas.
async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    let text;
    try {
      text = await fs.readFile(path.join(ROOT, file), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  }
}

// Mapa "dataset:question_id" -> bloque real, leído de los JSON de datos.
async function buildBlockMap() {
  const map = new Map();
  const dirs = [
    ["test", path.join(ROOT, "src", "data", "blocks")],
    ["casos", path.join(ROOT, "src", "data", "casos")],
  ];
  for (const [dataset, dir] of dirs) {
    let files;
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".json") || file === "index.json") continue;
      const blockId = path.basename(file, ".json");
      const questions = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
      for (const q of questions) map.set(`${dataset}:${q.id}`, blockId);
    }
  }
  return map;
}

async function main() {
  await loadEnv();
  const url = process.env.TURSO_DATABASE_URL || "file:progreso.db";
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  console.log(`BD: ${url.startsWith("file:") ? url : "Turso (remota)"}`);
  console.log(APPLY ? "Modo: APLICAR cambios\n" : "Modo: simulación (usa --apply para escribir)\n");

  const blockMap = await buildBlockMap();
  console.log(`Preguntas indexadas: ${blockMap.size}`);

  const res = await db.execute(
    `SELECT id, question_id, dataset, block FROM attempts`
  );
  const updates = [];
  let unknown = 0;
  for (const r of res.rows) {
    const real = blockMap.get(`${r.dataset}:${r.question_id}`);
    if (!real) {
      unknown++;
      console.warn(`  ⚠ intento ${r.id}: pregunta ${r.dataset}:${r.question_id} no encontrada en src/data; se deja como está`);
      continue;
    }
    if (real !== r.block) {
      updates.push({
        sql: `UPDATE attempts SET block = ? WHERE id = ?`,
        args: [real, r.id],
      });
    }
  }

  console.log(`Intentos totales: ${res.rows.length}`);
  console.log(`A corregir (block guardado ≠ bloque real): ${updates.length}`);
  if (unknown) console.log(`Sin pregunta conocida (no se tocan): ${unknown}`);

  if (!updates.length) {
    console.log("Nada que migrar. ✅");
    return;
  }
  if (!APPLY) {
    console.log("\nSimulación terminada. Ejecuta con --apply para aplicar.");
    return;
  }
  // db.batch ejecuta todo en una transacción.
  await db.batch(updates, "write");
  console.log("Migración aplicada. ✅");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
