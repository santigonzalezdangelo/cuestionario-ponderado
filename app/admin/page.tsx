"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  fetchStatus,
  isConfigured,
  NOT_CONFIGURED_MESSAGE,
  supabase,
  type Status,
} from "@/lib/supabase";
import { errorMessage } from "@/lib/browser";
import Login from "./login";
import CostumesTab from "./costumes-tab";
import VotingTab from "./voting-tab";
import ResultsTab from "./results-tab";

type Tab = "disfraces" | "votacion" | "resultados";

const TABS: { id: Tab; label: string }[] = [
  { id: "disfraces", label: "📸 Disfraces" },
  { id: "votacion", label: "🗳️ Votación" },
  { id: "resultados", label: "🏆 Resultados" },
];

const STATUS_LABEL: Record<Status, string> = {
  preparando: "Preparando",
  abierta: "Votación abierta",
  cerrada: "Votación cerrada",
};

export default function AdminPage() {
  if (!isConfigured) {
    return <p className="m-auto max-w-sm p-6 text-center text-red-300">{NOT_CONFIGURED_MESSAGE}</p>;
  }
  return <Auth />;
}

function Auth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <p className="m-auto text-muted">Cargando…</p>;
  }
  if (!session) return <Login />;
  return <Panel email={session.user.email ?? ""} />;
}

function Panel({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("disfraces");
  const [status, setStatus] = useState<Status | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchStatus(), supabase().rpc("is_admin")])
      .then(([s, admin]) => {
        if (admin.error) throw admin.error;
        setStatus(s);
        setIsAdmin(Boolean(admin.data));
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const changeStatus = useCallback(async (next: Status) => {
    const { data, error } = await supabase()
      .from("settings")
      .update({ status: next })
      .eq("id", 1)
      .select("status");
    if (error) throw error;
    if (!data.length) throw new Error("Tu usuario no tiene permiso para cambiar el estado.");
    setStatus(next);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="flex items-center justify-between gap-3 py-5">
        <div>
          <h1 className="font-spooky text-3xl text-pumpkin">Panel del anfitrión</h1>
          {status && (
            <span className="mt-1 inline-block rounded-full border border-line px-3 py-0.5 text-xs text-muted">
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>
        <button
          className="text-sm text-muted underline"
          onClick={() => supabase().auth.signOut()}
          title={email}
        >
          Salir
        </button>
      </header>

      {isAdmin === false && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Entraste como <b>{email}</b>, pero ese email no está en la tabla <code>admins</code> de
          Supabase. Agregalo desde el SQL Editor (ver README) y recargá la página.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <nav className="sticky top-0 z-10 -mx-4 mb-5 grid grid-cols-3 gap-2 bg-night/90 px-4 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-pumpkin text-night" : "bg-card text-ghost"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "disfraces" && <CostumesTab />}
      {tab === "votacion" && status && <VotingTab status={status} changeStatus={changeStatus} />}
      {tab === "resultados" && status && (
        <ResultsTab status={status} changeStatus={changeStatus} />
      )}
    </div>
  );
}
