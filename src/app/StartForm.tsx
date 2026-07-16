"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BlockInfo, Dataset } from "@/lib/questions";
import type { BlockProgress } from "@/lib/stats";

const COUNTS = [10, 25, 50, 100];
const EMPTY: BlockProgress = {
  respondidas: 0,
  falladas: 0,
  porConsolidar: 0,
  consolidada: 0,
};

export default function StartForm({
  dataset,
  blocks,
  total,
  allLabel,
  progress,
}: {
  dataset: Dataset;
  blocks: BlockInfo[];
  total: number;
  allLabel: string;
  progress: Record<string, BlockProgress>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("all");
  const [count, setCount] = useState<number>(10);

  const go = (block: string, mode?: string) => {
    const base = `type=${dataset}&block=${block}&count=${count}`;
    router.push(`/examen?${base}${mode ? `&mode=${mode}` : ""}`);
  };

  // Bloque de indicadores + botones de repaso que va bajo cada tarjeta.
  const Progress = ({ id, totalPreg }: { id: string; totalPreg: number }) => {
    const p = progress[id] ?? EMPTY;
    return (
      <div className="block-progress">
        <div className="bp-summary">
          <b>{p.respondidas.toLocaleString("es-ES")}</b>
          {" / "}
          {totalPreg.toLocaleString("es-ES")} respondidas
        </div>
        <div className="bp-states">
          <span className="bp-state bp-fail" title="Último intento incorrecto">
            ✗ {p.falladas} falladas
          </span>
          <span
            className="bp-state bp-pend"
            title="Acertadas, pero aún sin 3 aciertos seguidos"
          >
            ◐ {p.porConsolidar} por consolidar
          </span>
          <span className="bp-state bp-done" title="3 o más aciertos seguidos">
            ✓ {p.consolidada} consolidadas
          </span>
        </div>
        <div className="block-actions">
          <button
            type="button"
            className="mini-btn"
            disabled={p.falladas === 0}
            onClick={() => go(id, "falladas")}
          >
            Repasar falladas
          </button>
          <button
            type="button"
            className="mini-btn"
            disabled={p.porConsolidar === 0}
            onClick={() => go(id, "consolidar")}
          >
            Consolidar pendientes
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="block-grid">
        <div className="block-cell">
          <button
            type="button"
            className={`block-btn ${selected === "all" ? "selected" : ""}`}
            onClick={() => setSelected("all")}
          >
            <span className="b-id">★ TODOS</span>
            <span className="b-title">{allLabel}</span>
            <span className="b-count">{total.toLocaleString("es-ES")} preguntas</span>
          </button>
          <Progress id="all" totalPreg={total} />
        </div>

        {blocks.map((b) => (
          <div key={b.id} className="block-cell">
            <button
              type="button"
              className={`block-btn ${selected === b.id ? "selected" : ""}`}
              onClick={() => setSelected(b.id)}
            >
              <span className="b-id">Bloque {b.id}</span>
              <span className="b-title">{b.title}</span>
              <span className="b-count">{b.count} preguntas</span>
            </button>
            <Progress id={b.id} totalPreg={b.count} />
          </div>
        ))}
      </div>

      <div className="controls-row">
        <div className="field">
          <label htmlFor={`count-${dataset}`}>Número de preguntas</label>
          <select
            id={`count-${dataset}`}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {COUNTS.map((c) => (
              <option key={c} value={c}>
                {c} preguntas
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="btn" onClick={() => go(selected)}>
          Empezar →
        </button>
      </div>
    </>
  );
}
