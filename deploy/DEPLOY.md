# Guía de despliegue y actualización en producción

Esta guía permite desplegar y mantener RedPrint en el VPS de producción
**desde cualquier máquina** con una clonación fresca del repositorio.
No contiene credenciales: todos los secretos viven únicamente en el VPS.

---

## 1. Arquitectura de producción

```
Internet ──► Traefik (Dokploy)          :80/:443, TLS Let's Encrypt
                 │  red dokploy-network (labels en deploy/docker-compose.prod.yml)
                 ▼
            redprint-nginx              :80 interno (bind 127.0.0.1:${APP_PORT})
                 │
     ┌───────────┼────────────────┐
     ▼           ▼                ▼
  SPA (/)     Móvil (/m/)    /api, /sanctum ──► php-fpm (app) ──► PostgreSQL
                                                              ▲
                                                         scheduler
```

- **Punto de entrada público**: el Traefik existente en el VPS (gestionado por
  Dokploy) termina TLS y enruta por `Host` al nginx del stack. No se publica
  ningún puerto adicional.
- **Puertos locales del stack**: `nginx` y `database` se bindean solo a
  `127.0.0.1` (ver `docker-compose.yml`). Nunca cambiarlos a `0.0.0.0`.
- **Ubicación en el VPS**: `/opt/redprint`.
- **Secretos**: SOLO en `/opt/redprint/.env` (permisos `600`). Ese archivo
  **nunca** viaja en el repositorio ni en los empaquetados (está en
  `.gitignore` y `git archive` no lo incluye).
- **Dominio**: `erp.redprint.cloud` (registro A → VPS). Está fijado en dos
  lugares: `.env` del VPS (`APP_DOMAIN`/`PUBLIC_URL`) y los labels Traefik de
  `deploy/docker-compose.prod.yml`.

## 2. Prerequisitos (una vez por máquina desde la que se despliega)

- `git`, cliente `ssh`/`scp` (en Windows 10+ ya vienen instalados) y acceso de
  lectura al repositorio.
- Una clave SSH autorizada en el VPS.

### 2.1 Generar e instalar la clave SSH

```powershell
# Windows PowerShell (en Linux/macOS es idéntico sin "type ... |")
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519" -C "redprint-deploy"
```

Instalar la clave en el VPS (pide la contraseña del VPS una sola vez):

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@erp.redprint.cloud "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

> **Gotcha (Windows + PowerShell)**: el pipe de PowerShell puede añadir un
> final de línea CRLF que invalida la línea en `authorized_keys` (sshd rechaza
> la clave silenciosamente). Si tras instalarla `ssh` sigue pidiendo
> contraseña, limpia el archivo:
>
> ```powershell
> ssh root@erp.redprint.cloud "sed -i 's/\r$//' ~/.ssh/authorized_keys"
> ```

Verificar que ya NO pide contraseña:

```bash
ssh root@erp.redprint.cloud "echo OK"
```

## 3. Despliegue inicial (una sola vez)

### 3.1 Clonar y empaquetar

`git archive` exporta **solo los archivos trackeados**: excluye solos el
`.git`, `.env`, `vendor/`, `node_modules/` y los `dist/` (todo está en
`.gitignore`). Es el mecanismo más limpio y reproducible.

```bash
git clone https://github.com/jcgabourelai-svg/redprint-app.git
cd redprint-app
git archive --format=tar.gz -o redprint.tar.gz HEAD
```

> `git archive HEAD` empaqueta el último **commit**: commitea antes todo lo
> que quieras desplegar. El archivo queda en el directorio actual (evita
> rutas `/tmp/...` para que el comando funcione igual en Windows).

### 3.2 Subir y extraer en el VPS

```bash
scp redprint.tar.gz root@erp.redprint.cloud:/tmp/
ssh root@erp.redprint.cloud "mkdir -p /opt/redprint && tar -xzf /tmp/redprint.tar.gz -C /opt/redprint && rm /tmp/redprint.tar.gz"
```

### 3.3 Crear el `.env` de producción (solo la primera vez)

La contraseña de la base de datos se genera **dentro del VPS** para que nunca
transite por la máquina que despliega ni por el repo:

```bash
ssh root@erp.redprint.cloud
cd /opt/redprint
DBPASS=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 36)
cat > .env <<EOF
APP_PORT=8090
APP_DOMAIN=erp.redprint.cloud
APP_ENV=production
PUBLIC_URL=https://erp.redprint.cloud
DB_DATABASE=redprint
DB_USERNAME=redprint
DB_PASSWORD=$DBPASS
DB_PORT=5432
RUN_MIGRATIONS=1
EOF
chmod 600 .env
```

Notas:
- `APP_PORT` es el puerto **local** de nginx (elegir uno libre del VPS; debe
  coincidir con el bind de `docker-compose.yml`).
- `PUBLIC_URL` hace que Laravel genere URLs y CORS con el dominio real HTTPS
  (el entrypoint lo escribe en `APP_URL`/`FRONTEND_URL`).
- `RUN_MIGRATIONS=1` deja que el entrypoint migre (y siembre si la base está
  vacía) en cada arranque. Es cómodo al inicio; en madurez se puede poner `0`
  y migrar manualmente (ver §5.3).

### 3.4 Levantar el stack

Desde el VPS (o con `ssh root@erp.redprint.cloud "cd /opt/redprint && ..."`):

```bash
cd /opt/redprint
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

El primer arranque: compila la imagen PHP, instala Composer, genera `APP_KEY`,
migra y siembra (usuarios de prueba: ver `AGENTS.md`), compila front y móvil,
y el Traefik del host solicita el certificado Let's Encrypt automáticamente
(tarda unos segundos tras el primer request).

### 3.5 Verificación

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
curl -I https://erp.redprint.cloud/                                  # 200
curl -o /dev/null -w "%{http_code}\n" http://erp.redprint.cloud/      # 302 -> https
curl -o /dev/null -w "%{http_code}\n" -X POST https://erp.redprint.cloud/sanctum/csrf-cookie  # 204
```

Luego iniciar sesión en el navegador con el usuario sembrado (credenciales en
`AGENTS.md`) y comprobar que la sesión persiste al recargar.

## 4. Actualizar producción (flujo normal)

Repetible desde cualquier máquina con el repo. **El `.env` del VPS y los
volúmenes de datos se conservan solos** (nunca vienen en el empaquetado).

```bash
# 1. Obtener el código a desplegar (commit previo hecho)
cd redprint-app && git pull          # o clonar de cero
git archive --format=tar.gz -o redprint.tar.gz HEAD

# 2. Subir y extraer ENCIMA de /opt/redprint
scp redprint.tar.gz root@erp.redprint.cloud:/tmp/
ssh root@erp.redprint.cloud "tar -xzf /tmp/redprint.tar.gz -C /opt/redprint && rm /tmp/redprint.tar.gz"

# 3. Reconstruir front/móvil (ver nota) y aplicar cambios
ssh root@erp.redprint.cloud "cd /opt/redprint \
  && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml rm -sf frontend mobile \
  && find frontend/dist mobile/dist -mindepth 1 -delete 2>/dev/null; \
  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build \
  && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml restart nginx"
```

**Por qué el paso 3 es así**:

- Los builders de `frontend`/`mobile` son one-shot y **se saltan el build si
  `dist/index.html` existe**. Por eso hay que borrar sus contenedores previos
  (`rm -sf`) y vaciar el contenido de `dist` para que recompilen.
- Se vacía el **contenido** de `dist` sin borrar las carpetas: nginx las tiene
  montadas por bind mount y borrar la carpeta entera dejaría el contenedor
  apuntando a un inodo muerto (error 500 en la SPA; si ocurre:
  `docker compose ... restart nginx`).
- `--build` reconstruye la imagen PHP (Dockerfile/entrypoint/composer
  lockfiles). El código PHP de `backend/` va por volumen: los cambios de código
  PHP aplican con el reinicio del contenedor `app` sin rebuild.

### 4.1 Casos particulares tras una actualización

| Cambió... | Acción extra |
|---|---|
| `backend/composer.json` | `docker compose ... exec app composer install --no-dev` y `restart app` |
| Rutas o config de Laravel | `docker compose ... exec app php artisan config:cache && ... route:cache && ... view:cache` |
| Nuevas migraciones | Con `RUN_MIGRATIONS=1` se aplican al reiniciar `app`; si no: ver §5.3 |
| Solo archivos del backend (PHP) | Basta `tar` + `restart app scheduler` (sin rebuild) |
| `docker-compose.yml` o `deploy/` | `up -d --build` recrea los servicios afectados |

### 4.2 Nota sobre archivos eliminados

`tar` extrae encima: los archivos **borrados** del repo quedan como residuo en
el VPS. Para un "deep clean" (poco frecuente):

```bash
ssh root@erp.redprint.cloud "cd /opt/redprint && \
  cp .env /tmp/redprint.env.bak && \
  find . -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {} + && \
  tar -xzf /tmp/redprint.tar.gz -C /opt/redprint && \
  mv /tmp/redprint.env.bak .env"
```

(No borra `dist/` ni `vendor/` porque se regeneran solos; los volúmenes de
Postgres/storage son nombrados de Docker y no se tocan.)

## 5. Operación en el VPS

En los ejemplos, `COMPOSE="docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml"`
ejecutado desde `/opt/redprint`.

### 5.1 Estado y logs

```bash
$COMPOSE ps
$COMPOSE logs -f app            # backend Laravel (entrypoint + php-fpm)
$COMPOSE logs -f nginx          # tráfico entrante
$COMPOSE logs -f scheduler
docker stats --no-stream
```

### 5.2 Artisan / Composer

```bash
$COMPOSE exec app php artisan migrate --force
$COMPOSE exec app php artisan tinker
$COMPOSE exec app composer install --no-dev
$COMPOSE exec app php artisan config:cache
```

### 5.3 Migraciones manuales (modo estricto)

Si se pasa `RUN_MIGRATIONS=0` en `.env` del VPS:

```bash
$COMPOSE exec app php artisan migrate --force
```

### 5.4 Backup y restore de la base de datos

```bash
# Backup (dump comprimido con fecha)
$COMPOSE exec -T database pg_dump -U redprint -d redprint | gzip > /root/backups/redprint-$(date +%F).sql.gz

# Restore en una base limpia
gunzip -c /root/backups/redprint-YYYY-MM-DD.sql.gz | $COMPOSE exec -T database psql -U redprint -d redprint
```

Crear `/root/backups` la primera vez (`mkdir -p /root/backups`) y considerar
un cron para automatizarlo.

## 6. Cambiar el dominio

1. Apuntar el DNS (registro A) del nuevo dominio al VPS.
2. Labels de `deploy/docker-compose.prod.yml`: reemplazar
   `erp.redprint.cloud` en las reglas `Host(...)` de los dos routers.
3. `.env` del VPS: `APP_DOMAIN` y `PUBLIC_URL`.
4. Commitear el compose, re-desplegar (§4) y verificar.
   El certificado del nuevo dominio se emite solo en el primer request.

## 7. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Permission denied (publickey)` al hacer ssh | Clave con CRLF o permisos de `~/.ssh` | `sed -i 's/\r$//' ~/.ssh/authorized_keys`; `chmod 700 ~/.ssh /root; chmod 600 ~/.ssh/authorized_keys; chown root:root /root /root/.ssh` |
| El navegador no ve cambios del frontend/móvil | Los builders se saltaron el build (dist existía) | Repetir el paso 3 de §4 (rm builders + vaciar dist + up + restart nginx) |
| La SPA da 500 pero `/api` responde | Bind mount de `dist` apuntando a un inodo borrado | `$COMPOSE restart nginx` |
| Login correcto pero la sesión no persiste (401 en `/auth/user`) | `SESSION_DOMAIN` con valor heredado (p. ej. `localhost`) | Dejarlo vacío: `$COMPOSE exec app sh -c "sed -i 's/^SESSION_DOMAIN=.*/SESSION_DOMAIN=/' .env"` y `restart app` |
| `address already in use` al levantar nginx | `APP_PORT` ocupado por otro servicio del VPS | Cambiar `APP_PORT` en `.env` a un puerto libre |
| El certificado no se emite | DNS sin propagar o router Traefik ausente | `dig +short erp.redprint.cloud`; verificar labels con `docker inspect redprint-nginx` |

## 8. Checklist de seguridad de la instalación

- [ ] `/opt/redprint/.env` con permisos `600` y contraseña de BD generada en el VPS.
- [ ] `docker-compose.yml` bindea `database` y `nginx` solo a `127.0.0.1`.
- [ ] Único punto de entrada público: Traefik en 80/443.
- [ ] SSH del VPS por clave (contraseña deshabilitada preferiblemente).
- [ ] Backups de la base de datos programados (§5.4).
- [ ] Cambiar las contraseñas de los usuarios sembrados tras el primer login.
