# Plan: Plan de modelos en contrato + binding de serie en instalación de campo

## Objetivo

Separar la **intención comercial** (qué modelos se contratan) del **hecho físico** (qué serie queda instalada). El alta del contrato podrá llevar un *plan de modelos* sin series; el operador de campo vincula la serie real y captura la línea base (`lectura_inicial` = contador físico) en el momento de la instalación, reutilizando el flujo que ya existe para rotaciones (`POST /contracts/{id}/assign-printer` desde `InstallationPage.tsx`).

## Decisions de diseño resueltas

| # | Decisión | Racional |
|---|---|---|
| D-A | Nueva tabla `contract_printer_plan` (`contrato_id`, `printer_model_id`, `cantidad`, `alias_sugerido` nullable, unique `(contrato_id, printer_model_id)`). El **pivot `contract_printer` sigue siendo la única fuente de verdad de cobro**; el plan es intención, nunca alimenta lecturas/facturación. | Preserva invariantes §6 (ninguna cambia); una fila con `cantidad` cubre "2× M404" sin duplicar UI. |
| D-B | Wizard paso 2 (impresoras) se vuelve **opcional**: dos secciones — "Modelos contratados (recomendado)" y "Asignar series ahora (opcional)" (el flujo actual, intacto). `canNext` del paso 1 siempre `true`. | Híbrido: conserva la reserva blanda actual (series en alta) para quien la quiera; el backend ya tolera `impresoras` nullable (`StoreContractRequest.php:27`). |
| D-C | **La `tarifa_base` sigue corriendo desde `fecha_inicio`** (comportamiento actual: un contrato ACTIVO sin lecturas igual genera `tarifa_base` en la estimación). El binding diferido solo traslada *cuándo empieza a contar páginas* (desde la `lectura_inicial` capturada en campo). Sin cambio de código; regla documentada. | No alterar comportamiento de dinero sin pedido explícito (D1). La página se cobra desde la línea base física, no desde el contador histórico. |
| D-D | Default de `lectura_inicial` en `assignPrinter`: si no se envía, el servidor usa `printer.contador_actual` (hoy default `0` → riesgo de cobrar contador histórico). El móvil pre-llena el input con `contador_actual` de la serie elegida. | Mata el bug de línea base 0 en las dos superficies. El valor explícito del operador siempre gana. |
| D-E | Endpoint nuevo `PUT /contracts/{contract}/plan` (replace-all de filas del plan), solo con contrato `ACTIVO`, permiso `contratos`. Validación: array `plan_impresoras`, `modelo_id` exists, `cantidad` 1..20, sin modelos duplicados, `alias_sugerido` max:60. | Permite ajustar el plan post-alta (contrato crece de 2 a 3 equipos) sin endpoints por fila. Reutiliza permiso existente (D9: no hay permiso nuevo). |
| D-F | `ContractResource` expone `plan_impresoras[]` con `instaladas` (conteo de asignaciones activas por modelo) y `pendientes_instalacion` (total plan − asignaciones activas, floor 0). Lista de contratos con badge "Pendiente de instalación". | Visibilidad plan vs. instalado — el contra #3 del análisis. Cero costo en facturación (solo lectura). |
| D-G | **Scheduler intacto** (D8): la primera visita sigue siendo `LECTURA` generada en la misma transacción del alta. `tipo_visita` es motivo, no restricción: el operador puede instalar desde cualquier visita editable (ya es así hoy). | Cambiar el scheduler toca idempotencia y OMITIDA/CANCELADA; no aporta nada: la instalación ya es posible desde la visita existente. |
| D-H | `InvoiceCalculationService` agrega advertencia cuando un contrato ACTIVO tiene plan con `instaladas < cantidad` planeada: "El contrato X tiene N equipos planificados sin instalar". | Visibilidad en el momento del dinero; no bloquea (la advertencia de "sin impresoras asignadas" ya existe en `InvoiceCalculationService.php:44-46`). |
| D-I | Backfill en la misma migración: por cada contrato, agrupar asignaciones **activas** por `printer_model_id` (omitir series sin modelo catalogado) e insertar filas de plan con `cantidad = count`. Idempotente vía `insertOrIgnore` + unique. | Los contratos existentes muestran plan coherente con su flota instalada desde el minuto uno. |
| D-J | Seeder demo: un contrato ACTIVO con plan (p. ej. 2× modelo con stock en almacén) **sin** series asignadas, para que el flujo de instalación inicial sea visible en la demo. | Evidencia del flujo nuevo sin tocar los casos existentes. |
| D-K | Móvil `InstallationPage`: al cargar la visita con contrato, fetch de `GET /contracts/{id}` y banner "Plan del contrato: 2× HP M404 · Instaladas: 1"; lista de almacén ordenada con **los modelos del plan primero** (sort estable, sin filtrar — sustituir modelo sigue permitido); input de lectura inicial pre-llenado con `contador_actual` de la serie seleccionada. | El operador ve qué llevar sin perder flexibilidad de sustitución. |
| D-L | Sin cambios de permisos, sin estados nuevos de impresora, sin tocar el pivot ni su unique `(contrato_id, impresora_id)`. | `RESERVADA`, instalación offline (FieldRecord `INSTALACION`) y escaneo de serie quedan **fuera de alcance** (ver abajo). |

### Fuera de alcance (explícito, no construir)

- Estado `RESERVADA` de impresora (contención de flota). El híbrido D-B cubre el caso con series en alta.
- Instalación offline vía registro de campo `INSTALACION` (extensión de D15) — la instalación requiere online como hoy.
- Escaneo QR/código de barras de serie.
- Notificaciones server-side de "plan pendiente" (chocaría con el bug legacy `users.rol` de §10; no abrir ese tren).
- Precio por modelo (la tarifa sigue siendo por contrato).

---

## Cambios por superficie

### 1. Backend — migración + modelo

1. Migración nueva `create_contract_printer_plan_table`:
   - Tabla: `id`, `foreignId('contrato_id')->constrained('contracts')->cascadeOnDelete()`, `foreignId('printer_model_id')->constrained('printer_models')->restrictOnDelete()`, `unsignedTinyInteger('cantidad')`, `string('alias_sugerido', 60)->nullable()`, `timestamps`.
   - Unique `(contrato_id, printer_model_id)`.
   - En `up()`, tras crear la tabla: backfill D-I con una query de inserción-agrupación sobre `contract_printer` join `printers` (`activa = true`, `printer_model_id not null`), usando `insertOrIgnore`.
2. Modelo `App\Models\ContractPrinterPlan` (`$table = 'contract_printer_plan'`, fillable, casts `cantidad => integer`), relaciones `contract()` y `printerModel()`.
3. `Contract`: relación `planImpresoras(): HasMany` (y en `PrinterModel` si se desea la inversa, opcional).

### 2. Backend — validación y servicio

4. `StoreContractRequest`: agregar `'plan_impresoras' => 'nullable|array'`, `plan_impresoras.*.modelo_id => required_with:plan_impresoras|exists:printer_models,id`, `plan_impresoras.*.cantidad => required_with:plan_impresoras|integer|between:1,20`, `plan_impresoras.*.alias_sugerido => nullable|string|max:60`. Rechazar `modelo_id` duplicados (validación custom o `Rule::distinct` en el array).
5. `ContractService::create`: dentro de la transacción existente, `unset($data['plan_impresoras'])` y crear las filas de plan antes de asignar impresoras. Todo lo demás queda igual (primera visita incluida).
6. `ContractService::assignPrinter`: aceptar `?int $initialReading = null`; si es `null`, usar `(int) $printer->contador_actual`. `ContractController::assignPrinter`: pasar `$data['lectura_inicial'] ?? null` (hoy `?? 0`).
7. `ContractService` nuevo método `updatePlan(Contract, array $rows): Contract` — transaccional, replace-all (`delete()` + `create()` por fila); `BusinessRuleException` si el contrato no está `ACTIVO`. Manejo de duplicados por el unique como backstop (mismo patrón que alias).
8. `ContractController::updatePlan` + ruta `Route::put('contracts/{contract}/plan', ...)` junto a las existentes (api.php:111-114), mismo grupo de permisos que `contracts`.

### 3. Backend — recursos y estimación

9. `ContractResource`: campo `plan_impresoras` (`whenLoaded`) con `{id, modelo_id, marca, modelo_nombre, cantidad, alias_sugerido, instaladas}`; `instaladas` = conteo de `printers` cargadas con `pivot.activa && printer_model_id == modelo_id`. Campo `pendientes_instalacion` = `max(0, Σcantidad − activas_totales)` (requiere `planImpresoras` cargada y conteo de activas; en `index`/`show` eager-load `planImpresoras.printerModel.brand` y usar `active_printers_count`).
10. `ContractController::index/show`: agregar `->withCount('activePrinters')` (cuidando que el `printers_count` existente no cambie de significado) y los eager loads del punto 9.
11. `InvoiceCalculationService::calcularEstimacion`: por cada contrato, si tiene plan (cargar `planImpresoras`) y `Σcantidad > asignaciones activas` → push advertencia D-H. No altera montos.

### 4. Frontend web

12. `CreateContract.tsx` paso 2 (`step === 1`):
    - Sección A "Modelos contratados": filas editables (select de modelo desde `GET /printer-models` — crear hook react-query siguiendo el patrón de `useClients`/`usePrinters` — + cantidad + alias opcional; botón agregar/quitar fila).
    - Sección B plegada "Asignar series ahora (opcional)": el selector actual `EN_ALMACEN` con lectura inicial/alias, sin cambios de comportamiento.
    - `canNext` paso 1 → `true` siempre.
    - Paso resumen (step 3) + modal de confirmación: mostrar plan y series; el copy de efectos distingue ("las series seleccionadas pasarán a RENTADA; los modelos quedarán como plan de instalación en campo").
    - Payload: agregar `plan_impresoras` junto a `impresoras` (que puede ir vacío).
13. `ContractDetail.tsx`: card "Plan de equipos" con filas `Marca Modelo — Instaladas X de N` (badge ámbar "Pendiente N" si `X < N`, solo en contrato ACTIVO) y acción admin "Editar plan" (modal con las mismas filas del wizard → `PUT /contracts/{id}/plan`). El tab/listado de asignaciones existente no cambia.
14. `ContractList.tsx`: badge "Pendiente de instalación" cuando `pendientes_instalacion > 0` (usa el campo del resource; sin cálculo en cliente más allá del flag ya computado por el servidor).
15. Tipos TS: extender `Contract` en `frontend/src/types` con `plan_impresoras` y `pendientes_instalacion` (español, sin estados nuevos de enums → sin cambios en `enums.ts`).

### 5. Móvil

16. `InstallationPage.tsx`:
    - Tras obtener `contrato_id`, fetch `GET /contracts/{contratoId}`; banner informativo "Plan: 2× HP M404 · Instaladas: 1" (solo si el contrato tiene plan).
    - Ordenar la lista de impresoras `EN_ALMACEN`: primero las cuyo `printer_model_id` esté en el plan (sort estable por marca/modelo dentro de cada grupo). No filtrar.
    - Al seleccionar una serie, pre-llenar `lecturaInicial` con `p.contador_actual` (hoy `'0'`); editable como hoy.
    - Sin cambios de permisos (`contratos` + `inventario.impresoras`), sin cola offline (online obligatorio como hoy).

### 6. Seeders y docs

17. `ContractSeeder`: agregar el contrato demo D-J (con plan, sin series; usar modelos/stock ya sembrados por `PrinterSeeder`).
18. `PROJECT.md`: nueva decisión **D16** (plan ≠ asignación; el plan nunca es fuente de cobro), fila de `ContractPrinterPlan` en §5, nota en el flujo maestro §7 y en el mapa de evidencia §12. Actualizar "Última revisión".

---

## Casos borde y reglas

- Contrato con plan y sin series → 201; primera visita `LECTURA` normal; estimación de factura muestra `tarifa_base` + advertencias (la nueva D-H y la existente de "sin impresoras").
- Instalación de un modelo **fuera** del plan → permitida (sustitución legítima); el resource muestra `instaladas` reales por modelo (puede exceder `cantidad`); `pendientes_instalacion` global usa floor 0.
- `PUT /plan` en contrato `SUSPENDIDO/FINALIZADO/CANCELADO` → 422 `BusinessRuleException`.
- `assign-printer` sin `lectura_inicial` → pivot recibe `contador_actual` de la serie (D-D). El flujo de FieldRecord pasa valor explícito → intacto.
- Backfill: series con `printer_model_id` null quedan sin plan (solo catálogo completo); la migración es re-ejecutable sin duplicar por el unique.
- Invariante 6 (impresora activa en ≤1 contrato) y máquina de estados de impresora: **sin cambios**; se siguen validando en `assignPrinter` al momento del binding.
- Wizard sin plan y sin series → permitido (backend ya lo tolera); el resumen muestra aviso "El contrato quedará activo sin equipos; instala desde la app de campo".

## Tests (PHPUnit, patrón de `ContractPrinterAliasTest`: `RefreshDatabase` + rol `es_sistema` + Sanctum)

1. Crear contrato con solo `plan_impresoras` → 201, filas de plan creadas, contrato `ACTIVO`, 1 visita `LECTURA`, ninguna impresora `RENTADA`.
2. Crear con plan + series y con solo series (retro-compatibilidad) → ambos persisten.
3. `plan_impresoras` con `modelo_id` duplicado → 422.
4. `PUT /contracts/{id}/plan` reemplaza filas en ACTIVO; 422 en SUSPENDIDO.
5. `assign-printer` sin `lectura_inicial` → pivot `lectura_inicial == contador_actual` de la impresora; con valor explícito se respeta.
6. `ContractResource`: `instaladas`/`pendientes_instalacion` correctos con plan parcialmente cubierto y con modelo sustituto.
7. Estimación de factura: contrato ACTIVO con plan incompleto produce la advertencia D-H y el monto sigue incluyendo `tarifa_base`.

## Verificación (comandos)

```bash
docker compose exec app php artisan migrate          # migración + backfill
docker compose exec app php artisan test             # suite completa
docker compose exec app php artisan config:cache     # ruta nueva en api.php
docker compose run --rm --no-deps frontend sh -c "npm run build"
docker compose run --rm --no-deps mobile   sh -c "npm run build"
# Lints solo si se piden: npm run lint en frontend/ y mobile/
```

Recargar `http://localhost:8080` con Ctrl+F5 tras los builds.

## Orden de ejecución

1. Migración + modelo + backfill (1.x) → 2. Request/Servicio/Controller/Ruta (2.x) → 3. Resource + estimación (3.x) → 4. Tests backend → 5. Wizard y detalle web (4.x frontend) → 6. Móvil (5.x) → 7. Seeder + PROJECT.md → 8. Migrate + test + config:cache + builds de dist.
