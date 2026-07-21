import { NextResponse } from "next/server";
import { recordAttempt } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questionId, dataset, block, selected, correct } = body ?? {};

    if (questionId == null || questionId === "" || typeof correct !== "boolean") {
      return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
    }

    const stats = await recordAttempt({
      questionId: String(questionId),
      dataset: dataset === "casos" ? "casos" : "test",
      block: String(block ?? "all"),
      selected: selected == null ? null : String(selected),
      correct,
    });

    return NextResponse.json({ stats });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo guardar el intento." },
      { status: 500 }
    );
  }
}
