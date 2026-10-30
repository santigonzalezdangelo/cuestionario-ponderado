# 🎃 Votación de disfraces de Halloween

**Publicada en:** <https://cuestionario-ponderado.vercel.app> · panel: <https://cuestionario-ponderado.vercel.app/admin>
(cada `git push` a `main` se publica solo en Vercel)

- **`/`** → página para los invitados (a esta apunta el QR). Eligen sus 3 favoritos en orden.
- **`/admin`** → panel del anfitrión: cargar disfraces con foto, abrir/cerrar la votación, QR, ver votos y el podio.

Puntaje: 1° = 3 pts, 2° = 2 pts, 3° = 1 pt. Desempate: más primeros puestos, después más segundos.
Un voto por celular (se guarda un ID en el navegador y la base de datos rechaza el segundo voto).

Tecnologías: Next.js (en Vercel) + Supabase (base de datos, login del anfitrión y fotos). No hay otro backend.

---

## 1. Supabase (base de datos)

1. Entrá a <https://supabase.com> → **Start your project** → registrate con GitHub.
2. **New project**: ponele un nombre, generá una contraseña de base de datos (guardala) y elegí la región
   **South America (São Paulo)**. Esperá ~2 minutos a que se cree.
3. Abrí [`supabase/schema.sql`](supabase/schema.sql), **cambiá `TU_EMAIL@ejemplo.com` (última línea) por tu email**,
   copiá todo el archivo y pegalo en **SQL Editor → New query → Run**. Tiene que decir *Success*.
4. **Authentication → Users → Add user → Create new user**: tu mismo email + una contraseña, y tildá
   **Auto Confirm User**. Con ese usuario vas a entrar a `/admin`.
5. **Authentication → Sign In / Providers**: desactivá **Allow new users to sign up** (así nadie más puede crearse una cuenta).
6. **Project Settings → Data API** (o el botón **Connect**): copiá la **Project URL**.
   **Project Settings → API Keys**: copiá la **Publishable key** (`sb_publishable_...`). Si tu proyecto
   solo muestra la "anon key", usá esa.

## 2. Probarlo en tu compu

1. Copiá `.env.example` como `.env.local` y pegá ahí la URL y la key.
2. En esta carpeta:

   ```bash
   npm run dev
   ```

3. Abrí <http://localhost:3000/admin>, entrá con tu usuario, cargá 3 disfraces de prueba, abrí la votación y votá
   desde <http://localhost:3000>.

## 3. Publicarlo (GitHub + Vercel)

1. Creá una cuenta en <https://github.com> y un repositorio **privado** vacío (ej. `halloween-votos`).
2. Subí el código (GitHub te muestra los comandos al crear el repo; `.env.local` no se sube).
3. Entrá a <https://vercel.com> → registrate con GitHub → **Add New… → Project** → importá el repo.
4. Antes de **Deploy**, en **Environment Variables** agregá las dos variables de `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
5. **Deploy**. Te da una URL tipo `https://halloween-votos.vercel.app`. El panel queda en `/admin`.

> Si cambiás las variables en Vercel después, hay que hacer **Redeploy** para que las tome.

## 4. Checklist para la fiesta

- **El día anterior**: entrá a Supabase (los proyectos gratis se pausan tras 7 días sin uso) y hacé una prueba
  completa con 2 o 3 celulares.
- Después de probar: en **Votación → Borrar todos los votos**, borrá los disfraces de prueba y dejá el estado en
  *Preparando* (si quedó *Cerrada* no pasa nada, al abrir se reabre).
- En la fiesta: cargá cada disfraz a medida que llegan (podés entrar y salir del panel las veces que quieras).
- Cuando estén todos: **Abrir votación** → **Pantalla completa** del QR para que lo escaneen.
- En **Votación** ves cuántos votaron y quiénes (⚠️ marca nombres repetidos por si alguien votó dos veces;
  podés borrar ese voto).
- **Cerrar votación** → **Resultados** → **Revelar 3° / 2° / 1° puesto**.

## Límites del plan gratis (de sobra para 100 invitados)

- Las fotos se comprimen en el celu antes de subirse (~100–200 KB), así 100 invitados viendo la galería
  usan bastante menos que los 5 GB de tráfico mensual gratis de Supabase.
- 100 votos al mismo tiempo no son problema: cada voto es una sola consulta y la base de datos garantiza que no
  se dupliquen.
