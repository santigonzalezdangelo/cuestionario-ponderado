"use client";

import { useEffect, useRef, useState } from "react";
import { BUCKET, fetchCostumes, photoUrl, supabase, type Costume } from "@/lib/supabase";
import { compressImage, errorMessage, randomId } from "@/lib/browser";

export default function CostumesTab() {
  const [costumes, setCostumes] = useState<Costume[] | null>(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCostumes()
      .then(setCostumes)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (!f && fileInput.current) fileInput.current.value = "";
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setSaving(true);
    setError("");
    const sb = supabase();
    const path = `${randomId()}.jpg`;
    try {
      const blob = await compressImage(file);
      const upload = await sb.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (upload.error) throw upload.error;
      const { data, error } = await sb
        .from("costumes")
        .insert({ name: name.trim(), photo_path: path })
        .select()
        .single();
      if (error) {
        await sb.storage.from(BUCKET).remove([path]);
        throw error;
      }
      setCostumes((prev) => [...(prev ?? []), data]);
      setName("");
      pickFile(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-line bg-card/60 p-4">
        <h2 className="text-lg font-semibold">Agregar disfraz</h2>
        <label className="relative flex aspect-[3/4] max-h-80 w-full cursor-pointer items-center justify-center self-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-night sm:w-60">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <span className="px-4 text-center text-muted">
              📷
              <br />
              Tocá para sacar o elegir la foto
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          className="input"
          placeholder="Personaje (ej: Morticia y Homero Addams)"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="btn-primary" disabled={saving || !file || !name.trim()}>
          {saving ? "Subiendo…" : "Agregar disfraz"}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Cargados {costumes ? `(${costumes.length})` : ""}
        </h2>
        {!costumes ? (
          <p className="text-muted">Cargando…</p>
        ) : costumes.length === 0 ? (
          <p className="text-muted">Todavía no hay disfraces.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[...costumes].reverse().map((c) => (
              <CostumeItem
                key={c.id}
                costume={c}
                onChange={(updated) =>
                  setCostumes((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)
                }
                onDelete={(id) => setCostumes((prev) => prev?.filter((x) => x.id !== id) ?? null)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CostumeItem({
  costume,
  onChange,
  onDelete,
}: {
  costume: Costume;
  onChange: (c: Costume) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(costume.name);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    const { data, error } = await supabase()
      .from("costumes")
      .update({ name: value.trim() })
      .eq("id", costume.id)
      .select()
      .single();
    setBusy(false);
    if (error) return alert(error.message);
    onChange(data);
    setEditing(false);
  }

  async function remove() {
    if (!confirm(`¿Borrar "${costume.name}"?\nSi alguien ya lo votó, ese puesto de su voto queda vacío.`)) {
      return;
    }
    setBusy(true);
    const sb = supabase();
    const { error } = await sb.from("costumes").delete().eq("id", costume.id);
    if (error) {
      setBusy(false);
      return alert(error.message);
    }
    await sb.storage.from(BUCKET).remove([costume.photo_path]);
    onDelete(costume.id);
  }

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl(costume.photo_path)}
        alt={costume.name}
        loading="lazy"
        className="aspect-[3/4] w-full object-cover"
      />
      <div className="flex flex-col gap-2 p-2">
        {editing ? (
          <>
            <input
              className="input px-2 py-1.5 text-sm"
              value={value}
              maxLength={120}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 text-sm">
              <button className="text-pumpkin" onClick={save} disabled={busy}>
                Guardar
              </button>
              <button
                className="text-muted"
                onClick={() => {
                  setValue(costume.name);
                  setEditing(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium leading-tight">{costume.name}</p>
            <div className="flex gap-3 text-xs">
              <button className="text-muted underline" onClick={() => setEditing(true)} disabled={busy}>
                Editar
              </button>
              <button className="text-red-300 underline" onClick={remove} disabled={busy}>
                Borrar
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
