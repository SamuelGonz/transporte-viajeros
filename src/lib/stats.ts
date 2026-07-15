import { getDb } from "./db";
import { getPreguntaTextos, type Dataset } from "./questions";

export interface QuestionStats {
  questionId: string;
  shown: number; // veces respondida (👁)
  correct: number; // aciertos (✓)
  wrong: number; // fallos (✗)
  blank: number; // sin contestar (○) — reservado para el modo "saltar"
  // Fecha ISO de la vez ANTERIOR que se respondió (para "respondida hace X").
  previousAt: string | null;
}

export interface RecordInput {
  questionId: string;
  dataset: string;
  block: string;
  selected: string | null;
  correct: boolean;
}

// Registra una respuesta y devuelve la ficha actualizada de esa pregunta.
export async function recordAttempt(input: RecordInput): Promise<QuestionStats> {
  const db = await getDb();

  // La última vez que se respondió ANTES de este intento (para el "hace X días").
  const prev = await db.execute({
    sql: `SELECT created_at FROM attempts WHERE question_id = ? ORDER BY id DESC LIMIT 1`,
    args: [input.questionId],
  });
  const previousAt = prev.rows.length ? String(prev.rows[0].created_at) : null;

  await db.execute({
    sql: `INSERT INTO attempts (question_id, dataset, block, selected, correct)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      input.questionId,
      input.dataset,
      input.block,
      input.selected,
      input.correct ? 1 : 0,
    ],
  });

  const agg = await db.execute({
    sql: `SELECT
            COUNT(*)                              AS shown,
            SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct,
            SUM(CASE WHEN correct = 0 AND selected IS NOT NULL THEN 1 ELSE 0 END) AS wrong,
            SUM(CASE WHEN selected IS NULL THEN 1 ELSE 0 END)                     AS blank
          FROM attempts WHERE question_id = ?`,
    args: [input.questionId],
  });

  const r = agg.rows[0];
  return {
    questionId: input.questionId,
    shown: Number(r.shown ?? 0),
    correct: Number(r.correct ?? 0),
    wrong: Number(r.wrong ?? 0),
    blank: Number(r.blank ?? 0),
    previousAt,
  };
}

// ---------------------------------------------------------------------------
// Datos para el panel de progreso (dashboard).
// ---------------------------------------------------------------------------
export interface DashboardData {
  hasData: boolean;
  resumen: {
    total: number;
    correct: number;
    wrong: number;
    accuracy: number; // %
    distinctQuestions: number;
    activeDays: number;
  };
  porDataset: { dataset: string; total: number; correct: number; accuracy: number }[];
  porBloque: {
    dataset: string;
    block: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  porDia: { date: string; total: number; correct: number; accuracy: number }[];
  topFalladas: {
    questionId: string;
    dataset: string;
    block: string;
    total: number;
    wrong: number;
    accuracy: number;
    pregunta: string;
  }[];
}

const pct = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

// Últimos N días en formato YYYY-MM-DD (UTC, para casar con datetime('now')).
function ultimosDias(n: number): string[] {
  const hoy = new Date();
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getTime() - i * 86400000);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

export async function getDashboard(): Promise<DashboardData> {
  const db = await getDb();

  const resumenQ = await db.execute(`
    SELECT COUNT(*) AS total,
           SUM(correct) AS correct,
           COUNT(DISTINCT question_id) AS distinctQuestions,
           COUNT(DISTINCT date(created_at)) AS activeDays
    FROM attempts
  `);
  const rr = resumenQ.rows[0];
  const total = Number(rr.total ?? 0);
  const correct = Number(rr.correct ?? 0);

  if (total === 0) {
    return {
      hasData: false,
      resumen: {
        total: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
        distinctQuestions: 0,
        activeDays: 0,
      },
      porDataset: [],
      porBloque: [],
      porDia: [],
      topFalladas: [],
    };
  }

  const datasetQ = await db.execute(`
    SELECT dataset, COUNT(*) AS total, SUM(correct) AS correct
    FROM attempts GROUP BY dataset
  `);
  const porDataset = datasetQ.rows.map((r) => {
    const t = Number(r.total ?? 0);
    const c = Number(r.correct ?? 0);
    return { dataset: String(r.dataset), total: t, correct: c, accuracy: pct(c, t) };
  });

  const bloqueQ = await db.execute(`
    SELECT dataset, block, COUNT(*) AS total, SUM(correct) AS correct
    FROM attempts GROUP BY dataset, block ORDER BY dataset, block
  `);
  const porBloque = bloqueQ.rows.map((r) => {
    const t = Number(r.total ?? 0);
    const c = Number(r.correct ?? 0);
    return {
      dataset: String(r.dataset),
      block: String(r.block),
      total: t,
      correct: c,
      accuracy: pct(c, t),
    };
  });

  const diaQ = await db.execute(`
    SELECT date(created_at) AS d, COUNT(*) AS total, SUM(correct) AS correct
    FROM attempts
    WHERE date(created_at) >= date('now', '-13 days')
    GROUP BY d
  `);
  const diaMap = new Map<string, { total: number; correct: number }>();
  for (const r of diaQ.rows) {
    diaMap.set(String(r.d), {
      total: Number(r.total ?? 0),
      correct: Number(r.correct ?? 0),
    });
  }
  const porDia = ultimosDias(14).map((date) => {
    const v = diaMap.get(date);
    const t = v?.total ?? 0;
    const c = v?.correct ?? 0;
    return { date, total: t, correct: c, accuracy: pct(c, t) };
  });

  const topQ = await db.execute(`
    SELECT question_id, dataset, block,
           COUNT(*) AS total,
           SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS wrong
    FROM attempts
    GROUP BY question_id, dataset, block
    HAVING wrong > 0
    ORDER BY wrong DESC, (CAST(wrong AS REAL) / total) DESC, total DESC
    LIMIT 10
  `);
  const topRefs = topQ.rows.map((r) => ({
    id: String(r.question_id),
    dataset: (String(r.dataset) === "casos" ? "casos" : "test") as Dataset,
    block: String(r.block),
  }));
  const textos = await getPreguntaTextos(topRefs);
  const topFalladas = topQ.rows.map((r) => {
    const dataset = String(r.dataset) === "casos" ? "casos" : "test";
    const id = String(r.question_id);
    const t = Number(r.total ?? 0);
    const w = Number(r.wrong ?? 0);
    return {
      questionId: id,
      dataset,
      block: String(r.block),
      total: t,
      wrong: w,
      accuracy: pct(t - w, t),
      pregunta: textos.get(`${dataset}:${id}`) ?? "(enunciado no disponible)",
    };
  });

  return {
    hasData: true,
    resumen: {
      total,
      correct,
      wrong: total - correct,
      accuracy: pct(correct, total),
      distinctQuestions: Number(rr.distinctQuestions ?? 0),
      activeDays: Number(rr.activeDays ?? 0),
    },
    porDataset,
    porBloque,
    porDia,
    topFalladas,
  };
}
