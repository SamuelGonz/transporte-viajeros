import { NextResponse } from "next/server";
import { getExamQuestions, type Dataset } from "@/lib/questions";

export const dynamic = "force-dynamic";

const ALLOWED_COUNTS = [10, 25, 50, 100];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataset: Dataset = searchParams.get("type") === "casos" ? "casos" : "test";
  const block = searchParams.get("block") || "all";
  const countParam = Number(searchParams.get("count") || "10");
  const count = ALLOWED_COUNTS.includes(countParam) ? countParam : 10;

  try {
    const questions = await getExamQuestions(dataset, block, count);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar las preguntas." },
      { status: 500 }
    );
  }
}
