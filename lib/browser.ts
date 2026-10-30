const TOKEN_KEY = "halloween-voter-token";

// crypto.randomUUID solo existe en https/localhost; esto cubre el resto.
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ID del dispositivo del invitado: es lo que impide votar dos veces.
export function getVoterToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = randomId();
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return randomId();
  }
}

// Una foto vertical de celular (4:3) queda en 1080x1440.
type Size = { short: number; long: number; quality: number };
// Foto grande (solo se baja al ampliarla): una vertical 4:3 queda en 1080x1440.
const FULL: Size = { short: 1080, long: 1440, quality: 0.78 };
// Miniatura para la galería (~40-60 KB): sobra para una tarjeta en el celular.
const THUMB: Size = { short: 480, long: 640, quality: 0.72 };
// Los mismos formatos y tamaño que acepta el bucket "fotos" (ver supabase/schema.sql).
const UPLOADABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

const DECODE_TIMEOUT_MS = 30000;

// Ninguna foto puede dejar el panel trabado en "Subiendo…".
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// <img> es lo más compatible: respeta la rotación de la foto y Safari decodifica
// las fotos grandes (48 MP) de forma optimizada. Se usa onload y no img.decode(),
// que en algunos casos nunca termina.
async function decodeWithImg(file: File): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo leer la foto"));
  });
  img.src = url;
  try {
    await withTimeout(loaded, DECODE_TIMEOUT_MS);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

async function decodeWithBitmap(file: File): Promise<Decoded> {
  const bitmap = await withTimeout(
    createImageBitmap(file, { imageOrientation: "from-image" }),
    DECODE_TIMEOUT_MS,
  );
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
  };
}

function toJpeg(decoded: Decoded, scale: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(decoded.width * scale));
  canvas.height = Math.max(1, Math.round(decoded.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => {
        // Libera la memoria del lienzo enseguida (importa en iPhone).
        canvas.width = canvas.height = 0;
        resolve(blob);
      },
      "image/jpeg",
      quality,
    ),
  );
}

async function resize(decoded: Decoded, size: Size): Promise<Blob | null> {
  const short = Math.min(decoded.width, decoded.height);
  const long = Math.max(decoded.width, decoded.height);
  const scale = Math.min(1, size.short / short, size.long / long);
  // Si el celular se queda sin memoria para el lienzo, reintenta más chico.
  for (const factor of [1, 0.75, 0.5]) {
    const blob = await toJpeg(decoded, scale * factor, size.quality);
    if (blob && blob.size > 0) return blob;
  }
  return null;
}

export type CompressedPhoto = { full: Blob; thumb: Blob };

// Achica la foto antes de subirla para que suba rápido con el wifi de la fiesta y no
// gaste el tráfico gratis: una versión grande (~150-300 KB) y una miniatura, las dos
// desde una sola lectura de la foto. Si un método falla, prueba el siguiente.
export async function compressImage(file: File): Promise<CompressedPhoto> {
  for (const decode of [decodeWithImg, decodeWithBitmap]) {
    let decoded: Decoded | null = null;
    try {
      decoded = await decode(file);
      if (!decoded.width || !decoded.height) continue;
      const full = await resize(decoded, FULL);
      const thumb = full && (await resize(decoded, THUMB));
      if (full && thumb) return { full, thumb };
    } catch {
      // Probar con el siguiente método.
    } finally {
      decoded?.release();
    }
  }
  // Último recurso: subir el original tal cual, si el formato y el tamaño lo permiten.
  if (UPLOADABLE_TYPES.includes(file.type) && file.size <= MAX_UPLOAD_BYTES) {
    return { full: file, thumb: file };
  }
  throw new Error("No se pudo procesar la foto. Probá sacarla de nuevo o elegir otra (JPG o PNG).");
}

export function extensionFor(blob: Blob): string {
  if (blob.type === "image/png") return "png";
  if (blob.type === "image/webp") return "webp";
  return "jpg";
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return String(e);
}
