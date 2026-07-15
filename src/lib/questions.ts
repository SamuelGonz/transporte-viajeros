import { promises as fs } from "node:fs";
import path from "node:path";

export type Dataset = "test" | "casos";

export interface Question {
  id: string;
  pregunta: string;
  // En los test hay 4 opciones (A-D); en los casos prácticos hasta 8 (A-H).
  opciones: Record<string, string>;
  solucion: string;
  norma: string;
}

export interface BlockInfo {
  id: string;
  title: string;
  count: number;
  file: string;
}

const DATA_ROOT = path.join(process.cwd(), "src", "data");

function datasetDir(dataset: Dataset): string {
  return path.join(DATA_ROOT, dataset === "casos" ? "casos" : "blocks");
}

export async function getBlocks(dataset: Dataset): Promise<BlockInfo[]> {
  try {
    const raw = await fs.readFile(path.join(datasetDir(dataset), "index.json"), "utf8");
    return JSON.parse(raw) as BlockInfo[];
  } catch {
    return [];
  }
}

async function readBlock(dataset: Dataset, blockId: string): Promise<Question[]> {
  const raw = await fs.readFile(path.join(datasetDir(dataset), `${blockId}.json`), "utf8");
  return JSON.parse(raw) as Question[];
}

// Dado un conjunto de referencias (dataset+bloque+id), devuelve el texto de
// cada pregunta. Lee solo los bloques necesarios (una vez cada uno).
export async function getPreguntaTextos(
  refs: { dataset: Dataset; block: string; id: string }[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const needed = new Map<string, { dataset: Dataset; block: string }>();
  for (const r of refs) {
    needed.set(`${r.dataset}:${r.block}`, { dataset: r.dataset, block: r.block });
  }
  await Promise.all(
    [...needed.values()].map(async ({ dataset, block }) => {
      try {
        const qs = await readBlock(dataset, block);
        for (const q of qs) map.set(`${dataset}:${q.id}`, q.pregunta);
      } catch {
        /* bloque inexistente: se ignora */
      }
    })
  );
  return map;
}

// Baraja de Fisher-Yates.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Devuelve `count` preguntas aleatorias del bloque indicado
// ("all" combina todos los bloques del dataset).
export async function getExamQuestions(
  dataset: Dataset,
  blockId: string,
  count: number
): Promise<Question[]> {
  let pool: Question[] = [];

  if (blockId === "all") {
    const blocks = await getBlocks(dataset);
    const all = await Promise.all(blocks.map((b) => readBlock(dataset, b.id)));
    pool = all.flat();
  } else {
    pool = await readBlock(dataset, blockId);
  }

  return shuffle(pool).slice(0, count);
}
