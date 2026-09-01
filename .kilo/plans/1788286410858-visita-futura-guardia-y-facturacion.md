# Plan: Guardia de visitas futuras + advertencia multi-mes + primera visita a +1 periodo

## Contexto

Tres mejoras acordadas con el usuario, en este orden de prioridad:

1. **Guardia (bloqueo duro)**: no poder capturar lecturas ni completar una visita programada a más de **5 días en el futuro**, ni sobre visitas en estado cerrado. Con aviso suave (banner) cuando la visita está 1–5 días adelantada.
2. **Advertencia de dinero**: al calcular una facturación cuyo rango cubre más de ~1.5 meses, advertir que `tarifa_base` y `paginas_incluidas` se aplican una sola vez por factura (subcobro de renta).
3. **Coherencia**: la primera visita LECTURA de un contrato nace a `fecha_inicio + 1 periodo` (hoy nace el mismo día 1 si el alta es en/antes del inicio).

No hay migraciones ni cambios de rutas/permisos. Todo es backend (servicios + tests) más dos banners de UI.

---

## Cambio 1 — Guardia de visita capturable (backend, núcleo)

### 1a. `backend/app/Services/VisitService.php`

Agregar constante y método público (única fuente de la regla, reutilizable):

```php
public const MAX_DIAS_ADELANTO = 5;

public function assertCapturable(Visit $visit): void
{
    if (! in_array($visit->estado, [VisitStatus::PENDIENTE, VisitStatus::REPROGRAMADA], true)) {
        throw new BusinessRuleException(
            "La visita está {$visit->estado->value} y no admite captura de actividades."
        );
    }

    if ($visit->fecha_programada->startOfDay()->gt(today()->addDays(self::MAX_DIAS_ADELANTO))) {
        throw new BusinessRuleException(sprintf(
            'La visita está programada para el %s, a más de %d días en el futuro. Reprograma la visita o crea una nueva.',
            $visit->fecha_programada->format('d/m/Y'),
            self::MAX_DIAS_ADELANTO,
        ));
    }
}
```

(`fecha_programada` ya está casteada a `date` en `Visit::casts()`, línea 34.)

### 1b. `backend/app/Services/ReadingService.php`

- Inyectar `VisitService` por constructor (no hay dependencia circular: `VisitService` solo usa modelos).
- Al inicio de la transacción de `captureReading()` (línea ~22), cargar la visita y validar:

```php
$visit = Visit::findOrFail($data['visita_id']);
$this->visitService->assertCapturable($visit);
```

`captureReading()` es el único embudo: móvil offline (SyncManager), web (`POST /readings`), y regularización de field records (`FieldRecordService::link()` línea 112) pasan por ahí.

**Compatibilidad D15 verificada**: `FieldRecordService::link()` captura la lectura con la visita aún `PENDIENTE` (la completa recién en la línea 134–136) y con `fecha_programada = capturado_en` (siempre pasada). La guardia no rompe la regularización.

### 1c. `backend/app/Services/VisitService::complete()` (línea 41)

- Mantener el rechazo actual de `COMPLETADA`; agregar rechazo explícito de `CANCELADA` y `OMITIDA` (hoy solo bloquea `COMPLETADA`).
- Agregar la misma guardia de fecha futura (llamar a la parte de fecha o a `assertCapturable` antes de los checks existentes, cuidando que el mensaje de "ya está completada" se mantenga accionable).

Completar una visita futura también quema el slot del ciclo (el guard anticopia del scheduler cuenta estados `!= CANCELADA` sobre la fecha exacta), por eso el bloqueo cubre ambos flujos.

### Fuera de alcance (explícito)

- Entregas de insumos (`ArticleDelivery`) y órdenes de mantenimiento sobre visitas futuras: misma filosofía aplicable, pero el usuario pidió lecturas + completar. Dejar como follow-up.
- Validar `fecha` de la lectura (hoy acepta fechas futuras arbitrarias del cliente): follow-up.
- Tolerancia configurable: constante en servicio (estilo `ROLLING_MONTHS`), no config.

---

## Cambio 2 — Advertencia por periodo multi-mes en facturación (backend)

`backend/app/Services/InvoiceCalculationService.php`, al inicio de `calcularEstimacion()` (tras validar contrato, línea ~40):

```php
$duracionMeses = Carbon::parse($periodoFin)->floatDiffInMonths(Carbon::parse($periodoInicio));
if ($duracionMeses > 1.5) {
    $advertencias[] = sprintf(
        'El periodo cubre aproximadamente %d meses: la tarifa base y las páginas incluidas se aplican una sola vez por factura. Considera facturar mes a mes.',
        (int) ceil($duracionMeses)
    );
}
```

- Importar `Carbon\Carbon` (hoy no está importado en ese archivo).
- **No bloqueante** (consistente con las advertencias de solapamiento, líneas 219–235). El wizard ya renderiza `advertencias`, sin cambios de frontend.
- Umbral 1.5 meses para evitar falsos positivos con meses de 31 días.

---

## Cambio 3 — Primera visita LECTURA a `fecha_inicio + 1 periodo` (backend, scheduler)

### Punto único de cambio: `VisitSchedulerService::computeNextVisitDate()` (líneas 186–234)

El problema vive solo en las ramas donde el ancla aún no pasó (`anchor >= hoy` devuelven el día 1). Ajustar las tres ramas para devolver **la primera ocurrencia de la cadencia estrictamente posterior a `fecha_inicio`**:

1. **MENSUAL/CUSTOM sin `dia_visita`** (línea 224): `if ($anchor->gte($reference))` → devolver `$anchor->copy()->addMonthNoOverflow()` en vez del ancla.
2. **SEMANAL/QUINCENAL** (línea 212): rama `$diff <= 0` → devolver `$anchor->copy()->addDays($stepDays)`.
3. **MENSUAL con `dia_visita`** (línea 191): si `$anchor->gte($reference)` (contrato no iniciado), proyectar `dia_visita` desde `$anchor->copy()->addDay()` (primera ocurrencia del día después del inicio, con clamp de mes corto). Si el contrato ya inició, dejar `nextMonthlyDate($diaVisita, $reference)` como está.

**Por qué no hace falta un método aparte en `ContractService`**: `ContractService::create` (línea 69) llama a `generateNextCycle`, que usa `computeNextVisitDate`. Con el ajuste, alta en/before del inicio → visita a +1 periodo; alta retroactiva (inicio pasado) → siguiente aniversario desde hoy (rama `anchor < reference`, intacta). Los guards de idempotencia (D8: `hasUpcoming` + anticopia por fecha exacta) no se tocan.

**Casos borde verificados** (el implementador debe cubrirlos con tests):
- Contratos existentes: su `fecha_inicio < hoy` siempre cae en la rama intacta → cero regresión.
- Inicio lejano (p. ej. dentro de 3 semanas): `inicio + 1 mes` puede caer fuera de la ventana rolling → `generateNextCycle` devuelve null y no se crea visita al alta; el cron la crea cuando la fecha entra en la ventana (el guard anticopia por fecha exacta evita duplicados).
- Reactivación de contrato no iniciado con `dia_visita`: rama nueva → primera ocurrencia del día tras el inicio.
- Visita de INSTALACIÓN opcional del wizard (`ContractService` líneas 74+): tipo distinto, no se toca.

---

## Cambio 4 — Aviso suave en UI (banner para visitas adelantadas 1–5 días)

### 4a. Móvil: `mobile/src/pages/CaptureReadingPage.tsx`

Si `visit.fecha_programada > todayISO()` (formato `Y-m-d`, comparación de strings serve), mostrar `Banner` (existe en `mobile/src/components/ui.tsx:178`) con tono advertencia: "Visita adelantada: está programada para el {fecha}. Si el cliente no corresponde a esta visita, reprograma o crea una nueva." No bloquea el envío (el servidor decide).

### 4b. Web: `frontend/src/pages/operations/readings/CaptureReadingPage.tsx`

Mismo aviso bajo el encabezado de la visita (línea ~171 muestra `visit.fecha_programada`). No existe componente Banner en `frontend/src/components/ui/` → usar un `div` estilizado con tokens ámbar/advertencia siguiendo patrones existentes de advertencia (p. ej. los del wizard de facturas o `ClosePeriodPage`).

### 4c. Botón "completar visita"

Sin cambio de UI: el 422 del servidor ya se muestra traducido (`parseApiError`/`apiErrorMessage`) con mensaje accionable.

---

## Cambio 5 — Documentación

`PROJECT.md`:
- §8: agregar fila **D18** — "Primera visita de lectura a +1 periodo del inicio; las visitas no admiten captura ni cierre a más de 5 días en el futuro" con racional (evita lectura cero del día 1, inconsistencia según fecha de alta, slot quemado) e implicaciones al evaluar.
- §6 (máquina de Visita): agregar la invariante de captura (estados abiertos + ventana de 5 días).
- Nota: el código ya referencia una "D17" (borradores mes calendario) que no está en la tabla del documento — si el implementer la cruza, mejor; no es requisito de este plan.

---

## Tests (backend, PHPUnit)

Archivos existentes a extender + uno nuevo:

1. **Nuevo `backend/tests/Feature/ReadingVisitGuardTest.php`**:
   - Lectura en visita `PENDIENTE` vencida → 201.
   - Lectura en visita `PENDIENTE` de hoy → 201.
   - Lectura en visita a +3 días → 201 (tolerancia).
   - Lectura en visita a +6 días → 422 con mensaje de reprogramar.
   - Lectura en visita `COMPLETADA` / `CANCELADA` / `OMITIDA` → 422.
2. **`backend/tests/Feature/VisitCompletionTest.php`**:
   - Completar visita a +6 días → 422.
   - Completar visita `CANCELADA` y `OMITIDA` → 422.
   - Completar visita vencida con actividad → sigue OK.
3. **`backend/tests/Feature/VisitSchedulingTest.php`** (ajustar aserciones existentes que asuman visita día-1 — el cambio de comportamiento es el objetivo):
   - Alta hoy con inicio hoy, MENSUAL sin `dia_visita` → primera visita a +1 mes exacto.
   - Alta con inicio futuro (+3 semanas) → sin visita al alta fuera de ventana; con `Carbon::setTestNow` avanzado, el cron la crea en `inicio + 1 mes`.
   - Alta retroactiva (inicio pasado) → siguiente aniversario desde hoy (comportamiento previo).
   - QUINCENAL con inicio hoy → +14 días; SEMANAL → +7 días.
   - `dia_visita` con inicio hoy → ocurrencia del día en el mes siguiente.
   - `generateRecurringVisits()` corrido dos veces → sin duplicados (idempotencia D8 intacta).
4. **`backend/tests/Feature/FieldRecordTest.php`** (regresión D15):
   - Regularización de registro LECTURA reutilizando visita PENDIENTE vencida sigue creando lectura + cerrando visita.
   - Regularización con visita CAMPO nueva (fecha pasada) sigue OK.
5. **`backend/tests/Feature/InvoiceCalculationTest.php`**:
   - Rango de 45+ días → advertencia de periodo multi-mes presente.
   - Rango de 1 mes calendario → advertencia ausente.

Convenciones: revisar cómo fabrican usuarios/contratos los tests existentes (seeders/ factories del proyecto) antes de escribir los nuevos.

---

## Orden de ejecución

1. Backend Cambio 1 (guardia) + tests 1–3 (guardia) + regresión 4.
2. Backend Cambio 3 (scheduler) + tests de scheduling.
3. Backend Cambio 2 (advertencia) + tests de cálculo.
4. UI Cambio 4 (banners móvil y web).
5. Docs Cambio 5.
6. Verificación completa + rebuild de dists.

## Verificación

```powershell
# Tests backend (primero dirigidos, luego suite completa)
docker compose exec app php artisan test --filter="ReadingVisitGuardTest|VisitCompletionTest|VisitSchedulingTest|FieldRecordTest|InvoiceCalculationTest"
docker compose exec app php artisan test

# Rebuild de fronts (banners tocan ambas SPAs)
docker compose run --rm --no-deps frontend sh -c "npm run build"
docker compose run --rm --no-deps mobile sh -c "npm run build"
```

Sin `config:cache` (no cambian rutas ni config). El usuario recarga `http://localhost:8080` con Ctrl+F5.

## Validación manual sugerida

- Crear contrato con inicio hoy → verificar en el calendario que la primera visita queda a +1 mes.
- Intentar (vía UI móvil o curl) capturar lectura en esa visita futura → 422 con mensaje de reprogramar.
- Reprogramar la visita a hoy → capturar → 201.
- Factura directa con rango 1-ago → 15-sep → ver advertencia de multi-mes en el wizard.

## Riesgos y mitigaciones

- **Test existente que AssertionQuote el día-1**: actualizar la aserción (es el comportamiento que se corrige), no el test nuevo.
- **Cola offline móvil**: una lectura encolada contra una visita que quedó cerrada mientras tanto recibirá 422 al sincronizar → cae al panel de errores del SyncManager con mensaje traducido. Comportamiento aceptable y ya soportado.
- **Contratos con inicio futuro lejano**: la primera visita aparece cuando entra en la ventana rolling (antes tampoco existía antes de `inicio`); el guard anticopia evita duplicados.
