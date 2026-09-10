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
curl -o /dev/null -w "%{http_code}\n" https://erp.redprint.cloud/sanctum/csrf-cookie  # 204 (GET: la ruta es GET-only en Sanctum)
```

Luego iniciar sesión en el navegador con el usuario sembrado (credenciales en
`AGENTS.md`) y comprobar que la sesión persiste al recargar.

## 4. Actualizar producción (flujo normal)

Hay dos flujos: el **orquestador git** (recomendado, §4.1) y el **tarball
manual** (§4.4, legacy). En ambos, el `.env` del VPS y los volúmenes de datos
se conservan solos.

### 4.1 Actualizar con el orquestador `deploy/update.sh` (recomendado)

Requiere el VPS migrado a git (§4.2). El orquestador es idempotente y hace
todo en este orden: backup `pg_dump` (retención ~10) → `git pull --ff-only`
(aborta si el árbol está sucio) → rebuild forzado de front y móvil →
`composer install --no-dev` → `migrate --force` → caches → `up -d --build` →
restart de app/scheduler/nginx → health check. Si no hay commits nuevos y el
último estado fue `listo`, no toca nada (usar `FORCE=1` para forzar).

```bash
ssh root@erp.redprint.cloud "cd /opt/redprint && bash deploy/update.sh"
ssh root@erp.redprint.cloud "cd /opt/redprint && FORCE=1 bash deploy/update.sh"  # forzado
```

Estado y log del orquestador (viven en el volumen `app_storage`, dentro del
contenedor; el script del host los replica ahí vía `exec -T`):

```bash
COMPOSE="docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml"
$COMPOSE exec -T app sh -c 'cat storage/app/update/status.json'   # estado actual
tail -f /var/log/redprint/update.log                              # log en el host
```

Reglas de oro que el script asume (y hace valer):

- **Jamás editar código a mano en el VPS**: el pre-flight aborta con
  `estado:"error"` si `git status --porcelain` no está vacío.
- **Nunca `migrate:fresh` / `migrate:refresh` / `db:wipe`** en el VPS: esos
  comandos borran datos y solo existen en la máquina de desarrollo.
- Migraciones aditivas primero (expand-contract): columnas nuevas `nullable`
  o con default; dropear/renombrar recién en el release siguiente.

### 4.2 Migración de tarball a git (una sola vez; prerrequisito del orquestador)

Los volúmenes nombrados (`pg_data`, `app_storage`) pertenecen al *proyecto*
de compose, cuyo nombre deriva del directorio (`/opt/redprint` →
`redprint`). **Si el clone aterriza en otro directorio, compose crea
volúmenes vacíos nuevos y parece que "se perdieron los datos"**. Por eso:
mismo path + `COMPOSE_PROJECT_NAME` explícito.

```bash
ssh root@erp.redprint.cloud

# 1. Parar el stack (los volúmenes sobreviven al "down")
cd /opt/redprint && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml down

# 2. Resguardar el .env y anotar los volúmenes existentes
cp .env /root/redprint.env.bak
docker volume ls | grep redprint      # anotar redprint_pg_data y redprint_app_storage

# 3. Clonar en el MISMO path (repo público por https; privado: deploy key
#    read-only en GitHub y clonar con git@github.com:...)
mv /opt/redprint /opt/redprint.old-tarball
git clone https://github.com/jcgabourelai-svg/redprint-app.git /opt/redprint

# 4. Restaurar el .env y fijar el nombre de proyecto (cinturón y tirantes)
cp /root/redprint.env.bak /opt/redprint/.env
chmod 600 /opt/redprint/.env
grep -q '^COMPOSE_PROJECT_NAME=' /opt/redprint/.env || echo 'COMPOSE_PROJECT_NAME=redprint' >> /opt/redprint/.env

# 5. Levantar y verificar que los volúmenes son LOS MISMOS (mismos nombres)
cd /opt/redprint && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
docker volume ls | grep redprint      # deben seguir siendo redprint_pg_data / redprint_app_storage

# 6. Verificar datos intactos (login en la web + conteo rápido):
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  exec -T database psql -U redprint -d redprint -c 'select count(*) from users;'

# 7. Solo cuando todo esté verificado:
rm -rf /opt/redprint.old-tarball
```

### 4.3 Cron del host (bandera de actualización + backup diario)

`crontab -e` como root en el VPS:

```cron
# Detector de la bandera storage/app/update/request (botón Fase 2 o manual)
* * * * * /bin/bash /opt/redprint/deploy/update-cron.sh >> /var/log/redprint/cron.log 2>&1
# Backup diario de la base con retención (log de éxitos Y fallos: /var/log/redprint/backup.log)
0 3 * * * /bin/bash /opt/redprint/deploy/backup-cron.sh >> /var/log/redprint/backup.log 2>&1
```

Probar el flujo de bandera a mano (Fase 1, sin botón todavía):

```bash
cd /opt/redprint
COMPOSE="docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml"
$COMPOSE exec -T app sh -c 'echo manual > storage/app/update/request'
# esperar <60 s al cron (o ejecutar "bash deploy/update-cron.sh" directamente)
tail -f /var/log/redprint/update.log
$COMPOSE exec -T app sh -c 'cat storage/app/update/status.json'
```

### 4.4 Fallback manual con tarball (sin git ni orquestador)

```bash
# 0. Backup previo OBLIGATORIO (política: pg_dump antes de cada actualización;
#    este flujo legacy no lo hace solo, a diferencia del orquestador §4.1)
ssh root@erp.redprint.cloud "cd /opt/redprint && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  exec -T database pg_dump -U redprint -d redprint | gzip > /root/backups/redprint-\$(date +%F)-manual.sql.gz"

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

### 4.5 Casos particulares tras una actualización

El orquestador (§4.1) ya ejecuta automáticamente composer/caches/migraciones;
esta tabla aplica al fallback tarball (§4.4) y a verificaciones manuales.

| Cambió... | Acción extra |
|---|---|
| `backend/composer.json` | `docker compose ... exec app composer install --no-dev` y `restart app` |
| Rutas o config de Laravel | `docker compose ... exec app php artisan config:cache && ... route:cache && ... view:cache` |
| Nuevas migraciones | Con `RUN_MIGRATIONS=1` se aplican al reiniciar `app`; si no: ver §5.3 |
| Solo archivos del backend (PHP) | Basta `tar` + `restart app scheduler` (sin rebuild) |
| `docker-compose.yml` o `deploy/` | `up -d --build` recrea los servicios afectados |

### 4.6 Nota sobre archivos eliminados

Con git (§4.1–§4.2) esto desaparece: `git pull` borra y actualiza los
archivos trackeados. La nota aplica solo al flujo tarball: `tar` extrae
encima, así que los archivos **borrados** del repo quedan como residuo en
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

El backup diario está automatizado por `deploy/backup-cron.sh` (§4.3), y
`update.sh` hace su propio backup antes de cada actualización. Manualmente:

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
| `update.sh` aborta con "árbol de git sucio" | Cambios locales en el VPS (prohibidos) o `\r` en scripts | `cd /opt/redprint && git status` para ver qué hay; si es CRLF: `sed -i 's/\r$//' deploy/*.sh`; el guard permanente es `.gitattributes` (`*.sh text eol=lf`) |
| La bandera nunca se atiende | Falta la entrada de cron o falló en silencio | `crontab -l`; `/var/log/redprint/cron.log`; probar `bash deploy/update-cron.sh` a mano |
| `update.sh` se queda en "corriendo" para siempre | Script muerto a mitad (reboot del VPS, OOM) | Borrar `/tmp/redprint-update.lock` si quedó tomado y re-ejecutar; el short-circuit/`FORCE=1` re-ejecutan seguro |

## 8. Checklist de seguridad de la instalación

- [ ] `/opt/redprint/.env` con permisos `600` y contraseña de BD generada en el VPS.
- [ ] `docker-compose.yml` bindea `database` y `nginx` solo a `127.0.0.1`.
- [ ] Único punto de entrada público: Traefik en 80/443.
- [ ] SSH del VPS por clave (contraseña deshabilitada preferiblemente).
- [ ] VPS migrado a git con `COMPOSE_PROJECT_NAME=redprint` (§4.2).
- [ ] Cron del host instalado: `update-cron.sh` cada 1 min y `backup-cron.sh` diario (§4.3).
- [ ] Un update de prueba ejecutado con `bash deploy/update.sh` y health check en verde.
- [ ] Restore de un backup probado al menos una vez (§5.4).
- [ ] Backups de la base de datos programados (§5.4).
- [ ] Cambiar las contraseñas de los usuarios sembrados tras el primer login.
