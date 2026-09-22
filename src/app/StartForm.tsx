"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BlockInfo, Dataset } from "@/lib/questions";
import type { BlockProgress } from "@/lib/stats";

const COUNTS = [10, 25, 50, 100, 200];
const REVIEW_MODES = [
  { value: "falladas", label: "Repasar falladas" },
  { value: "consolidar", label: "Consolidar pendientes" },
  { value: "antiguas", label: "Más tiempo sin salir" },
  { value: "nuevas", label: "Nunca respondidas" },
];
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
  // Modo de repaso elegido en el selector de cada bloque.
  const [modes, setModes] = useState<Record<string, string>>({});

  const go = (block: string, mode?: string) => {
    const base = `type=${dataset}&block=${block}&count=${count}`;
    router.push(`/examen?${base}${mode ? `&mode=${mode}` : ""}`);
  };

  // Bloque de indicadores + botones de repaso que va bajo cada tarjeta.
  const Progress = ({ id, totalPreg }: { id: string; totalPreg: number }) => {
    const p = progress[id] ?? EMPTY;
    const mode = modes[id] ?? "falladas";
    const nuncaRespondidas = Math.max(totalPreg - p.respondidas, 0);
    // "antiguas" siempre tiene preguntas (incluye las nunca respondidas).
    const sinPendientes =
      (mode === "falladas" && p.falladas === 0) ||
      (mode === "consolidar" && p.porConsolidar === 0) ||
      (mode === "nuevas" && nuncaRespondidas === 0);
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
          <span className="bp-state bp-new" title="Todavía no han salido ninguna vez">
            ☆ {nuncaRespondidas.toLocaleString("es-ES")} sin salir
          </span>
        </div>
        <div className="block-actions">
          <select
            className="mini-select"
            aria-label="Modo de repaso"
            value={mode}
            onChange={(e) => setModes((m) => ({ ...m, [id]: e.target.value }))}
          >
            {REVIEW_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mini-btn"
            disabled={sinPendientes}
            onClick={() => go(id, mode)}
          >
            Repasar
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
            {COUNTS.filter((c, i) => i === 0 || c <= total).map((c) => (
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
