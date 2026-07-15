import { Suspense } from "react";
import ExamClient from "./ExamClient";

export default function ExamenPage() {
  return (
    <Suspense
      fallback={
        <main className="container">
          <p className="loading">Cargando…</p>
        </main>
      }
    >
      <ExamClient />
    </Suspense>
  );
}
