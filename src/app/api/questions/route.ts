import { NextResponse } from "next/server";
import {
  getBlockQuestionIds,
  getExamQuestions,
  shuffle,
  type Dataset,
} from "@/lib/questions";
import {
  getLastAttemptMap,
  getQuestionIdsByState,
  type QuestionState,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

const ALLOWED_COUNTS = [10, 25, 50, 100];

// Modos de repaso: acotan el examen a preguntas en un estado concreto.
const MODE_STATE: Record<string, QuestionState> = {
  falladas: "fallada",
  consolidar: "porConsolidar",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataset: Dataset = searchParams.get("type") === "casos" ? "casos" : "test";
  const block = searchParams.get("block") || "all";
  const countParam = Number(searchParams.get("count") || "10");
  const count = ALLOWED_COUNTS.includes(countParam) ? countParam : 10;
  const mode = searchParams.get("mode") || "";

  try {
    let onlyIds: Set<string> | undefined;
    if (MODE_STATE[mode]) {
      const ids = await getQuestionIdsByState(dataset, block, MODE_STATE[mode]);
      onlyIds = new Set(ids);
    } else if (mode === "antiguas") {
      // Preguntas que más tiempo llevan sin salir: nunca respondidas primero
      // (se barajan para variar los empates) y después por último intento más
      // antiguo. Se recorta a `count` aquí para que el barajado posterior de
      // getExamQuestions solo afecte al orden de presentación.
      const ids = shuffle(await getBlockQuestionIds(dataset, block));
      const lastSeen = await getLastAttemptMap(dataset);
      ids.sort((a, b) => (lastSeen.get(a) ?? 0) - (lastSeen.get(b) ?? 0));
      onlyIds = new Set(ids.slice(0, count));
    }
    const questions = await getExamQuestions(dataset, block, count, onlyIds);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar las preguntas." },
      { status: 500 }
    );
  }
}
