import Link from "next/link";
import { getBlocks } from "@/lib/questions";
import StartForm from "./StartForm";
import LogoutButton from "./LogoutButton";

export default async function HomePage() {
  const [testBlocks, casosBlocks] = await Promise.all([
    getBlocks("test"),
    getBlocks("casos"),
  ]);
  const totalTest = testBlocks.reduce((s, b) => s + b.count, 0);
  const totalCasos = casosBlocks.reduce((s, b) => s + b.count, 0);

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
        <StartForm dataset="test" blocks={testBlocks} total={totalTest} allLabel="Todos los bloques mezclados" />
      </section>

      {casosBlocks.length > 0 && (
        <section className="dataset-section">
          <h2 className="dataset-heading">🧩 Casos prácticos</h2>
          <p className="dataset-desc">
            Cada caso plantea un supuesto real con varias cuestiones. Elige la
            combinación de respuestas correcta (A–H).
          </p>
          <StartForm dataset="casos" blocks={casosBlocks} total={totalCasos} allLabel="Todos los casos mezclados" />
        </section>
      )}
    </main>
  );
}
