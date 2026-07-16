import { NextResponse } from "next/server";
import { getExamQuestions, type Dataset } from "@/lib/questions";
import { getQuestionIdsByState, type QuestionState } from "@/lib/stats";

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
