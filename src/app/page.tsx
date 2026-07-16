import Link from "next/link";
import { getBlocks, type Dataset } from "@/lib/questions";
import { getBlockProgress, type BlockProgress } from "@/lib/stats";
import StartForm from "./StartForm";
import LogoutButton from "./LogoutButton";

// El progreso se lee de la BD en cada carga.
export const dynamic = "force-dynamic";

// Convierte el mapa global (clave `dataset:block`) en un objeto plano por
// dataset (clave = id de bloque o "all"), serializable hacia el cliente.
function progressFor(
  dataset: Dataset,
  map: Map<string, BlockProgress>
): Record<string, BlockProgress> {
  const prefix = `${dataset}:`;
  const out: Record<string, BlockProgress> = {};
  for (const [key, val] of map) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = val;
  }
  return out;
}

export default async function HomePage() {
  const [testBlocks, casosBlocks, progress] = await Promise.all([
    getBlocks("test"),
    getBlocks("casos"),
    getBlockProgress(),
  ]);
  const totalTest = testBlocks.reduce((s, b) => s + b.count, 0);
  const totalCasos = casosBlocks.reduce((s, b) => s + b.count, 0);
  const testProgress = progressFor("test", progress);
  const casosProgress = progressFor("casos", progress);

  return (
    <main className="container">
      <div className="topbar">
        <Link href="/progreso" className="nav-link">
          📊 Mi progreso
        </Link>
        <LogoutButton />
      </div>
      <h1 className="title">Test Transporte de Viajeros</h1>
      <p className="subtitle">
        Practica el examen de competencia profesional · {totalTest.toLocaleString("es-ES")}{" "}
        preguntas tipo test
        {totalCasos > 0 && <> · {totalCasos.toLocaleString("es-ES")} casos prácticos</>}
      </p>

      <section>
        <h2 className="dataset-heading">📝 Preguntas tipo test</h2>
        <StartForm dataset="test" blocks={testBlocks} total={totalTest} allLabel="Todos los bloques mezclados" progress={testProgress} />
      </section>

      {casosBlocks.length > 0 && (
        <section className="dataset-section">
          <h2 className="dataset-heading">🧩 Casos prácticos</h2>
          <p className="dataset-desc">
            Cada caso plantea un supuesto real con varias cuestiones. Elige la
            combinación de respuestas correcta (A–H).
          </p>
          <StartForm dataset="casos" blocks={casosBlocks} total={totalCasos} allLabel="Todos los casos mezclados" progress={casosProgress} />
        </section>
      )}
    </main>
  );
}
