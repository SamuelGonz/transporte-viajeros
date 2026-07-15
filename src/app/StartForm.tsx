"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BlockInfo, Dataset } from "@/lib/questions";

const COUNTS = [10, 25, 50, 100];

export default function StartForm({
  dataset,
  blocks,
  total,
  allLabel,
}: {
  dataset: Dataset;
  blocks: BlockInfo[];
  total: number;
  allLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("all");
  const [count, setCount] = useState<number>(10);

  const start = () => {
    router.push(`/examen?type=${dataset}&block=${selected}&count=${count}`);
  };

  return (
    <>
      <div className="block-grid">
        <button
          type="button"
          className={`block-btn ${selected === "all" ? "selected" : ""}`}
          onClick={() => setSelected("all")}
        >
          <span className="b-id">★ TODOS</span>
          <span className="b-title">{allLabel}</span>
          <span className="b-count">{total.toLocaleString("es-ES")} preguntas</span>
        </button>

        {blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`block-btn ${selected === b.id ? "selected" : ""}`}
            onClick={() => setSelected(b.id)}
          >
            <span className="b-id">Bloque {b.id}</span>
            <span className="b-title">{b.title}</span>
            <span className="b-count">{b.count} preguntas</span>
          </button>
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

        <button type="button" className="btn" onClick={start}>
          Empezar →
        </button>
      </div>
    </>
  );
}
