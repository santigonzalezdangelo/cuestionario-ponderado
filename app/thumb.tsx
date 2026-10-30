"use client";

import { useState } from "react";
import { photoUrl, thumbUrl } from "@/lib/supabase";

// Muestra la miniatura de un disfraz. Si no existe (fotos cargadas antes de que
// hubiera miniaturas), usa la foto grande.
export default function Thumb({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState(() => thumbUrl(path));
  const full = photoUrl(path);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => src !== full && setSrc(full)}
    />
  );
}
