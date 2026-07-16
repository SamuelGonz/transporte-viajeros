"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Question } from "@/lib/questions";
import StatsBar, { type QuestionStats } from "./StatsBar";

type Status = "loading" | "ready" | "error";

export default function ExamClient() {
  const params = useSearchParams();
  const type = params.get("type") === "casos" ? "casos" : "test";
  const block = params.get("block") || "all";
  const count = params.get("count") || "10";
  const mode = params.get("mode") || "";
  const esCaso = type === "casos";

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("No se pudieron cargar las preguntas.");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [aciertos, setAciertos] = useState(0);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<QuestionStats | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    const modeParam = mode ? `&mode=${mode}` : "";
    fetch(`/api/questions?type=${type}&block=${block}&count=${count}${modeParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.questions?.length) {
          setQuestions(data.questions);
          setStatus("ready");
        } else {
          // Sin preguntas: en modo repaso suele significar que no hay pendientes.
          if (mode === "falladas") {
            setErrorMsg("¡No tienes preguntas falladas en este bloque! 🎉");
          } else if (mode === "consolidar") {
            setErrorMsg("¡No tienes preguntas por consolidar en este bloque! 🎉");
          }
          setStatus("error");
        }
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [type, block, count, mode]);

  if (status === "loading") {
    return (
      <main className="container">
        <p className="loading">Preparando tu {esCaso ? "examen de casos" : "test"}…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="container">
        <div className="card center">
          <p style={{ marginBottom: 16 }}>{errorMsg}</p>
          <Link href="/" className="btn btn-secondary">
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  // ---- Pantalla de resultado ----
  if (finished) {
    const totalPreg = questions.length;
    const pct = Math.round((aciertos / totalPreg) * 100);
    const aprobado = pct >= 60;
    return (
      <main className="container">
        <div className="card center">
          <p className="section-label">Resultado</p>
          <div
            className="result-score"
            style={{ color: aprobado ? "var(--correct)" : "var(--wrong)" }}
          >
            {aciertos}/{totalPreg}
          </div>
          <p className="result-detail">
            {pct}% de aciertos · {aprobado ? "¡Aprobado! 🎉" : "Sigue practicando 💪"}
          </p>
          <div className="result-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Repetir
            </button>
            <Link href="/" className="btn btn-secondary">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ---- Pregunta / caso actual ----
  const q = questions[index];
  const letras = Object.keys(q.opciones); // A-D en test, A-H en casos
  const answered = selected !== null;
  const isLast = index === questions.length - 1;

  const handleSelect = (opt: string) => {
    if (answered) return;
    const acierto = opt === q.solucion;
    setSelected(opt);
    if (acierto) setAciertos((a) => a + 1);

    // Registra el intento y muestra la ficha con las estadísticas actualizadas.
    setStats(null);
    fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: q.id,
        dataset: type,
        block,
        selected: opt,
        correct: acierto,
      }),
    })
      .then((r) => r.json())
      .then((data) => data?.stats && setStats(data.stats))
      .catch(() => {
        /* si falla el guardado, no bloqueamos el examen */
      });
  };

  const handleNext = () => {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setStats(null);
  };

  const optionClass = (opt: string) => {
    if (!answered) return "option";
    if (opt === q.solucion) return "option correct";
    if (opt === selected) return "option wrong";
    return "option";
  };

  const progress = ((index + (answered ? 1 : 0)) / questions.length) * 100;

  return (
    <main className="container">
      <div className="exam-header">
        <Link href="/" className="link-back">
          ← Salir
        </Link>
        <span className="progress-info">
          {esCaso ? "Caso" : "Pregunta"} {index + 1} de {questions.length} · Aciertos:{" "}
          {aciertos}
        </span>
      </div>

      <div className="progress-bar">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="card">
        <p className={`question-text ${esCaso ? "caso-text" : ""}`}>{q.pregunta}</p>

        <div className="options">
          {letras.map((opt) => (
            <button
              key={opt}
              type="button"
              className={optionClass(opt)}
              onClick={() => handleSelect(opt)}
              disabled={answered}
            >
              <span className="letter">{opt}</span>
              <span className={esCaso ? "option-multiline" : ""}>{q.opciones[opt]}</span>
            </button>
          ))}
        </div>

        {answered && (
          <>
            <div className={`feedback ${selected === q.solucion ? "ok" : "ko"}`}>
              {selected === q.solucion
                ? "✓ ¡Correcto!"
                : `✗ Incorrecto. La respuesta correcta es la ${q.solucion}.`}
            </div>
            {q.norma && (
              <p className="norma">
                <b>Norma:</b> {q.norma}
              </p>
            )}
            {stats && <StatsBar stats={stats} />}
          </>
        )}
      </div>

      {answered && (
        <div className="exam-footer">
          <button type="button" className="btn" onClick={handleNext}>
            {isLast ? "Ver resultado →" : "Continuar →"}
          </button>
        </div>
      )}
    </main>
  );
}
