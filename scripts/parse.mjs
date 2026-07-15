// Convierte los ficheros de texto de ./preguntas y ./casos-practicos en JSON
// estructurado dentro de ./src/data. Se ejecuta automáticamente antes de dev/build.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Parser genérico por campos con prefijo "CLAVE:".
// Cada campo puede ocupar varias líneas: las líneas que no empiezan por una
// clave conocida se acumulan en el último campo.
// ---------------------------------------------------------------------------
function parseRecords(text, fieldKeys) {
  const fieldRe = new RegExp(`^(${fieldKeys.join("|")}):[ \\t]?(.*)$`);
  const lines = text.split(/\r?\n/);
  const records = [];
  let current = null;
  let currentKey = null;

  const push = () => {
    if (current) records.push(current);
    current = null;
    currentKey = null;
  };

  for (const line of lines) {
    const match = line.match(fieldRe);
    if (match) {
      const key = match[1];
      const value = match[2];
      if (key === "COD") {
        push();
        current = {};
      }
      if (!current) current = {};
      current[key] = value;
      currentKey = key;
    } else if (current && currentKey) {
      // Línea de continuación: la añadimos preservando el salto de línea.
      current[currentKey] += "\n" + line;
    }
  }
  push();
  return records;
}

// Limpia un bloque de texto multilínea: recorta y colapsa líneas en blanco.
function cleanBlock(s) {
  return (s || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// 1) Preguntas tipo test (carpeta ./preguntas -> ./src/data/blocks)
// ---------------------------------------------------------------------------
const TEST_TITLES = {
  A: "Arrendamientos y contratos",
  B: "Derecho mercantil y empresa",
  C: "Derecho laboral y Seguridad Social",
  D: "Fiscalidad",
  E: "Títulos de crédito y facturación",
  F: "Arrendamiento de vehículos y transporte",
  G: "El vehículo: masas y dimensiones",
  H: "Permisos de conducción y circulación",
};

async function parseTests() {
  const SRC_DIR = path.join(ROOT, "preguntas");
  const OUT_DIR = path.join(ROOT, "src", "data", "blocks");
  await fs.mkdir(OUT_DIR, { recursive: true });

  const files = (await fs.readdir(SRC_DIR)).filter((f) => f.endsWith(".txt")).sort();
  const index = [];
  const keys = ["COD", "PREGUNTA", "A", "B", "C", "D", "SOLUCION", "NORMA"];

  for (const file of files) {
    const m = file.match(/pv2([A-Z])\.txt/i);
    const blockId = m ? m[1].toUpperCase() : path.basename(file, ".txt");
    const text = await fs.readFile(path.join(SRC_DIR, file), "utf8");
    const records = parseRecords(text, keys);

    const questions = records
      .map((r, i) => ({
        id: r.COD?.trim() || `${blockId}-${i}`,
        pregunta: cleanBlock(r.PREGUNTA),
        opciones: {
          A: cleanBlock(r.A),
          B: cleanBlock(r.B),
          C: cleanBlock(r.C),
          D: cleanBlock(r.D),
        },
        solucion: (r.SOLUCION || "").trim().toUpperCase().charAt(0),
        norma: cleanBlock(r.NORMA),
      }))
      .filter(
        (q) =>
          q.pregunta &&
          ["A", "B", "C", "D"].includes(q.solucion) &&
          q.opciones.A && q.opciones.B && q.opciones.C && q.opciones.D
      );

    await fs.writeFile(path.join(OUT_DIR, `${blockId}.json`), JSON.stringify(questions), "utf8");
    index.push({
      id: blockId,
      title: TEST_TITLES[blockId] || `Bloque ${blockId}`,
      count: questions.length,
      file: `${blockId}.json`,
    });
    console.log(`[test]  Bloque ${blockId}: ${questions.length} preguntas`);
  }

  await fs.writeFile(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");
  const total = index.reduce((s, b) => s + b.count, 0);
  console.log(`[test]  Total: ${total} preguntas en ${index.length} bloques.\n`);
}

// ---------------------------------------------------------------------------
// 2) Casos prácticos (carpeta ./casos-practicos -> ./src/data/casos)
//    Enunciado largo + hasta 8 opciones (RESPUESTA A..H) multilínea.
// ---------------------------------------------------------------------------
const CASO_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

async function parseCasos() {
  const SRC_DIR = path.join(ROOT, "casos-practicos");
  const OUT_DIR = path.join(ROOT, "src", "data", "casos");

  // Si la carpeta no existe, no hacemos nada.
  try {
    await fs.access(SRC_DIR);
  } catch {
    console.log("[casos] Carpeta 'casos-practicos' no encontrada; se omite.\n");
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = (await fs.readdir(SRC_DIR)).filter((f) => f.endsWith(".txt")).sort();
  const index = [];
  const keys = [
    "COD",
    "PREGUNTA",
    ...CASO_LETTERS.map((l) => `RESPUESTA ${l}`),
    "SOLUCION",
    "NORMA",
  ];

  for (const file of files) {
    const m = file.match(/cv2([A-Z])\.txt/i);
    const blockId = m ? m[1].toUpperCase() : path.basename(file, ".txt");
    const text = await fs.readFile(path.join(SRC_DIR, file), "utf8");
    const records = parseRecords(text, keys);

    const questions = records
      .map((r, i) => {
        const opciones = {};
        for (const l of CASO_LETTERS) {
          const val = cleanBlock(r[`RESPUESTA ${l}`]);
          if (val) opciones[l] = val;
        }
        // "SOLUCION: RESPUESTA C" -> "C"
        const solMatch = (r.SOLUCION || "").toUpperCase().match(/([A-H])\s*$/);
        return {
          id: r.COD?.trim() || `${blockId}-${i}`,
          pregunta: cleanBlock(r.PREGUNTA),
          opciones,
          solucion: solMatch ? solMatch[1] : "",
          norma: cleanBlock(r.NORMA),
        };
      })
      .filter(
        (q) =>
          q.pregunta &&
          q.solucion &&
          q.opciones[q.solucion] &&
          Object.keys(q.opciones).length >= 2
      );

    await fs.writeFile(path.join(OUT_DIR, `${blockId}.json`), JSON.stringify(questions), "utf8");
    index.push({
      id: blockId,
      title: `Bloque ${blockId}`,
      count: questions.length,
      file: `${blockId}.json`,
    });
    console.log(`[casos] Bloque ${blockId}: ${questions.length} casos`);
  }

  await fs.writeFile(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");
  const total = index.reduce((s, b) => s + b.count, 0);
  console.log(`[casos] Total: ${total} casos en ${index.length} bloques.\n`);
}

async function main() {
  await parseTests();
  await parseCasos();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
