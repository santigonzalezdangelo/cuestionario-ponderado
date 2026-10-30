"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase, type Status, type Vote } from "@/lib/supabase";
import { errorMessage } from "@/lib/browser";

export default function VotingTab({
  status,
  changeStatus,
}: {
  status: Status;
  changeStatus: (s: Status) => Promise<void>;
}) {
  const [votes, setVotes] = useState<Vote[] | null>(null);
  const [costumeCount, setCostumeCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);

  // Este tab solo se dibuja en el navegador (después del login), así que window existe.
  const link = `${window.location.origin}/`;

  useEffect(() => {
    const sb = supabase();
    async function load() {
      const [v, c] = await Promise.all([
        sb.from("votes").select("*").order("created_at", { ascending: false }),
        sb.from("costumes").select("id", { count: "exact", head: true }),
      ]);
      if (v.error) throw v.error;
      if (c.error) throw c.error;
      setVotes(v.data);
      setCostumeCount(c.count ?? 0);
      setError("");
    }
    const tick = () => load().catch((e) => setError(errorMessage(e)));
    tick();
    const timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, [reload]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteVote(vote: Vote) {
    if (!confirm(`¿Borrar el voto de "${vote.voter_name}"?`)) return;
    await run(async () => {
      const { error } = await supabase().from("votes").delete().eq("id", vote.id);
      if (error) throw error;
      setReload((n) => n + 1);
    });
  }

  async function deleteAllVotes() {
    if (!confirm("¿Borrar TODOS los votos? Usalo solo para limpiar las pruebas.")) return;
    if (!confirm("Seguro? Esto no se puede deshacer.")) return;
    await run(async () => {
      const { error } = await supabase().from("votes").delete().not("id", "is", null);
      if (error) throw error;
      setReload((n) => n + 1);
    });
  }

  const nameCounts = new Map<string, number>();
  for (const v of votes ?? []) {
    const key = v.voter_name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const tooFewCostumes = costumeCount !== null && costumeCount < 3;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card/60 p-4">
        <h2 className="text-lg font-semibold">Estado</h2>
        {status === "abierta" ? (
          <>
            <p className="text-muted">Los invitados pueden votar ahora.</p>
            <button
              className="btn-danger"
              disabled={busy}
              onClick={() =>
                confirm("¿Cerrar la votación? Nadie más va a poder votar.") &&
                run(() => changeStatus("cerrada"))
              }
            >
              🔒 Cerrar votación
            </button>
          </>
        ) : (
          <>
            <p className="text-muted">
              {status === "preparando"
                ? "Cargá los disfraces y, cuando estén todos, abrí la votación."
                : "La votación está cerrada. Podés ver el podio en Resultados."}
            </p>
            <button
              className="btn-primary"
              disabled={busy || tooFewCostumes}
              onClick={() => run(() => changeStatus("abierta"))}
            >
              🗳️ {status === "cerrada" ? "Reabrir votación" : "Abrir votación"}
            </button>
            {tooFewCostumes && (
              <p className="text-sm text-muted">Necesitás al menos 3 disfraces cargados.</p>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card/60 p-4">
        <h2 className="self-start text-lg font-semibold">Link para los invitados</h2>
        <button onClick={() => setShowQr(true)} className="rounded-xl bg-white p-3">
          <QRCodeSVG value={link} size={200} />
        </button>
        <p className="break-all text-center text-sm text-muted">{link}</p>
        <div className="grid w-full grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={() => setShowQr(true)}>
            Pantalla completa
          </button>
          <button
            className="btn-ghost"
            onClick={() =>
              navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
            }
          >
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Votos recibidos</h2>
          <span className="font-spooky text-4xl text-pumpkin">{votes?.length ?? "–"}</span>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {votes && votes.length === 0 && <p className="text-muted">Todavía no votó nadie.</p>}
        {votes && votes.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {votes.map((v) => {
              const repeated = (nameCounts.get(v.voter_name.trim().toLowerCase()) ?? 0) > 1;
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>
                    {repeated && <span title="Nombre repetido">⚠️ </span>}
                    {v.voter_name}
                    <span className="ml-2 text-xs text-muted">
                      {new Date(v.created_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <button
                    className="text-xs text-red-300 underline"
                    disabled={busy}
                    onClick={() => deleteVote(v)}
                  >
                    Borrar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">
          ⚠️ = nombre repetido. Puede ser alguien que votó dos veces (o dos personas con el mismo
          nombre).
        </p>
        <button className="btn-danger mt-4" disabled={busy} onClick={deleteAllVotes}>
          Borrar todos los votos (para limpiar pruebas)
        </button>
      </section>

      {showQr && (
        <button
          onClick={() => setShowQr(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6 text-night"
        >
          <p className="font-spooky text-5xl text-pumpkin-dark">¡Votá el mejor disfraz!</p>
          <QRCodeSVG value={link} size={320} className="h-auto w-full max-w-[min(80vw,70vh)]" />
          <p className="break-all text-lg">{link}</p>
          <p className="text-sm text-gray-500">Tocá para cerrar</p>
        </button>
      )}
    </div>
  );
}
