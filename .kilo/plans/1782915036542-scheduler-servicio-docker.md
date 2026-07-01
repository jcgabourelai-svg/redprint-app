# Plan: Scheduler persistente en Docker (visitas recurrentes) + migraciones + rebuild

## Contexto

El commit `d4e8dd2` introduce la generación automática de visitas recurrentes vía un
schedule en `routes/console.php`:

```php
Schedule::command('visits:generate-upcoming')->dailyAt('02:00')->withoutOverlapping();
```

Sin embargo, en el stack Docker **no existe ningún proceso** que ejecute el scheduler de
Laravel (el servicio `app` solo corre `php-fpm`; el `Dockerfile` no instala cron/supervisor).
Como resultado, las visitas recurrentes **jamás se generan automáticamente**.

Además, el commit trajo 2 migraciones nuevas y cambios de frontend que aún no están
aplicados/reflejados en la instancia Docker (contenedores levantan desde antes del commit).

### Estado verificado
- `docker compose ps`: `app`, `database`, `nginx` llevan ~4 días arriba (anteriores al commit).
- Laravel usa timezone **`UTC`** (no existe `config/app.php`; el cache confirma `'timezone' => 'UTC'`).
- `entrypoint.sh` solo corre `migrate` al arrancar el contenedor.
- `frontend/dist` ya existe → el servicio `frontend` omite el rebuild.

## Decisiones de diseño (acordadas)

1. **C1 — Servicio `scheduler` dedicado** en docker-compose ejecutando
   `php artisan schedule:work` (demonio en primer plano que lanza tareas cada minuto).
   Respeta el patrón "un proceso por contenedor"; no toca el `Dockerfile`.
2. **Timezone `America/Cancun`** (-05:00 permanente) para el cron diario.
3. **Timezone aplicado SOLO al schedule** (`->timezone('America/Cancun')` en
   `routes/console.php`). La app **sigue en UTC**. Evita el desfase de 5h en timestamps
   ya almacenados que provocaría cambiar `APP_TIMEZONE` globalmente.
4. **Scheduler sin migrate**: `RUN_MIGRATIONS=0` + `depends_on: app { service_healthy }`.
   Las migraciones siguen siendo responsabilidad única del servicio `app`.

## Cambios de código (a ejecutar por un agente de implementación)

### 1. `docker-compose.yml`

- Al servicio `app` añadirle un tag de imagen explícito para que el scheduler lo reutilice:
  ```yaml
  app:
    image: redprint-app:${TAG:-latest}   # NUEVO: compartido con el servicio scheduler
    build:
      context: ./backend
      dockerfile: Dockerfile
    # ... resto sin cambios
  ```

- Añadir un nuevo servicio `scheduler` (después de `app`, antes de `database` o junto al
  de `app` para legibilidad). Reutiliza la MISMA imagen (no hace `build:` propio):
  ```yaml
  scheduler:
    image: redprint-app:${TAG:-latest}
    container_name: redprint-scheduler
    restart: unless-stopped
    working_dir: /var/www/html
    command: ["php", "artisan", "schedule:work"]
    volumes:
      - ./backend:/var/www/html
      - app_storage:/var/www/html/storage
    environment:
      # Mismas vars que app, PERO sin migrar (app ya lo hace y esta sano al arrancar).
      - APP_ENV=${APP_ENV:-local}
      - RUN_MIGRATIONS=0
      - APP_PORT=${APP_PORT:-8080}
      - APP_DOMAIN=${APP_DOMAIN:-localhost}
      - DB_HOST=database
      - DB_PORT=5432
      - DB_DATABASE=${DB_DATABASE:-redprint}
      - DB_USERNAME=${DB_USERNAME:-redprint}
      - DB_PASSWORD=${DB_PASSWORD:-secret}
    depends_on:
      app:
        condition: service_healthy
    networks:
      - redprint
  ```

  Notas:
  - Comparte `app_storage` con `app` para que logs/locks de `schedule:work` y colas vivan
    en el mismo volumen.
  - `depends_on: app { service_healthy }` garantiza que migraciones/composer terminaron
    antes de arrancar el scheduler (evita contención y arranque sobre app no lista).
  - El `entrypoint.sh` se ejecuta igualmente (composer install / key:generate idempotentes,
    que en un clone ya hecho se saltan), y como `command` no es `php-fpm`, al final hace
    `exec "$@"` → lanza `schedule:work`.

### 2. `backend/routes/console.php`

Añadir el timezone al schedule existente:
```php
<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('visits:generate-upcoming')
    ->dailyAt('02:00')
    ->timezone('America/Cancun')   // NUEVO: 02:00 hora local (-05:00 permanente)
    ->withoutOverlapping();
```

> La app sigue en UTC globalmente; esto afecta ÚNICAMENTE cuándo se dispara el cron.

## Comandos de ejecución (PowerShell, host Windows)

```powershell
# A) Aplicar migraciones pendientes del commit (dia_visita + índices de visits)
docker compose exec app php artisan migrate --force

# B) Rebuild del frontend (cambios del commit no compilados todavía)
docker compose run --rm --no-deps frontend sh -c "npm run build"
#    -> Si al recargar / da 500 pero /api responde 200: docker compose restart nginx

# C) Levantar el nuevo servicio scheduler (construye la imagen taggeada y arranca scheduler)
docker compose up -d --build
```

Tras el `up`, el navegador debe recargarse en http://localhost:8080 con **Ctrl+F5**.

## Plan de validación

1. **Schedule registrado y con timezone correcto**:
   ```powershell
   docker compose exec app php artisan schedule:list
   #   Debe listar visits:generate-upcoming a 02:00 con timezone America/Cancun
   ```

2. **Scheduler corriendo**:
   ```powershell
   docker compose ps scheduler                 # estado Up
   docker compose logs --tail=20 scheduler     # salida de schedule:work (running)
   ```

3. **Generación manual funciona (smoke test)**:
   ```powershell
   docker compose exec app php artisan visits:generate-upcoming
   #   Debe reportar "Visitas creadas: N" (o 0 si ya existe dentro de la ventana rolling)
   ```

4. **Idempotencia**: ejecutar el comando 2 veces → la segunda debe crear 0 visitas nuevas
   para los contratos que ya tienen visita pendiente en la ventana rolling de 1 mes.

5. **Frontend**: en el Calendario, confirmar que socios y clientes se cargan desde la API
   (no hardcodeados) y que el estado "Omitida" aparece en filtros.

## Riesgos y notas

- **`schedule:work` es para dev**. Es un proceso residente continuo; Laravel recomienda
  para **producción** un cron del sistema (`* * * * * cd /var/www/html && php artisan
  schedule:run >> /dev/null 2>&1`). Queda fuera de alcance ahora; documentar para futuro
  paso a producción.
- **Primera vez**: al hacer `up -d --build`, el servicio `scheduler` pasará por el
  `entrypoint.sh`. Como `vendor/` y `APP_KEY` ya existen (clone ya levantado), los pasos
  de composer/key se saltan rápidamente y arranca `schedule:work`.
- **No se cambia `APP_TIMEZONE`**: por diseño, para no alterar el manejo de fechas de toda
  la app ni los timestamps ya almacenados en UTC.
- **Windows + bind mount de `dist`**: si el rebuild del frontend provoca el ciclo de
  redirección 500 en nginx, `docker compose restart nginx` lo resuelve (documentado en AGENTS.md).

## Fuera de alcance

- Migrar a cron real del sistema (decisión de producción futura).
- Hacer configurable el timezone vía `config('app.schedule_timezone')` (requeriría crear
  `config/app.php`, innecesario ahora; se deja el string literal `America/Cancun`).
- Cambios de seeders o datos existentes (los seeders del commit solo corren con DB vacía).
