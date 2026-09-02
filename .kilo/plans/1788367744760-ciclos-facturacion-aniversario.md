# Plan: Facturación por ciclos de aniversario del contrato (20→20) en lugar de mes calendario

## Contexto

El negocio cobra por **ciclos derivados del aniversario de `fecha_inicio` del contrato** (ej. inicio 20-ago → ciclo 20-ago…19-sep), no por mes calendario. La implementación actual (D17) genera periodos de mes calendario recortados a la vigencia. Enmienda: el ancla del periodo pasa de "mes calendario de `fecha_inicio`" a "aniversario de `fecha_inicio`".

Por qué es barato: el motor de cálculo (`InvoiceCalculationService::calcularEstimacion(inicio, fin)`) y el bloqueo de duplicados D20 (`validarPeriodoNoDuplicado`) ya operan con **rangos de fechas arbitrarios**; el supuesto `Y-m` vive solo en la capa de periodos (listado de pendientes + batch de borradores + UI). **No hay migración de BD ni de datos** (no existen facturas emitidas reales; los seeds se regeneran).

## Decisiones cerradas (con el usuario)

1. **Lectura del día de inicio de ciclo** (ej. 20-sep): pertenece al **ciclo que abre** (atribución por fecha dentro del rango, igual que el motor actual). Sin lógica especial de cierre.
2. **Inicios día 29/30/31**: **clamp a fin de mes** (`addMonthsNoOverflow`: 31-ene → 28/29-feb). Inicios de ciclo = "día D del mes N clamped"; fin de ciclo = inicio del ciclo siguiente − 1 día.
3. **Sin migración de datos**: no hay facturas emitidas reales con rangos de calendario.
4. **Flujo manual a nivel cliente** (`RegisterInvoicePage`): **rango libre siempre**; se elimina el picker de mes `AAAA-MM`.

Reglas que se preservan intactas: D18 (un borrador por periodo, nunca fusionados, cada ciclo conserva su `tarifa_base` + `paginas_incluidas`), D20 (bloqueo por solapamiento de rangos), tope de 24 periodos por batch, advertencia "periodo en curso: lecturas incompletas", advertencia multi-mes >1.5 (un ciclo ≈ 1.0 mes, no da falso positivo).

## Identidad de periodo (cambio de contrato de API)

- Clave `periodo` de pendientes y batch: pasa de `'2026-08'` (Y-m) a **fecha de inicio del ciclo `'2026-08-20'` (Y-m-d)**.
- `ultimo_periodo_cubierto`: fecha de inicio del último ciclo cubierto (`Y-m-d`) o `null`.
- Cobertura (conservadora, igual que hoy por intersección): un ciclo está **cubierto** si alguna factura que toca el contrato (encabezado o detalles, incluye borradores) intersecta su rango.
- Frontend y backend se cambian en el mismo cambio (sin consumidores externos de la API).

---

## Tareas (orden de ejecución)

### 1. Helper de ciclos — `backend/app/Support/CicloFacturacion.php` (nuevo)

Clase pequeña y pura (estilo de `app/Support/PrinterColorPalette.php`), sin estado:

```php
// Núcleo:
inicioDeCiclo(Contract $c, int $n): Carbon   // fecha_inicio->copy()->addMonthsNoOverflow($n)->startOfDay()
bounds(Contract $c, int $n): array{inicio: Carbon, fin: Carbon}
    // inicio = inicioDeCiclo($n)
    // fin    = inicioDeCiclo($n+1)->subDay()
    // recortes a vigencia: inicio = max(inicio, fecha_inicio); si fecha_fin, fin = min(fin, fecha_fin->endOfDay())
    // si inicio > fin ⇒ fuera de vigencia (quien llame decide)
cicloActual(Contract $c): int                 // índice del ciclo que contiene hoy: floor(diffInMonths con clamp)
esInicioDeCiclo(Contract $c, Carbon $fecha): bool
```

- `diffInMonths` para `cicloActual` debe ser consistente con `addMonthsNoOverflow` (usar `$fecha_inicio->diffInMonths($hoy)` con comparación de día: si día de hoy ≥ día clamped del mes correspondiente). Implementación segura: iterar `inicioDeCiclo` desde 0 hacia arriba hasta superar hoy (tope interno 1200 ciclos); simple y a prueba de bordes de clamp.
- Ciclo 0 inicia exactamente en `fecha_inicio`.

### 2. `backend/app/Services/ContractBillingService.php` — reescribir capa de periodos

- `periodosPendientes()`:
  - Estados: CANCELADO/SUSPENDIDO → `[]` (igual).
  - Último ciclo a listar: `cicloActual(hoy)`; si FINALIZADO, el ciclo que contiene `fecha_fin` (si `fecha_fin` es null → `[]`, igual que hoy).
  - Iterar ciclo 0…último; saltar los **cubiertos** (por intersección con facturas que tocan el contrato, ver cobertura arriba). Empaquetar solo los no cubiertos (pendientes), tope 24.
  - Elimina la aritmética actual por `startOfMonth`/`addMonth` y `ultimoPeriodoCubierto` por mes.
- `estimadoDelMes()` → renombrar a `estimadoDelCiclo(Contract $c, int $n, bool $actual)`: bounds desde el helper (ya recortados a vigencia), llamada a `calcularEstimacion` igual que hoy (con `$exigirContratoActivo=false` y el filtro anti-"se solapa" igual). `actual` = ciclo actual, con la misma advertencia "Periodo en curso: las lecturas del mes aún están incompletas." (revisar copy → "del ciclo").
  - Respuesta: `periodo` = `inicio->toDateString()` (`Y-m-d`), resto de campos igual.
- `estadoFacturacion()`:
  - `facturados`: `'periodo' => $f->periodo_inicio->toDateString()` (era `format('Y-m')`); `sortByDesc` por `periodo_inicio` plano.
  - `ultimo_periodo_cubierto`: fecha de inicio del último ciclo cubierto (`Y-m-d`) o `null`.
  - Mantener firma del array de respuesta (claves iguales).

### 3. `backend/app/Services/InvoiceService.php` — `createDraftBatch`

- `periodos` entrantes: fechas `Y-m-d` de **inicio de ciclo** del contrato.
- Por cada una: parsear fecha; validar `CicloFacturacion::esInicioDeCiclo($contrato, $fecha)` (si no → `BusinessRuleException` "no es un inicio de ciclo del contrato"); bounds desde el helper (reemplaza el bloque actual de `startOfMonth`/`endOfMonth`/recortes, líneas ~186-207); mantener la guarda "fuera de la vigencia".
- Claves de `$resultados` y mensajes de error: la fecha `Y-m-d` en vez de `Y-m`.
- NO tocar: transacción all-or-nothing, `crearBorradorInterno`, `validarPeriodoNoDuplicado`, `alcanceSolapado`.

### 4. `backend/app/Http/Requests/StoreInvoiceDraftBatchRequest.php`

- `'periodos.*'`: `date_format:Y-m-d` + `distinct` + cierre: fallar si `Carbon::parse($value)->startOfDay()->isFuture()` (ciclo con inicio futuro no facturable; el ciclo en curso sí). Mensajes: "formato AAAA-MM-DD". Mantener `min:1|max:24` y mensajes existentes.

### 5. `backend/database/seeders/InvoiceSeeder.php`

- Generar `periodo_inicio/fin` por ciclo del contrato (usar `CicloFacturacion::bounds`) en vez de `startOfMonth/endOfMonth` (líneas ~43-44 y ~68-69).

### 6. Tests backend

- **Nuevos** (pueden vivir en `InvoiceContractBillingTest` o archivo propio `tests/Unit/CicloFacturacionTest.php`):
  - Ciclo normal: inicio 2026-08-20 → ciclo 0 `[2026-08-20, 2026-09-19]`, ciclo 1 `[2026-09-20, 2026-10-19]`.
  - Clamp: inicio 2026-01-31 → ciclo 0 `[2026-01-31, 2026-02-27]`, ciclo 1 `[2026-02-28, 2026-03-30]`, ciclo 2 `[2026-03-31, 2026-04-29]` (los inicios siempre "día 31 clamped", no acumulan deriva desde el fin anterior).
  - Recorte por `fecha_fin` y por `fecha_inicio` (ciclo 0).
- **Re trabajar** `tests/Feature/InvoiceContractBillingTest.php`: contratos con inicio día 1 → claves pasan de `'2026-07'` a `'2026-07-01'` (mismos rangos); caso "primer periodo parcial" (inicio 15-jun) → pendientes `['2026-06-15','2026-07-15','2026-08-15']`, `periodo_fin` del primero `2026-07-14`; caso FINALIZADO a medias ciclo (fin 10-ago con inicio día 1 → último rango `[2026-08-01, 2026-08-10]`, igual que hoy); caso rango libre que cruza ciclos (cobertura conservadora por intersección).
- **Re trabajar** batch en `tests/Feature/InvoiceDraftTest.php`: `periodos` como fechas `Y-m-d`; duplicados/unicidad D20 sin cambio conceptual.
- Verificar si `ContractPlanTest` usa el batch (solo crea facturas con rangos directos → sin cambio).
- Comando: `docker compose exec app php artisan test` (o `--filter=InvoiceContractBillingTest|InvoiceDraftTest|CicloFacturacionTest`).

### 7. Frontend — `frontend/src/types/invoice.ts`

- `PendingPeriod.periodo` / `BilledInvoice.periodo`: doc comment "AAAA-DD… **fecha de inicio del ciclo (AAAA-MM-DD)**" (el tipo sigue `string`; sin cambio estructural). `ultimo_periodo_cubierto`: comment `AAAA-MM-DD`.

### 8. Frontend — `frontend/src/pages/contracts/ContractDetail.tsx`

- Reemplazar `periodoLabel(periodo: string)` por un label de rango usando `periodo_inicio`/`periodo_fin` del propio item: `"20 ago – 19 sep 2026"` (nuevo helper `cicloLabel(inicio, fin)` con `toLocaleDateString('es-MX', {day:'numeric', month:'short'})`; año al final; si cruza año, año en ambos). Aplicar a pendientes (línea ~1262) y a facturados (~803, ya muestra fechas: dejar `"Periodo {cicloLabel(...)}"`).
- Selección/`togglePeriodo`/`openGenerarFacturas`: sin cambio lógico (`p.periodo` ahora es la fecha).
- Copy del modal (~1236-1239): "cada **ciclo** conserva sus páginas incluidas y su tarifa base" en vez de "cada mes".
- Badge "en curso": sin cambio (viene del backend `actual`).

### 9. Frontend — `frontend/src/pages/finance/invoices/RegisterInvoicePage.tsx`

- Eliminar el campo `periodo_mes` y el picker de mes (líneas ~27-71): el modo borrador pasa a capturar siempre `periodo_inicio`/`periodo_fin` con los inputs de fecha existentes (quitar la lógica que limpia/deriva bounds y el `useEffect` correspondiente).
- Ajustar copy ("El rango del periodo se captura directamente…", placeholder del resumen: ya usa fechas cuando no es modo mes).

### 10. Documentación — `PROJECT.md`

- §8 D17: enmendar la decisión — periodos **mensuales por aniversario de `fecha_inicio`** (ciclos N = `[fecha_inicio +N meses clamped, siguiente −1 día]`, recortados a vigencia); cobertura conservadora por intersección; clave de periodo `AAAA-MM-DD`. Mencionar las 4 decisiones cerradas (lectura del día de inicio al ciclo que abre; clamp fin de mes; batch por contrato; rango libre a nivel cliente).
- §5 glosario: agregar "Ciclo (de facturación)".
- Mapa de evidencia §12: fila del helper `CicloFacturacion`.

### 11. Verificación final + rebuild

- `docker compose exec app php artisan test` completo (backend).
- Grep anti-residuos: `format('Y-m'` y `startOfMonth` NO deben quedar en `ContractBillingService` ni en el path de batch de `InvoiceService` (reportes/dashboard/`PeriodController` quedan fuera de alcance, siguen por mes calendario contable).
- Rebuild del front: `docker compose run --rm --no-deps frontend sh -c "npm run build"` y hard refresh en `http://localhost:8080` (Ctrl+F5). Recordar gotcha: si nginx da 500 tras el build, `docker compose restart nginx`.

### 12. Validación E2E del caso del usuario

Contrato iniciado `2026-08-20`, hoy `2026-09-02`, lectura capturada `2026-09-02`:

1. `GET /contracts/{id}/facturacion` → **1 solo pendiente**: `periodo = '2026-08-20'`, `periodo_inicio = '2026-08-20'`, `periodo_fin = '2026-09-19'`, `actual = true`, `lecturas = 1` (la del 2-sep).
2. Generar borrador con ese periodo → factura `2026-08-20…2026-09-19` con el detalle de la lectura del 2-sep.
3. Re-consultar estado: sin pendientes; `ultimo_periodo_cubierto = '2026-08-20'`.
4. Intentar otro borrador del mismo periodo → 422 por D20 (sin cambios, debe seguir pasando).

---

## Fuera de alcance (explícito)

- `PeriodController`/cierre contable, dashboard, caja, rentabilidad: siguen agrupando por mes calendario contable (una factura con inicio de ciclo el 20-ago se bucketiza en agosto por `periodo_inicio`; semántica aceptada).
- Móvil `/m/`: sin cambios (las lecturas no conocen periodos).
- `InvoiceCalculationService`: sin cambios.
- Prorrateo de tarifa base por ciclos parciales: NO se implementa (ciclo = unidad de cobro completa; el primer/último ciclo recortado a vigencia se cobra completo, igual que hoy).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Residuos `Y-m`/`startOfMonth` en el path por contrato | Tarea 11: grep dirigido post-cambio |
| Deriva de clamp (28→30→29…) mal implementada | Tarea 1: inicios SIEMPRE desde `fecha_inicio + N meses` con `addMonthsNoOverflow`, nunca encadenando desde el ciclo anterior; tests de clamp explícitos |
| `cicloActual` inconsistente con los bounds | Calcular iterando `inicioDeCiclo` (no aritmética de meses suelta); test con hoy = día exacto de aniversario |
| Front/backend desincronizados por el cambio de formato de `periodo` | Mismo cambio (misma sesión), rebuild del dist antes de probar |
| D20 se dispara contra seeds viejos de calendario | Seeds se regeneran por ciclo (tarea 5); `docker compose up -d` re-seedea |

## Sin preguntas abiertas

Las 4 decisiones de negocio están cerradas (ver arriba). El plan está listo para ejecución por un agente con permisos de escritura.
