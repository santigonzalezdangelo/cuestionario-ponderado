"use client";

import { useEffect, useState } from "react";
import {
  fetchCostumes,
  fetchStatus,
  isConfigured,
  NOT_CONFIGURED_MESSAGE,
  photoUrl,
  supabase,
  type Costume,
  type Status,
} from "@/lib/supabase";
import { errorMessage, getVoterToken } from "@/lib/browser";

type Phase = "cargando" | "error" | "esperando" | "votando" | "enviado" | "ya_voto";

const MEDALS = ["🥇", "🥈", "🥉"];
const POINTS = [3, 2, 1];

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Page() {
  if (!isConfigured) return <Message emoji="👻" title="Falta configurar" text={NOT_CONFIGURED_MESSAGE} />;
  return <VotePage />;
}

function VotePage() {
  const [phase, setPhase] = useState<Phase>("cargando");
  const [status, setStatus] = useState<Status>("preparando");
  const [costumes, setCostumes] = useState<Costume[]>([]);
  const [picks, setPicks] = useState<(string | null)[]>([null, null, null]);
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<Costume | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const [s, voted] = await Promise.all([
          fetchStatus(),
          supabase().rpc("has_voted", { p_token: getVoterToken() }),
        ]);
        if (voted.error) throw voted.error;
        if (cancelled) return;
        if (voted.data) return setPhase("ya_voto");
        setStatus(s);
        if (s !== "abierta") {
          setPhase("esperando");
          // Mientras espera, se fija cada 10 s si el anfitrión abrió la votación.
          timer = setTimeout(load, 10000);
          return;
        }
        const list = await fetchCostumes();
        if (cancelled) return;
        // Orden al azar en cada celu, para que no gane siempre el primero de la lista.
        setCostumes(shuffle(list));
        setPhase("votando");
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e));
        setPhase("error");
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt]);

  function toggle(id: string) {
    setPicks((prev) => {
      const i = prev.indexOf(id);
      if (i >= 0) return prev.map((p, j) => (j === i ? null : p));
      const free = prev.indexOf(null);
      if (free < 0) return prev;
      return prev.map((p, j) => (j === free ? id : p));
    });
  }

  const complete = picks.every(Boolean);
  const canSend = complete && name.trim().length > 0 && !sending;

  async function submit() {
    if (!canSend) return;
    if (!confirm("¿Enviar tu voto? Después no se puede cambiar.")) return;
    setSending(true);
    setError("");
    const { data, error } = await supabase().rpc("submit_vote", {
      p_token: getVoterToken(),
      p_name: name.trim(),
      p_first: picks[0],
      p_second: picks[1],
      p_third: picks[2],
    });
    setSending(false);
    if (error) return setError("No se pudo enviar. Revisá la conexión y probá de nuevo.");
    if (data === "ok") return setPhase("enviado");
    if (data === "ya_votaste") return setPhase("ya_voto");
    if (data === "cerrada") {
      setStatus("cerrada");
      return setPhase("esperando");
    }
    setError("Algo no cuadró (¿borraron un disfraz?). Recargá la página y volvé a elegir.");
  }

  if (phase === "cargando") return <Message emoji="🎃" title="Cargando…" />;
  if (phase === "error") {
    return (
      <Message emoji="👻" title="Ups, no se pudo cargar" text={error}>
        <button className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          Reintentar
        </button>
      </Message>
    );
  }
  if (phase === "ya_voto") {
    return <Message emoji="✅" title="Ya votaste" text="Desde este celular ya se envió un voto. ¡Gracias!" />;
  }
  if (phase === "enviado") {
    return (
      <Message
        emoji="🦇"
        title="¡Voto enviado!"
        text="Gracias por votar. El anfitrión va a anunciar el podio."
      />
    );
  }
  if (phase === "esperando") {
    return (
      <Message
        emoji={status === "cerrada" ? "🔒" : "🕸️"}
        title={status === "cerrada" ? "La votación terminó" : "La votación todavía no empezó"}
        text={
          status === "cerrada"
            ? "Ya no se pueden enviar votos."
            : "Dejá esta página abierta: se va a abrir sola cuando el anfitrión largue la votación."
        }
      >
        <button className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
          Actualizar
        </button>
      </Message>
    );
  }

  const byId = new Map(costumes.map((c) => [c.id, c]));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-56">
      <header className="py-6 text-center">
        <h1 className="font-spooky text-4xl text-pumpkin sm:text-5xl">El mejor disfraz</h1>
        <p className="mt-2 text-muted">
          Tocá tus 3 favoritos en orden: el primero que elijas es tu 🥇 (3 pts), después 🥈 (2 pts)
          y 🥉 (1 pt). Tocá de nuevo para sacarlo.
        </p>
      </header>

      <input
        className="input mb-5"
        placeholder="Tu nombre"
        maxLength={60}
        autoComplete="given-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {costumes.map((c) => {
          const rank = picks.indexOf(c.id);
          const selected = rank >= 0;
          return (
            <li
              key={c.id}
              className={`relative overflow-hidden rounded-2xl border-2 bg-card transition ${
                selected ? "border-pumpkin" : "border-transparent"
              }`}
            >
              <button onClick={() => toggle(c.id)} className="block w-full text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(c.photo_path)}
                  alt={c.name}
                  loading="lazy"
                  className={`aspect-[3/4] w-full object-cover transition ${selected ? "opacity-80" : ""}`}
                />
                <p className="p-2 text-sm font-medium leading-tight">{c.name}</p>
              </button>
              {selected && (
                <span className="pointer-events-none absolute left-2 top-2 text-4xl drop-shadow">
                  {MEDALS[rank]}
                </span>
              )}
              <button
                onClick={() => setZoom(c)}
                aria-label={`Ver foto de ${c.name}`}
                className="absolute right-2 top-2 rounded-full bg-night/70 px-2.5 py-1 text-sm"
              >
                🔍
              </button>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-night/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3">
          <ol className="grid grid-cols-3 gap-2 text-xs">
            {picks.map((id, i) => (
              <li key={i} className="flex items-center gap-1 rounded-lg bg-card px-2 py-1.5">
                <span className="text-lg">{MEDALS[i]}</span>
                <span className={`truncate ${id ? "" : "text-muted"}`}>
                  {id ? byId.get(id)?.name : `${POINTS[i]} pts`}
                </span>
              </li>
            ))}
          </ol>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className="btn-primary" disabled={!canSend} onClick={submit}>
            {sending
              ? "Enviando…"
              : !complete
                ? `Elegí ${picks.filter((p) => !p).length} más`
                : !name.trim()
                  ? "Escribí tu nombre arriba"
                  : "Enviar voto"}
          </button>
        </div>
      </div>

      {zoom && (
        <button
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/95 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(zoom.photo_path)}
            alt={zoom.name}
            className="max-h-[80vh] max-w-full rounded-xl object-contain"
          />
          <p className="text-lg font-semibold">{zoom.name}</p>
          <p className="text-sm text-muted">Tocá para cerrar</p>
        </button>
      )}
    </div>
  );
}

function Message({
  emoji,
  title,
  text,
  children,
}: {
  emoji: string;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="text-6xl">{emoji}</div>
      <h1 className="font-spooky text-4xl text-pumpkin">{title}</h1>
      {text && <p className="text-muted">{text}</p>}
      {children}
    </div>
  );
}
