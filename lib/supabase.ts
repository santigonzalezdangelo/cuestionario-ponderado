import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "fotos";

export type Status = "preparando" | "abierta" | "cerrada";

export type Costume = {
  id: string;
  name: string;
  photo_path: string;
  created_at: string;
};

export type Vote = {
  id: string;
  voter_name: string;
  first_id: string | null;
  second_id: string | null;
  third_id: string | null;
  created_at: string;
};

export type Result = {
  id: string;
  name: string;
  photo_path: string;
  points: number;
  firsts: number;
  seconds: number;
  thirds: number;
};

let client: SupabaseClient | null = null;

export const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const NOT_CONFIGURED_MESSAGE =
  "Faltan las claves de Supabase: completá .env.local (local) o las Environment Variables de Vercel. Ver README.";

// Se crea recién cuando se usa (en el navegador), así el build no necesita las claves.
export function supabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error(NOT_CONFIGURED_MESSAGE);
    client = createClient(url, key);
  }
  return client;
}

export function photoUrl(path: string) {
  return supabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// La miniatura de cada foto se guarda en thumbs/ con el mismo nombre.
export function thumbPath(path: string) {
  return `thumbs/${path}`;
}

export function thumbUrl(path: string) {
  return photoUrl(thumbPath(path));
}

export async function fetchStatus(): Promise<Status> {
  const { data, error } = await supabase()
    .from("settings")
    .select("status")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data.status as Status;
}

export async function fetchCostumes(): Promise<Costume[]> {
  const { data, error } = await supabase()
    .from("costumes")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
