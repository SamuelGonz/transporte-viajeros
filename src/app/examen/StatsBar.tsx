"use client";

export interface QuestionStats {
  questionId: string;
  shown: number;
  correct: number;
  wrong: number;
  blank: number;
  previousAt: string | null;
}

// "hace 9 días", "hace 3 horas", "hace un momento"…
function tiempoRelativo(iso: string | null): string | null {
  if (!iso) return null;
  // SQLite guarda "YYYY-MM-DD HH:MM:SS" en UTC.
  const then = new Date(iso.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  const seg = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  const min = Math.round(seg / 60);
  const horas = Math.round(min / 60);
  const dias = Math.round(horas / 24);

  if (seg < 60) return "hace un momento";
  if (min < 60) return rtf.format(-min, "minute");
  if (horas < 24) return rtf.format(-horas, "hour");
  if (dias < 30) return rtf.format(-dias, "day");
  const meses = Math.round(dias / 30);
  if (meses < 12) return rtf.format(-meses, "month");
  return rtf.format(-Math.round(meses / 12), "year");
}

export default function StatsBar({ stats }: { stats: QuestionStats }) {
  const rel = tiempoRelativo(stats.previousAt);

  return (
    <div className="statsbar">
      <div className="statsbar-left">
        {rel ? (
          <span className="statsbar-when">Respondida {rel}</span>
        ) : (
          <span className="statsbar-when statsbar-new">Primera vez que la ves</span>
        )}
        <span className="statsbar-metrics">
          <span className="metric metric-shown" title="Veces respondida">
            <span className="dot">👁</span> {stats.shown}
          </span>
          <span className="metric metric-correct" title="Aciertos">
            <span className="dot">✓</span> {stats.correct}
          </span>
          <span className="metric metric-wrong" title="Fallos">
            <span className="dot">✗</span> {stats.wrong}
          </span>
          <span className="metric metric-blank" title="Sin contestar">
            <span className="dot">○</span> {stats.blank}
          </span>
        </span>
      </div>
      <span className="statsbar-id">Pregunta N.º {stats.questionId}</span>
    </div>
  );
}
