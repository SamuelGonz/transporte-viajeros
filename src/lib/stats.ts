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
    sql: `SELECT created_at FROM attempts
          WHERE question_id = ? AND dataset = ?
          ORDER BY id DESC LIMIT 1`,
    args: [input.questionId, input.dataset],
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
          FROM attempts WHERE question_id = ? AND dataset = ?`,
    args: [input.questionId, input.dataset],
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

// La BD guarda created_at en UTC; el día de estudio se calcula en hora española
// para que responder a las 00:30 no cuente como el día anterior.
const TZ = "Europe/Madrid";
const diaFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
// "YYYY-MM-DD HH:MM:SS" (UTC, formato de SQLite) -> "YYYY-MM-DD" en hora local.
function diaLocal(createdAt: string): string {
  return diaFmt.format(new Date(createdAt.replace(" ", "T") + "Z"));
}

// Últimos N días en formato YYYY-MM-DD (hora española).
function ultimosDias(n: number): string[] {
  const hoy = new Date();
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    dias.push(diaFmt.format(new Date(hoy.getTime() - i * 86400000)));
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

  // Se traen los intentos recientes y se agrupan por día en hora española
  // (agrupar con date() en SQL usaría el día UTC).
  const diaQ = await db.execute(`
    SELECT created_at, correct
    FROM attempts
    WHERE created_at >= datetime('now', '-15 days')
  `);
  const diaMap = new Map<string, { total: number; correct: number }>();
  for (const r of diaQ.rows) {
    const d = diaLocal(String(r.created_at));
    const v = diaMap.get(d) ?? { total: 0, correct: 0 };
    v.total += 1;
    v.correct += Number(r.correct ?? 0);
    diaMap.set(d, v);
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

// ---------------------------------------------------------------------------
// Estado de consolidación por pregunta y progreso por bloque (para la home).
// ---------------------------------------------------------------------------

// Estado derivado del historial de intentos de UNA pregunta:
//  - "fallada":       el último intento fue incorrecto (o en blanco).
//  - "porConsolidar": último intento correcto, pero con 1 o 2 aciertos seguidos.
//  - "consolidada":   3 o más aciertos seguidos al final del historial.
export type QuestionState = "fallada" | "porConsolidar" | "consolidada";

// Aciertos seguidos (al final del historial) para dar una pregunta por dominada.
const CONSOLIDAR_RACHA = 3;

export interface BlockProgress {
  respondidas: number; // preguntas distintas ya intentadas del bloque
  falladas: number;
  porConsolidar: number;
  consolidada: number;
}

interface StateRow {
  questionId: string;
  dataset: Dataset;
  block: string;
  state: QuestionState;
}

// Calcula el estado de cada pregunta que se ha respondido al menos una vez.
async function getQuestionStateRows(): Promise<StateRow[]> {
  const db = await getDb();
  // Por pregunta (id + dataset): total de intentos (n) y la posición —contando
  // desde el más reciente— del primer fallo (fail_rn). fail_rn = 1 → el último
  // intento falló; fail_rn = NULL → nunca ha fallado. Los IDs pueden repetirse
  // entre datasets, así que todo se agrupa por (question_id, dataset).
  const res = await db.execute(`
    WITH ordered AS (
      SELECT question_id, dataset, correct,
             ROW_NUMBER() OVER (PARTITION BY question_id, dataset ORDER BY id DESC) AS rn
      FROM attempts
    ),
    firstFail AS (
      SELECT question_id, dataset, MIN(rn) AS fail_rn
      FROM ordered WHERE correct = 0 GROUP BY question_id, dataset
    ),
    totals AS (
      SELECT question_id, dataset,
             MIN(CASE WHEN block <> 'all' THEN block END) AS block,
             COUNT(*) AS n
      FROM attempts GROUP BY question_id, dataset
    )
    SELECT t.question_id, t.dataset, COALESCE(t.block, 'all') AS block, t.n, f.fail_rn
    FROM totals t
    LEFT JOIN firstFail f
      ON f.question_id = t.question_id AND f.dataset = t.dataset
  `);

  return res.rows.map((r) => {
    const failRn = r.fail_rn == null ? null : Number(r.fail_rn);
    const n = Number(r.n ?? 0);
    // Racha de aciertos al final del historial.
    const streak = failRn == null ? n : failRn - 1;
    let state: QuestionState;
    if (failRn === 1) state = "fallada"; // el último intento fue un fallo
    else if (streak >= CONSOLIDAR_RACHA) state = "consolidada";
    else state = "porConsolidar";
    return {
      questionId: String(r.question_id),
      dataset: (String(r.dataset) === "casos" ? "casos" : "test") as Dataset,
      block: String(r.block),
      state,
    };
  });
}

// Progreso agregado por bloque (clave `dataset:block`) y por dataset completo
// (clave `dataset:all`), para pintar los indicadores de la home.
export async function getBlockProgress(): Promise<Map<string, BlockProgress>> {
  const rows = await getQuestionStateRows();
  const map = new Map<string, BlockProgress>();
  const bump = (key: string, state: QuestionState) => {
    const p =
      map.get(key) ?? { respondidas: 0, falladas: 0, porConsolidar: 0, consolidada: 0 };
    p.respondidas += 1;
    if (state === "fallada") p.falladas += 1;
    else if (state === "porConsolidar") p.porConsolidar += 1;
    else p.consolidada += 1;
    map.set(key, p);
  };
  for (const r of rows) {
    bump(`${r.dataset}:${r.block}`, r.state);
    bump(`${r.dataset}:all`, r.state);
  }
  return map;
}

// IDs de las preguntas de un bloque (o "all") que están en el estado indicado.
// Se usa para lanzar exámenes de repaso filtrados.
export async function getQuestionIdsByState(
  dataset: Dataset,
  block: string,
  state: QuestionState
): Promise<string[]> {
  const rows = await getQuestionStateRows();
  return rows
    .filter(
      (r) =>
        r.dataset === dataset &&
        r.state === state &&
        (block === "all" || r.block === block)
    )
    .map((r) => r.questionId);
}
