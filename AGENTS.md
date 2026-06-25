# AGENTS.md — Contexto obligatorio para el agente de IA

> **LEE ESTO PRIMERO.** Este archivo describe cómo se ejecuta y se itera en este
> proyecto. No asumas el entorno de desarrollo típico (npm run dev en el host).

## Entorno de desarrollo: TODO corre en Docker

RedPrint se desarrolla **íntegramente dentro de Docker**, incluso en local.
Esto NO es un proyecto donde el frontend se sirve con `npm run dev` en el host.

- **No existe** un `npm run dev` levantado en el puerto 3000 (o 5173) como parte
  del flujo de desarrollo habitual del usuario.
- La app se abre siempre en **`http://localhost:8080`** (el `APP_PORT` de Docker),
  servida por **Nginx** dentro del contenedor.
- No instales dependencias ni lances servidores en el host salvo que el usuario lo
  pida explícitamente.

## Por qué un cambio en el frontend NO se ve reflejado (importante)

El frontend es una SPA React/Vite que se compila a archivos estáticos
(`frontend/dist`). Nginx sirve ese `dist`. **No hay Hot Module Reload (HMR).**

El servicio `frontend` del `docker-compose.yml` compila la SPA **una sola vez** y
solo si `frontend/dist/index.html` **no existe**:

```yaml
command: sh -c "if [ ! -f dist/index.html ]; then npm install && npm run build; fi"
```

Por eso, tras editar código del frontend el build se omite y los cambios **no
aparecen** hasta que se recompila el `dist`.

## Cómo reflejar un cambio del frontend (flujo correcto)

El usuario quiere ver los cambios en **el puerto 8080 (Docker)**, no lanzando
`npm run dev`. Para ello hay que recompilar `frontend/dist` dentro de Docker:

```bash
# Opción A (recomendada): recompila el dist con el mismo Node de Docker
docker compose run --rm --no-deps frontend sh -c "npm run build"

# Opción B: borrar el dist y levantar de nuevo (el servicio frontend recompila)
Remove-Item -Recurse -Force frontend/dist
docker compose up -d
```

Tras recompilar, recargar el navegador en `http://localhost:8080` (con
`Ctrl+F5` / hard refresh por si el navegador cachea la SPA).

> **No sugieras `npm run dev` en el host ni abrir el puerto 3000/5173** salvo que
> el usuario lo pida. El flujo esperado es: editar -> recompilar dist en Docker ->
> recargar en 8080.

### Gotcha: error 500 / "redirection cycle" tras recompilar (Windows + Docker)

El `dist` se sirve en nginx por un **bind mount** (`./frontend/dist` ->
`/usr/share/nginx/html`). En Docker Desktop sobre Windows (y especialmente con
rutas dentro de **OneDrive**), si el build **borra y recrear la carpeta `dist`
entera**, el contenedor nginx queda apuntando a un inodo inexistente y aparece:

```
rewrite or internal redirection cycle while internally redirecting to "/index.html"  -> HTTP 500
```

La API sigue funcionando (se sirve desde otro volumen), solo falla la SPA.

**Prevención (ya aplicada):** el script `npm run build` de `frontend/package.json`
**vacia el contenido de `dist` sin borrar la carpeta**, manteniendo estable el
inodo del bind mount. **No lo cambies** por un `rm -rf dist` o volverá el 500.

**Si de todos modos aparece el 500** (p. ej. alguien borró `frontend/dist` a mano
mientras nginx corría), basta con reiniciar nginx para reestablecer el mount:

```bash
docker compose restart nginx
```

> Síntoma clave para distinguirlo de un error de backend: `/api/...` responde 200
> pero `/` devuelve 500. Si también falla la API, el problema está en Laravel, no
> en el mount del dist.

## Comandos habituales del proyecto

```bash
# Levantar / reiniciar el stack completo
docker compose up -d --build

# Estado de los contenedores
docker compose ps

# Logs
docker compose logs -f app          # backend Laravel
docker compose logs -f nginx        # frontend/API

# Backend (Laravel) dentro del contenedor
docker compose exec app php artisan migrate
docker compose exec app php artisan test
docker compose exec app php artisan config:cache

# Recompilar el frontend (ver sección anterior)
docker compose run --rm --no-deps frontend sh -c "npm run build"

# Frontend: lint / tests locales (si se piden explícitamente)
#   cd frontend
#   npm run lint
#   npm test
```

## Estructura de servicios (docker-compose.yml)

| Servicio    | Imagen            | Rol |
|-------------|-------------------|-----|
| `frontend`  | node:20-alpine    | Builder one-shot: compila `frontend/dist` si no existe |
| `app`       | (build backend)   | Laravel + PHP-FPM, entrypoint hace migrate/seed |
| `database`  | postgres:16-alpine| PostgreSQL |
| `nginx`     | nginx:alpine      | Sirve el SPA y enruta `/api` y `/sanctum` a PHP-FPM |

Puerto público: `${APP_PORT:-8080}` (mapeado a nginx en el 80).

## Rebuild proactivo del frontend (IMPORTANTE)

Cada vez que termines de forma satisfactoria un cambio que afecte el frontend
(archivos bajo `frontend/src/`, estilos, componentes, páginas, rutas, etc.),
**debes proponerse de forma proactiva para recompilar el `dist`** sin esperar a
que el usuario lo pida. No basta con editar el código: el cambio no será visible
en el navegador hasta que se recompile.

### Flujo automático que el agente debe seguir

1. Termina la edición del código del frontend.
2. **Propón** hacer el rebuild (en vez de limitarte a anunciar "listo").
   Ejemplo de redacción: *"Ya terminé el cambio en el front. ¿Quieres que
   recompile el `dist` en Docker para que lo veas en el 8080?"* o, si la
   intención del usuario era claramente ver el resultado, **haz el rebuild
   directamente** y avisa al usuario.
3. Ejecuta la recompilación dentro de Docker:

   ```bash
   docker compose run --rm --no-deps frontend sh -c "npm run build"
   ```

4. Indica al usuario que recargue el navegador en `http://localhost:8080` con
   `Ctrl+F5` (hard refresh).

### Cuándo proponerlo vs. ejecutarlo directamente

- **Propón** el rebuild cuando sea ambiguo si el usuario quiere ver el cambio
  ahora mismo (p. ej. cambios exploratorios, varias iteraciones pendientes).
- **Ejecútalo directamente** cuando el usuario pidió un cambio concreto y su
  objetivo evidente es ver el resultado en el navegador (p. ej. "arregla este
  bug de la UI", "agrega este botón").

> No sugerir **nunca** `npm run dev` en el host ni el puerto 3000/5173. El flujo
> esperado siempre es: editar → recompilar `dist` en Docker → recargar en 8080.

## Reglas para el agente

1. **Nunca presumas** `npm run dev` en el host ni el puerto 3000/5173 como
   entorno por defecto. El entorno es Docker en el **8080**.
2. Cuando el usuario diga "no veo mi cambio en el front", la causa es que
   `frontend/dist` no se recompiló. Propón recompilar en Docker (sección arriba).
3. **Tras terminar cualquier cambio de frontend, propón/ejecuta el rebuild del
   `dist` de forma proactiva** (ver sección "Rebuild proactivo" arriba). No
   esperes a que el usuario lo pida.
4. Para cambios de **backend** (Laravel), normalmente basta con editar el código
   (volumen montado) y, si cambia config/rutas, ejecutar
   `docker compose exec app php artisan config:cache`.
5. Las credenciales sembradas usan contraseña `password`
   (p. ej. `admin@redprint.com`).
6. El proyecto está en **Windows** (PowerShell). Usa sintaxis PowerShell para
   comandos del host cuando corresponda (p. ej. `Remove-Item` en vez de `rm -rf`).
