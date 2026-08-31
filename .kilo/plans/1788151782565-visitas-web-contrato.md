# Plan: Vincular contrato en visitas creadas desde la web

## Problema

La columna `# Impresoras` de la lista de visitas (`frontend/src/pages/operations/calendar/CalendarPage.tsx:141`) muestra `row.impresoras?.length`. Ese campo lo resuelve `VisitResource::resolveImpresoras()` (`backend/app/Http/Resources/VisitResource.php:26,51`) mapeando `$contract->activePrinters` (pivote `contract_printer.activa = true`). **No es un dato almacenado de la visita**: si la visita tiene `contrato_id = NULL`, `impresoras` es `[]` y la columna muestra 0.

El modal "Nueva visita" del calendario web nunca envía `contrato_id` (no tiene selector), y `StoreVisitRequest` lo declara `nullable` sin validar propiedad cliente↔contrato. Resultado: visitas huérfanas que muestran 0 impresoras **y quedan inservibles para los flujos de campo** (la móvil deshabilita instalación/lectura/retiro cuando `!visit.contrato_id`). La app móvil ya hace lo correcto (`mobile/src/pages/NewVisitPage.tsx`).

## Decisiones (confirmadas con el usuario)

- **D1 — Backend**: para tipos que operan sobre el contrato (`LECTURA`, `INSTALACION`, `RETIRO`, `ENTREGA_INSUMOS`), si falta `contrato_id`: auto-derivar cuando el cliente tiene exactamente 1 contrato ACTIVO; si tiene 0 o varios → 422 con mensaje claro. `MANTENIMIENTO` sigue permitiendo visita sin contrato.
- **D2 — Modal web**: listar solo clientes con contrato activo usando `GET /visits/clientes` (paridad con la móvil).
- **D3 — Datos huérfanos**: comando artisan de reparación (no migration, no SQL manual).
- **Incluidas de paso**: validación de que el contrato pertenezca al cliente y esté ACTIVO, y fix del N+1 (`index` no carga `contract.activePrinters`).

Semántica vigente que NO cambia: la columna refleja las impresoras **activas del contrato** al momento de consultar, no "impresoras de la visita".

## Tareas

### 1. Backend — resolución/validación de contrato en `VisitController::store`

Archivo: `backend/app/Http/Controllers/VisitController.php`

- Agregar constante privada `TIPOS_REQUIEREN_CONTRATO = ['LECTURA', 'INSTALACION', 'RETIRO', 'ENTREGA_INSUMOS']`.
- En `store()`, tras `$request->validated()`, resolver el contrato con un método privado `resolverContratoId(array $data): ?int`:
  - Si viene `contrato_id`: cargar el contrato; si `cliente_id` difiere del de la visita → 422 "El contrato no pertenece al cliente seleccionado"; si `estado !== ACTIVO` → 422 "El contrato no está activo".
  - Si no viene y el tipo requiere contrato: contar contratos ACTIVOS del cliente (`estado = ContractStatus::ACTIVO`); exactamente 1 → usarlo; 0 → 422 "…el cliente no tiene contratos activos"; >1 → 422 "El cliente tiene N contratos activos, selecciona uno".
  - Si no viene y es `MANTENIMIENTO` → `null`.
  - Lanzar los rechazos con `ValidationException::withMessages(['contrato_id' => ...])` para que el modal muestre el motivo (verificar que `parseApiError` lo surfacea; si solo muestra mensaje genérico, incluir `errors.contrato_id[0]`).
- Asignar `$data['contrato_id']` antes de `Visit::create`.

### 2. Backend — fix N+1 en `VisitController::index`

Mismo archivo, línea 28: cambiar el `with` a `['client', 'contract.activePrinters', 'socio', 'readings']`. Con esto `resolveImpresoras()` deja de hacer lazy loading por visita.

### 3. Backend — comando de reparación

Archivo nuevo: `backend/app/Console/Commands/LinkOrphanVisitsContract.php`
- Signature: `visits:vincular-contratos-huerfanos` con flag `--execute` (por defecto **dry-run**).
- Selecciona visitas con `contrato_id IS NULL` y `estado IN (PENDIENTE, REPROGRAMADA)`; por cada una cuenta contratos ACTIVOS del cliente: 1 → asignar (solo con `--execute`); 0 o >1 → listar como "requiere atención manual".
- Imprime tabla resumen. Registro automático por convención del directorio (igual que `visits:generate-upcoming`).

### 4. Backend — tests

Archivo nuevo: `backend/tests/Feature/VisitContractBindingTest.php` (copiar helpers `adminUser`/`createClient`/`createContract` de `SpontaneousVisitTest.php`; para asignar impresoras mirar `ContractPrinterAliasTest.php`).

Casos:
1. `LECTURA` sin `contrato_id` + 1 contrato activo → 201 con `contrato_id` auto-derivado (`assertJsonPath` + `assertDatabaseHas`).
2. Cliente con 2 contratos activos, sin `contrato_id` → 422 con error en `contrato_id`, sin fila creada.
3. Cliente con 0 contratos activos + tipo que requiere contrato → 422.
4. `contrato_id` de otro cliente → 422.
5. `contrato_id` con estado FINALIZADO → 422.
6. `MANTENIMIENTO` sin contrato → 201 con `contrato_id` null.
7. `GET /visits` (index) incluye `impresoras` con las activas del contrato (valida tarea 2).
8. Comando: visita huérfana + 1 contrato activo → `artisan visits:vincular-contratos-huerfanos --execute` asigna `contrato_id`; dry-run no modifica.

### 5. Frontend — hook de clientes con contrato

Archivo: `frontend/src/hooks/useVisits.ts`
- Exportar tipo `VisitClientOption = { id: number; razon_social: string; contratos: { id: number; codigo_negocio: string }[] }`.
- Agregar `useVisitClientOptions()` → `GET /visits/clientes`, `queryKey: ['visits', 'clientes']`.

### 6. Frontend — modal de `CalendarPage.tsx`

Archivo: `frontend/src/pages/operations/calendar/CalendarPage.tsx`
- Quitar `useClients` (import y uso); usar `useVisitClientOptions()` para `clientOptions`.
- Agregar mapa `TIPO_REQUIERE_CONTRATO: Record<VisitType, boolean>` (los 4 tipos en `true`, `MANTENIMIENTO` en `false`), espejo de la móvil.
- Estado `newVisit`: agregar `contrato_id: string`.
- Al cambiar cliente: setear `cliente_id` y preseleccionar `contratos[0]?.id ?? ''` (igual que la móvil).
- Nuevo campo "Contrato" tras el cliente: si el cliente tiene 1 contrato → texto de solo lectura con `codigo_negocio`; si tiene varios → `Select` con los contratos; (0 no debería ocurrir con este endpoint, pero mostrar aviso defensivo).
- Payload del `mutate`: incluir `contrato_id: newVisit.contrato_id ? parseInt(newVisit.contrato_id) : null`.
- `Guardar` deshabilitado además cuando `TIPO_REQUIERE_CONTRATO[tipo] && !newVisit.contrato_id`; resetear `contrato_id` al limpiar el formulario tras éxito.
- No requiere cambios en `frontend/src/types/operations.ts`.

### 7. Datos — ejecutar la reparación (Docker)

```bash
docker compose exec app php artisan visits:vincular-contratos-huerfanos          # dry-run, revisar
docker compose exec app php artisan visits:vincular-contratos-huerfanos --execute
```

### 8. Validación

1. `docker compose exec app php artisan test` (nuevos tests + `SpontaneousVisitTest`, `VisitSchedulingTest`, `VisitCompletionTest` en verde).
2. Recompilar SPA: `docker compose run --rm --no-deps frontend sh -c "npm run build"` y hard refresh en `http://localhost:8080` (Ctrl+F5).
3. E2E manual: modal Nueva visita → solo clientes con contrato activo → CBTIS + tipo Instalación → contrato preseleccionado → guardar → la lista muestra `2` en `# Impresoras` → el detalle permite instalar.
4. Verificar que la visita de instalación huérfana previa quedó con contrato (muestra 2).

## Riesgos y notas

- **Cambio de comportamiento D2**: el modal web ya no lista clientes sin contrato activo. Los casos "fuera de catálogo" ya los cubre el flujo de registros de campo (`/registro-campo`).
- **422 nuevo en la API**: el único caller HTTP que omitía `contrato_id` era el modal web (corregido aquí); la móvil ya lo envía; el scheduler y `ContractService` crean visitas por modelo, no por HTTP.
- Sin migraciones de esquema; todo es lógica + reparación de datos.
- Proyecto 100% Docker, puerto 8080; no usar `npm run dev` en host.

## Fuera de alcance

- Cambios en la app móvil (ya envía el contrato correctamente).
- Redefinir la semántica de la columna `# Impresoras` (p. ej. contar impresoras "a instalar" en visitas de instalación).
