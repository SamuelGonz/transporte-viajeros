import Link from "next/link";
import { getBlocks } from "@/lib/questions";
import { getDashboard } from "@/lib/stats";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("es-ES");

function datasetLabel(dataset: string) {
  return dataset === "casos" ? "🧩 Casos" : "📝 Test";
}

export default async function ProgresoPage() {
  const [data, testBlocks, casosBlocks] = await Promise.all([
    getDashboard(),
    getBlocks("test"),
    getBlocks("casos"),
  ]);

  // Mapa bloque -> título para etiquetar las barras.
  const titleMap = new Map<string, string>();
  for (const b of testBlocks) titleMap.set(`test:${b.id}`, b.title);
  for (const b of casosBlocks) titleMap.set(`casos:${b.id}`, `Bloque ${b.id}`);
  const bloqueTitulo = (dataset: string, block: string) => {
    if (block === "all") return "Todos los bloques";
    return titleMap.get(`${dataset}:${block}`) || `Bloque ${block}`;
  };

  return (
    <main className="container">
      <div className="topbar">
        <Link href="/" className="nav-link">
          ← Inicio
        </Link>
      </div>

      <h1 className="title">Tu progreso</h1>

      {!data.hasData ? (
        <div className="card center" style={{ marginTop: 24 }}>
          <p style={{ marginBottom: 16 }}>
            Todavía no has respondido ninguna pregunta. Haz un test o unos casos
            prácticos y aquí verás tus estadísticas. 📈
          </p>
          <Link href="/" className="btn">
            Empezar a practicar
          </Link>
        </div>
      ) : (
        <>
          {/* ---- KPIs ---- */}
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-value">{nf.format(data.resumen.total)}</span>
              <span className="kpi-label">Respuestas dadas</span>
            </div>
            <div className="kpi">
              <span className="kpi-value">{data.resumen.accuracy}%</span>
              <span className="kpi-label">
                Precisión ({nf.format(data.resumen.correct)} ✓ /{" "}
                {nf.format(data.resumen.wrong)} ✗)
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-value">{nf.format(data.resumen.distinctQuestions)}</span>
              <span className="kpi-label">Preguntas distintas practicadas</span>
            </div>
            <div className="kpi">
              <span className="kpi-value">{nf.format(data.resumen.activeDays)}</span>
              <span className="kpi-label">Días de estudio</span>
            </div>
          </div>

          {/* ---- Precisión por bloque ---- */}
          <section className="dash-section">
            <h2 className="dash-h2">Precisión por bloque</h2>
            <div className="bars">
              {data.porBloque.map((b) => (
                <div className="bar-row" key={`${b.dataset}:${b.block}`}>
                  <span className="bar-label" title={bloqueTitulo(b.dataset, b.block)}>
                    <span className="bar-tag">{datasetLabel(b.dataset)}</span>
                    {bloqueTitulo(b.dataset, b.block)}
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${b.accuracy}%` }} />
                  </span>
                  <span className="bar-value">
                    {b.accuracy}%
                    <span className="bar-sub"> · {nf.format(b.total)}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Actividad y precisión por día ---- */}
          <section className="dash-section">
            <h2 className="dash-h2">Precisión por día · últimos 14 días</h2>
            <div className="daychart">
              {data.porDia.map((d) => {
                const dayNum = d.date.slice(8, 10);
                const activo = d.total > 0;
                return (
                  <div
                    className="daycol"
                    key={d.date}
                    title={
                      activo
                        ? `${d.date}: ${d.accuracy}% aciertos · ${d.total} respuestas`
                        : `${d.date}: sin actividad`
                    }
                  >
                    <span className="daybar-track">
                      {activo ? (
                        <span
                          className="daybar-fill"
                          style={{ height: `${Math.max(d.accuracy, 3)}%` }}
                        />
                      ) : (
                        <span className="daybar-empty" />
                      )}
                    </span>
                    <span className="daybar-num">{activo ? `${d.accuracy}%` : ""}</span>
                    <span className="daylabel">{dayNum}</span>
                  </div>
                );
              })}
            </div>
            <p className="dash-note">La altura de cada barra es tu % de aciertos ese día.</p>
          </section>

          {/* ---- Top falladas ---- */}
          <section className="dash-section">
            <h2 className="dash-h2">Preguntas que más fallas</h2>
            {data.topFalladas.length === 0 ? (
              <p className="dash-note">¡Aún no tienes fallos registrados! 🎉</p>
            ) : (
              <ol className="fail-list">
                {data.topFalladas.map((q) => (
                  <li className="fail-item" key={`${q.dataset}:${q.questionId}`}>
                    <div className="fail-head">
                      <span className="bar-tag">{datasetLabel(q.dataset)}</span>
                      <span className="fail-id">N.º {q.questionId}</span>
                      <span className="fail-metrics">
                        <span className="fail-wrong">{q.wrong} fallos</span> · {q.accuracy}%
                        aciertos · {q.total} intentos
                      </span>
                    </div>
                    <p className="fail-text">{q.pregunta}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}
