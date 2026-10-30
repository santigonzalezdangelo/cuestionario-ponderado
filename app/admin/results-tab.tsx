"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, type Result, type Status } from "@/lib/supabase";
import { errorMessage } from "@/lib/browser";
import Thumb from "../thumb";

const MEDALS = ["", "🥇", "🥈", "🥉"];

type Ranked = Result & { pos: number; tied: boolean };

// Mismo orden que get_results(): puntos, después 1° puestos, después 2° puestos.
// Si todo eso coincide, comparten posición (empate).
function rank(results: Result[]): Ranked[] {
  const positions: number[] = [];
  results.forEach((r, i) => {
    const prev = results[i - 1];
    const same =
      prev && prev.points === r.points && prev.firsts === r.firsts && prev.seconds === r.seconds;
    positions.push(same ? positions[i - 1] : i + 1);
  });
  return results.map((r, i) => ({
    ...r,
    pos: positions[i],
    tied: positions.filter((p) => p === positions[i]).length > 1,
  }));
}

async function fetchResults() {
  const sb = supabase();
  const [r, c] = await Promise.all([
    sb.rpc("get_results"),
    sb.from("votes").select("id", { count: "exact", head: true }),
  ]);
  if (r.error) throw r.error;
  if (c.error) throw c.error;
  return { results: r.data as Result[], count: c.count ?? 0 };
}

export default function ResultsTab({
  status,
  changeStatus,
}: {
  status: Status;
  changeStatus: (s: Status) => Promise<void>;
}) {
  const [peek, setPeek] = useState(false);
  const [results, setResults] = useState<Ranked[] | null>(null);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(0);
  const show = status === "cerrada" || peek;

  const load = useCallback(() => {
    fetchResults()
      .then(({ results, count }) => {
        setResults(rank(results));
        setVoteCount(count);
        setError("");
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetchResults()
      .then(({ results, count }) => {
        if (cancelled) return;
        setResults(rank(results));
        setVoteCount(count);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [show]);

  if (!show) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card/60 p-4">
        <p className="text-muted">
          {status === "abierta"
            ? "La votación sigue abierta. Cerrala cuando hayan votado todos para ver el podio."
            : "La votación todavía no empezó."}
        </p>
        {status === "abierta" && (
          <button
            className="btn-primary"
            onClick={() =>
              confirm("¿Cerrar la votación y ver los resultados?") &&
              changeStatus("cerrada").catch((e) => alert(errorMessage(e)))
            }
          >
            🔒 Cerrar votación y ver resultados
          </button>
        )}
        <button className="text-sm text-muted underline" onClick={() => setPeek(true)}>
          Espiar resultados parciales
        </button>
      </div>
    );
  }

  if (error) return <p className="text-red-300">{error}</p>;
  if (!results) return <p className="text-muted">Calculando…</p>;

  const podium = results.filter((r) => r.pos <= 3 && r.points > 0);
  // Se revela de abajo hacia arriba: primero el 3° puesto, al final el 1°.
  const podiumPositions = [...new Set(podium.map((r) => r.pos))].sort((a, b) => b - a);
  const visiblePositions = new Set(podiumPositions.slice(0, revealed));
  const allRevealed = revealed >= podiumPositions.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {voteCount} {voteCount === 1 ? "voto" : "votos"}
          {status !== "cerrada" && " · parciales (la votación sigue abierta)"}
        </span>
        <button className="underline" onClick={load}>
          Actualizar
        </button>
      </div>

      {podium.length === 0 ? (
        <p className="text-muted">Todavía no hay votos.</p>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="text-center font-spooky text-4xl text-pumpkin">Podio</h2>
          {[...podium]
            .filter((r) => visiblePositions.has(r.pos))
            .sort((a, b) => a.pos - b.pos)
            .map((r) => (
              <article
                key={r.id}
                className={`flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-3 ${
                  r.pos === 1 ? "border-pumpkin" : "border-line"
                }`}
              >
                <Thumb
                  path={r.photo_path}
                  alt={r.name}
                  className={`aspect-[3/4] rounded-xl object-cover ${r.pos === 1 ? "w-36" : "w-24"}`}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-4xl">{MEDALS[r.pos]}</span>
                  <span className={`font-semibold ${r.pos === 1 ? "text-2xl" : "text-lg"}`}>{r.name}</span>
                  <span className="text-sm text-muted">
                    {r.points} pts{r.tied && " · empate"}
                  </span>
                </div>
              </article>
            ))}
          {!allRevealed && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => setRevealed((n) => n + 1)}>
                Revelar {podiumPositions[revealed]}° puesto
              </button>
              <button className="btn-ghost" onClick={() => setRevealed(podiumPositions.length)}>
                Mostrar todo
              </button>
            </div>
          )}
        </section>
      )}

      {allRevealed && podium.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Ranking completo</h2>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-muted">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Disfraz</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                  <th className="px-3 py-2 text-right" title="Veces votado 1° / 2° / 3°">
                    1°/2°/3°
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-muted">{r.pos}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.points}</td>
                    <td className="px-3 py-2 text-right text-muted">
                      {r.firsts}/{r.seconds}/{r.thirds}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            1° = 3 pts, 2° = 2 pts, 3° = 1 pt. Desempate: más primeros puestos, después más segundos.
          </p>
        </section>
      )}
    </div>
  );
}
