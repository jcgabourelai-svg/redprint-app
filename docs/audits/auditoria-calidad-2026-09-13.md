# Auditoría exhaustiva de calidad de código — RedPrint

**Fecha:** 2026-09-13
**Alcance:** código fuente completo del monorepo (`backend/`, `frontend/`, `mobile/`, `deploy/`, `nginx/`, `docker-compose.yml`, seeders, migraciones, tests, docs).
**Metodología:** lectura asistida de los 422 archivos fuente (188 PHP de `app/`, 197 TS/TSX de frontend, 37 de móvil, 66 migraciones, 33 suites de tests) + verificación puntual de cada hallazgo crítico/alto contra el código. Priorización según el marco del propio proyecto (PROJECT.md §11.6): *integridad de dinero y stock > pérdida de datos > cobertura del negocio > UX > estética*.

---

## 1. Resumen ejecutivo

| Severidad | Hallazgos | Ejemplo representativo |
|---|---|---|
| **Crítico** | 6 | Sobrepago concurrente en facturas; pantalla de compras crashea; "Registrar Cobro" que no registra |
| **Alto** | 22 | Login sin rate limiting; doble descargo de stock; IDOR en notificaciones; cero CI |
| **Medio** | 34 | N+1 estructural en listados de clientes/contratos; CSRF deshabilitado; mocks en reportes |
| **Bajo** | 18 | Código muerto menor; tildes; artefactos commiteados |

**Diagnóstico general.** El proyecto confirma el patrón típico de *vibe coding* con una particularidad: **la calidad es muy asimétrica**. El núcleo de facturación/lecturas/visitas y el orquestador de deploy tienen madurez de producción (transacciones, locks, índices únicos parciales, dedup idempotente por UUID). En cambio, los puntos de frontera que mueven dinero en silencio concentran casi todo el riesgo: conciliación bancaria (SQL de MySQL sobre Postgres — rota siempre), pagos (sin lock, sin validación de sobrepago en proveedores), frontend financiero heredado (botones que no hacen nada, crashes por imports faltantes que el build no detecta porque no typechequea) y el sync offline móvil (lecturas duplicables → sobrefacturación).

**Top 6 riesgos (orden de corrección sugerido):**

1. `ReconciliationController` usa `DATE_FORMAT()` de MySQL sobre PostgreSQL → los endpoints de conciliación devuelven **500 siempre** (CRÍTICO-A1).
2. `PaymentService::registerPayment` sin `lockForUpdate` → dos pagos concurrentes rompen la invariante `monto_pagado ≤ monto_total` (CRÍTICO-A2).
3. Lecturas offline sin idempotencia server-side → lectura duplicada facturada al cliente (CRÍTICO-A3).
4. `PurchaseDetail.tsx` usa `useState` sin importar y `ReconciliationPage.tsx` renderiza `<Input>` sin importar → pantallas en blanco; el build de Vite no typechequea y `npm run lint` está roto (CRÍTICO-D1/D2 + F5).
5. "Registrar Cobro" de cuentas por cobrar solo cierra el modal → el usuario cree que cobró (CRÍTICO-D3).
6. Sin CI, sin tests en frontend/móvil, y los tests backend (313) no cubren pagos, auth, compras ni conciliación → nada impide que lo anterior vuelva a pasar (ALTO-F1/F2).

---

## 2. Hallazgos críticos

### CRÍTICO A1 — SQL de MySQL sobre PostgreSQL: conciliación rota
- **Archivo:** `backend/app/Http/Controllers/ReconciliationController.php:27` y `:58`
- **Problema:** `->whereRaw("DATE_FORMAT(fecha, '%Y-%m') = ?", [$periodo])`. `DATE_FORMAT` no existe en PostgreSQL (default del proyecto: `pgsql`). El binding evita inyección, pero la función jamás ejecuta.
- **Impacto:** `GET /reconciliation/{id}/movements` y `/summary` lanzan `QueryException` → HTTP 500 **siempre**. El módulo de conciliación es inutilizable desde su despliegue; nadie puede haberlo probado contra Postgres.
- **Recomendación:** reemplazar por `whereBetween('fecha', [Carbon::parse($periodo)->startOfMonth(), Carbon::parse($periodo)->endOfMonth()])` (o `to_char`). Añadir un feature test que ejercite el endpoint.

### CRÍTICO A2 — Registro de pagos sin lock pesimista: sobrepago concurrente
- **Archivo:** `backend/app/Services/PaymentService.php:21-33`
- **Problema:** dentro de `DB::transaction`, la factura se lee con `Invoice::findOrFail()` **sin `lockForUpdate`**; `validateAmount()` (línea 53: `monto > saldo_pendiente`) es un check-then-act sobre datos sin lock, seguido de `increment`/`decrement` ciegos.
- **Impacto:** dos pagos concurrentes de $800 sobre saldo $1,000 pasan ambos la validación → `monto_pagado = 1,600 > monto_total`, `saldo_pendiente = −600`. Rompe la invariante nº 5 de PROJECT.md §6 y corrompe saldos de clientes. El patrón correcto ya existe en el propio código (`InvoiceService::emitir`, línea 306) — es una omisión, no una decisión.
- **Recomendación:** `$invoice = Invoice::whereKey($data['factura_id'])->lockForUpdate()->firstOrFail();` dentro de la transacción. Añadir CHECK constraint SQL (`monto_pagado <= monto_total AND saldo_pendiente >= 0`) como backstop.

### CRÍTICO A3 — Lectura offline duplicable (sin idempotencia): sobrefacturación
- **Archivos:** `mobile/src/lib/sync.ts:119-124`, `backend/app/Services/ReadingService.php:32-64`, migración `0001_01_01_000009_create_readings_table.php:13-14`
- **Problema:** el item `reading` se sincroniza con `POST /readings` **sin `client_uuid`** (solo `field_record` lo lleva). Si la app muere entre el 200 del POST y el `deleteItem()` de la cola, el item se reenvía. El backend no tiene unique por `(visita_id, impresora_id)` ni chequeo de duplicidad bajo el lock de la visita.
- **Impacto:** lectura doble → páginas del periodo duplicadas → **sobrefacturación**. Es el peor fallo posible en un sistema de cobro por consumo (deuda conocida de PROJECT.md §10, aquí confirmada con evidencia).
- **Recomendación:** añadir `client_uuid` al payload de lectura + índice único parcial `(visita_id, impresora_id)` en `readings` + traducción de 23505 a `BusinessRuleException`, replicando el mecanismo ya implementado de `FieldRecordService`.

### CRÍTICO D1 — `PurchaseDetail.tsx` usa `useState` sin importarlo: pantalla en blanco
- **Archivo:** `frontend/src/pages/finance/purchases/PurchaseDetail.tsx:37`
- **Problema:** `const [receiveError, setReceiveError] = useState('')` sin `import { useState } from 'react'` (verificado: el archivo importa 17 módulos, ninguno de React).
- **Impacto:** al abrir `/finanzas/compras/:id` → `ReferenceError: useState is not defined` → pantalla en blanco sin recuperación. Llegó al `dist` en producción porque `npm run build` ejecuta solo `vite build` (sin `tsc`).
- **Recomendación:** añadir el import; incorporar `tsc --noEmit` al build (como ya hace `mobile/package.json`).

### CRÍTICO D2 — `ReconciliationPage.tsx` renderiza `<Input>` sin importarlo
- **Archivo:** `frontend/src/pages/finance/accounts/ReconciliationPage.tsx:275`
- **Problema:** el modal "Vincular Movimiento Bancario" usa `<Input ...>` pero el archivo no importa `Input` (imports verificados, líneas 1-12).
- **Impacto:** `ReferenceError` al hacer clic en "Vincular movimiento" — justo la acción central de la conciliación (ya rota de lado backend por A1).
- **Recomendación:** importar `@/components/ui/Input` + typecheck en CI.

### CRÍTICO D3 — "Registrar Cobro" no registra nada
- **Archivo:** `frontend/src/pages/finance/receivables/ReceivablesList.tsx:390-393`
- **Problema:** el botón primario del modal de cobro solo hace `setShowPaymentModal(false)`; no existe mutación ni llamada API. El formulario captura monto, método, cuenta, socio y referencia… y los descarta.
- **Impacto:** el usuario cree que registró un cobro que no existe → estados de factura, saldos y reportes divergen de la realidad percibida por el usuario. Corrupción silenciosa del flujo financiero.
- **Recomendación:** conectar a `useCreatePayment` (patrón ya usado en `InvoiceList`/`InvoiceDetail`) o deshabilitar el botón hasta implementarlo.

---

## 3. Hallazgos altos

### Seguridad / autenticación

**ALTO B1 — Login sin rate limiting y sin regeneración de sesión.** `backend/routes/api.php:41`, `backend/app/Http/Controllers/AuthController.php:14-32`, `nginx/default.conf.template:16-30`. Ni `throttle:` en Laravel ni `limit_req` en nginx; además `Auth::login()` sin `$request->session()->regenerate()` (fijación de sesión). En una app financiera, fuerza bruta ilimitada. *Fix:* `RateLimiter::for('login', ...)` + `->middleware('throttle:login')` + `session()->regenerate()` tras login.

**ALTO B2 — Contraseña temporal con ~13 bits de entropía.** `backend/app/Http/Controllers/UserController.php:55-59`: `'Temp' . rand(1000, 9999)` devuelta en el JSON. Combinado con B1 y el mínimo de 6 caracteres de `StoreUserRequest.php:19`, fuerza bruta trivial. *Fix:* `Str::password(12)`, flag de rotación obligatoria y `AuditLog` de la acción.

**ALTO B3 — IDOR en notificaciones.** `backend/app/Http/Controllers/NotificationController.php:29-33`: `markAsRead` actualiza la notificación sin verificar `usuario_id === auth()->id()` (el propio `index()` y `markAllAsRead()` sí filtran — inconsistencia interna). Cualquier usuario con `sistema.notificaciones` puede marcar leídas notificaciones ajenas enumerando IDs. *Fix:* scoping por usuario en el `findOrFail` (o Policy).

**ALTO B4 — `APP_DEBUG=true` puede llegar a producción.** `backend/.env.example:5` + `backend/entrypoint.sh:34-42`: el entrypoint crea el `.env` desde el ejemplo si falta y nunca fuerza `APP_DEBUG=false`. Un VPS sin `.env` manual sirve stack traces, rutas y variables de entorno. *Fix:* si `APP_ENV=production` → forzar `APP_DEBUG=false` o abortar el arranque sin `.env` explícito.

**ALTO B5 — Dashboard expone KPIs financieros sin permiso.** `backend/routes/api.php:48` + `DashboardController.php:34-177`: `GET /dashboard` fuera de todo grupo `permission:`; devuelve ingresos del mes, saldo por cobrar, valor de inventario, rentabilidad por cliente. El filtrado es solo en la UI: autorización client-side = sin autorización. *Fix:* partir la respuesta en bloques por permiso (`tienePermiso('finanzas.*')` → KPIs de dinero, etc.).

### Backend — integridad de datos y dinero

**ALTO C1 — `complete`/`cancel` de mantenimiento validan estado fuera de la transacción.** `backend/app/Services/MaintenanceService.php:115-121` y `:191-197`: el guard `estado !== PROGRAMADA` se evalúa antes de `DB::transaction` sin re-fetch bloqueado. Dos `complete` concurrentes → **stock descontado dos veces** por artículo (kardex duplicado), impresora restaurada dos veces, `costo_total` duplicado. *Fix:* re-fetch con `lockForUpdate` + re-validación dentro de la transacción (patrón de `InvoiceService::emitir`).

**ALTO C2 — Pago a proveedor sin validación de monto ni lock: sobrepago en un solo request.** `backend/app/Services/PurchaseService.php:96-114` + `SupplierPaymentController.php:47-55`: solo se verifica `saldo_pendiente <= 0`; **nunca** `monto <= saldo_pendiente` (el request valida `min:0.01` únicamente) y la compra no se bloquea. Un pago de $50,000 sobre saldo $10,000 queda registrado: `monto_pagado > monto_total` sin necesidad de concurrencia. *Fix:* replicar la semántica de `PaymentService::validateAmount` sobre la compra con `lockForUpdate`.

**ALTO C3 — `assignPrinter` con 3 escrituras sin transacción.** `backend/app/Services/ContractService.php:209-334` (invocado sin envoltura desde `ContractController.php:114`): pivot `attach` (línea 289) + `printers.estado/almacen_id` (307) + `PrinterHistory` (326). Un fallo intermedio deja la impresora asignada pero `EN_ALMACEN` (o viceversa) sin evento de historial. `releasePrinter` sí tiene transacción (línea 363). *Fix:* envolver el cuerpo en `DB::transaction` (savepoints anidados inocuos).

**ALTO C4 — N+1 estructural por `$appends` en `Client` y `Contract`.** `backend/app/Models/Client.php:32,57-72` y `Contract.php:38,131-192`: cada serialización de cliente ejecuta **~5 queries** (el accessor `estado` re-invoca `saldo_pendiente`, que no se memoiza → el cálculo pesado corre dos veces); cada contrato **~6+6N** queries (rentabilidad re-invoca ingresos y costos). Listado de 25 contratos ≈ **900+ queries**. *Fix:* memoizar accessores (`$this->saldoCache ??= ...`), o `withSum` en listados y exponer appends solo en `show()`; a mediano plazo, columnas desnormalizadas mantenidas por servicios.

**ALTO C5 — Rutas `apiResource` apuntan a métodos inexistentes → 500.** `backend/routes/api.php:116,120,189`: `clients` y `contracts` (recursos completos) sin `destroy()` en sus controllers; `purchases` completo sin `update()` ni `destroy()`. `DELETE /clients/{id}`, `DELETE /contracts/{id}`, `PUT /purchases/{id}` y `DELETE /purchases/{id}` lanzan `ReflectionException` (500) en vez de 404/405. *Fix:* `->only([...])`/`->except([...])` explícitos o implementar los métodos.

**ALTO C6 — Cierre de periodo cuenta conciliación con columna y valores equivocados.** `backend/app/Http/Controllers/PeriodController.php:66-72,154-160`: `BankMovement::where('tipo','conciliado'|'pendiente')` — la columna real es `conciliacion_status` con valores `CONCILIADO`/`PENDIENTE` (migración `000025:18`). Los contadores siempre son 0 → la validación de cierre "conciliación pendiente" da `ok` con pendientes reales y el snapshot `PeriodClose` persiste cifras falsas. *Fix:* usar `conciliacion_status`; extraer el cálculo a `PeriodService` con tests.

### Frontend

**ALTO D4 — Contraseñas persistidas en localStorage por ConfigPage.** `frontend/src/pages/admin/ConfigPage.tsx:49-70,187-214`: el "cambio de contraseña" es 100% local (toasts falsos; existe `ChangePasswordPage` real no enlazada) y el `useEffect([config])` guarda el objeto completo — incluidos `passwordActual/Nueva/Confirmar` — en `localStorage` con cada tecleo. Credenciales en texto plano en disco + feature falsa. *Fix:* nunca persistir campos de contraseña; enlazar a la API o redirigir a `/cambiar-contrasena`.

**ALTO D5 — Botones de acción sin handler en flujos de dinero.** `InvoiceList.tsx:158-160` ("Eliminar" factura), `PurchaseList.tsx:158-163` ("Registrar pago" de compra), `ReconciliationPage.tsx:231-238` ("Ver Reporte"/"Enviar email"), `VisitDetailPage.tsx:218-221` ("Imprimir"), `Header.tsx:111-113` ("Ver todas"). Deuda documentada y vigente: botones que mienten. *Fix:* conectar a mutaciones existentes (`useDeleteInvoice` ya existe) o retirarlos.

**ALTO D6 — Bug de casing habilita "Cancelar" en compras ya recibidas.** `frontend/src/pages/finance/purchases/PurchaseList.tsx:166-173`: `row.estado !== 'pendiente'` compara en minúsculas, pero el API envía `PENDIENTE` (línea 148 compara en mayúsculas). La condición siempre es verdadera → Cancelar clickeable para RECIBIDA/CANCELADA. Mismo bug en `ReconciliationPage.tsx:147` (`'conciliado'` vs `CONCILIADO` → "Vincular" disponible en movimientos ya conciliados). *Fix:* unificar casing contra los enums de `types/enums.ts`.

**ALTO D7 — Eliminaciones que solo mutan estado local.** `UserListPage.tsx:132-135` y `NotificationCenterPage.tsx:62-74,260-264`: `handleDelete`/acciones masivas filtran arrays locales; el usuario/la notificación "revive" al recargar. En NotificationCenter además la paginación `1/2/3` es decorativa (hardcodeada). *Fix:* mutaciones reales con invalidación de react-query.

**ALTO D8 — Reportes financieros con mocks.** `CashFlowReport.tsx:11-25,248-264` (`mockIncomeBreakdown`/`mockExpenseBreakdown`, chips "+12%" fijos, `NaN%` si el mes previo es 0, "Exportar" muerto, periodos fijos mayo/junio 2026) y `ProfitabilityReport.tsx:11-20,49-52` (`mockTrend`, porcentajes fijos). Datos inventados presentados como reales en el módulo de dirección. *Fix:* consumir los endpoints de `FinanceReportController` (que sí existen) y eliminar los mocks.

**ALTO D9 — Dependencias muertas y toolchain de calidad roto.** `frontend/package.json`: sin uso real `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@faker-js/faker` (además en `dependencies` en vez de devDeps), `@tailwindcss/typography` (no está en plugins de tailwind), `@testing-library/*` y `vitest` (0 archivos de test en todo el repo), storybook (5 paquetes sin directorio `.storybook/` → `npm run storybook` no arranca pese a 18 `.stories.tsx`). **`npm run lint` falla**: invoca `eslint` que no está instalado ni configurado. Imagen de calidad falsa + superficie de supply-chain. *Fix:* instalar y configurar eslint + escribir el primer test, o eliminar scripts y deps.

**ALTO D10 — `vite.config.js` compilado convive con el `vite.config.ts` editable.** `frontend/` contiene `vite.config.js` (1050 B), `vite.config.ts` (770 B) y `vite.config.d.ts`. Vite resuelve el `.js` primero: **el archivo que la gente edita (`.ts`, con comentarios) está muerto** y el que corre es un artefacto compilado. Trampa de mantenimiento. *Fix:* borrar `vite.config.js`/`.d.ts` y gitignorarlos.

### Tests / CI

**ALTO F1 — No existe CI.** Sin `.github/workflows` ni ningún pipeline; `mobile/README.md:~30` documenta una CI inexistente. Los 313 tests backend y los builds TS no corren nunca automáticamente; `deploy/update.sh` despliega sin ejecutar tests → los regresiones llegan a producción por diseño del flujo. *Fix:* workflow mínimo (php artisan test + lint/build de frontends) como gate de merge.

**ALTO F2 — Cobertura invertida respecto al riesgo.** Backend: 33 suites/313 tests, 0 Unit; facturación y visitas bien cubiertas; **sin ningún test dedicado** para pagos, compras/pagos a proveedor, bancos/conciliación, gastos, dashboard/reportes, `AuthController`, usuarios/roles. Frontend: 0 tests (con vitest ya instalado). Móvil: 0 tests y sin runner; `mobile/src/lib/sync.ts` (la pieza más crítica del sistema) es 100% testeable sin navegador y no está testeada. *Fix:* priorizar `PaymentService`, `AuthController` y `sync.ts`.

**ALTO F3 — Cola offline sin reintento programado.** `mobile/src/lib/sync.ts:107-138`: en 5xx/error de red el loop hace `break`; la cola solo se re-dispara con evento `online`, nuevo enqueue, montaje o botón manual. Si el VPS devuelve 502 con `navigator.onLine === true` (deploy en curso), la cola queda indefinidamente pendiente sin señal. *Fix:* backoff exponencial (30 s → 5 min, con tope) mientras haya items y conexión.

---

## 4. Hallazgos medios

### Seguridad / configuración

**MEDIO B6 — CSRF deshabilitado para toda la API con auth por cookie.** `backend/bootstrap/app.php:22-24`: `validateCsrfTokens(except: ['/api/*'])` mientras la autenticación es SPA stateful por cookie. `SameSite=lax` mitiga el CSRF clásico, pero elimina la defensa en profundidad en endpoints que mueven dinero (y el endpoint `/auth/csrf` que setea cookie queda como ritual muerto). *Fix:* quitar la excepción global (Sanctum stateful ya exige XSRF a clientes first-party).

**MEDIO B7 — `trustProxies(at: '*')`.** `backend/bootstrap/app.php:18`: confía en cualquier proxy → si un cliente alcanza php-fpm sorteando nginx, puede forjar `X-Forwarded-For` (afecta `ip_origen` de audit logs y futuros rate limits). *Fix:* listar los proxies reales (Caddy/nginx).

**MEDIO B8 — Fotos base64 sin tope de tamaño end-to-end.** Requests: `StoreReadingRequest.php:28`, `StoreFieldRecordRequest.php:34`, `StoreMaintenanceOrderRequest.php:23` — solo `nullable|string` sin `max:`. Columnas `text` en DB (`migrations ...foto_evidencia...`). Cliente: `mobile/src/lib/photo.ts:9` — si `canvas.getContext` falla, devuelve el data URL **original sin límite** (foto 12 MP ≈ 6 MB +33% base64). Infra: nginx `client_max_body_size 20M` vs PHP `post_max_size` 8M (sin php.ini custom) → ventana 8–20 M de comportamiento confuso y payloads multi-MB persistidos en Postgres. *Fix:* tope de tamaño validado en request (`max:2000` p. ej.), rechazo en el picker móvil, php.ini alineado; a futuro, mover a disco/archivo.

**MEDIO B9 — `Sanctum::expiration => null` y defaults residuales de dev.** `config/sanctum.php` (tokens sin expiración) y `config/cors.php:9` (`allowed_origins` default `http://localhost:5173`, puerto de un flujo dev que AGENTS.md declara inexistente). *Fix:* expiración finita si se emiten tokens; defaults alineados al despliegue real (same-origin/8080).

**MEDIO B10 — Bitácora de auditoría con un solo escritor.** `grep AuditLog:: → solo UpdateController.php:34` (el propio comentario lo admite: "Primer escritor real"). PROJECT.md anuncia "bitácora de auditoría" como feature, pero logins, pagos, facturas, bajas y cambios de roles no dejan rastro. *Fix:* observer/listener central (`deleted`, `updated` de entidades críticas) o writes en los servicios de dinero.

### Backend — calidad de la capa HTTP

**MEDIO B11 — `per_page` sin tope ni validación.** `InvoiceController.php:66`, `PaymentController.php:32`, `ArticleController.php:61`, `MaintenanceOrderController.php:80`, `VisitController.php:60` (entre otros): `paginate($request->per_page ?? 15)` → `?per_page=100000` dumpea la tabla; un valor no numérico rompe `LIMIT` en Postgres (500). *Fix:* helper central `perPage()` con `integer|min:1|max:100`.

**MEDIO B12 — Filtros sin validar → 500 o vacíos silenciosos.** `VisitController.php:51-52`: `?month=abc` → `QueryException` 500 (debería ser 422); filtros `estado` sin `Rule::enum` en varios index (lista vacía silenciosa). *Fix:* `$request->validate(['month' => 'nullable|integer|between:1,12', ...])`.

**MEDIO B13 — `reschedule()` sin guarda de estado.** `VisitController.php:182-194`: actualiza `fecha_programada` + `estado=REPROGRAMADA` sin el chequeo de estados terminales que sí aplica `update()` (líneas 153-155). Una visita COMPLETADA puede "revivir", corrompiendo lecturas ya vinculadas. *Fix:* extraer la guarda y aplicarla en todas las transiciones. Relacionado: `VisitController.php:204` escribe `estado=OMITIDA` directo en el modelo, bypaseando `VisitService` (única escritura de estado fuera de servicios).

**MEDIO B14 — Validación inline con reglas más débiles que el alta.** `ContractController.php:80-95`: `'frecuencia_visitas' => 'sometimes|string'` sin `in:MENSUAL,QUINCENAL,SEMANAL,CUSTOM` (que `StoreContractRequest.php:24` sí exige) → se puede persistir cualquier string que rompe el scheduler. Patrón general: ~14 endpoints validan inline en vez de FormRequest; los bugs de drift (C6, B14) nacen todos del lado inline. *Fix:* `UpdateContractRequest` + migrar el resto de validación inline a FormRequests.

**MEDIO B15 — `update` reutiliza `StoreRequest` con campos `required`.** `ClientController.php:46-50` (y patrón similar en otros): PUT parciales fallan 422 con datos que ya existen. *Fix:* `UpdateClientRequest` con reglas `sometimes`.

**MEDIO B16 — Respuestas sin Resource (exposición y contrato inconsistente).** `ArticleController.php:63` (paginador crudo → expone `motivo_baja` y todas las columnas), `WarehouseController.php:82-90` (modelos `Printer` crudos con `costo_adquisicion` a usuarios con solo `inventario.almacenes`), `MaintenanceOrderController.php:162-165`, `PurchaseController.php:80-83`, `AuditLogController.php:47-56` (wrap manual distinto), `PrinterController.php:97-101` (history crudo pese a existir `PrinterHistoryResource`). *Fix:* estandarizar Resources en todos los endpoints.

**MEDIO B17 — N+1 en endpoints.** `FinanceReportController.php:47-97` (`clientProfitability`: 3 queries por cliente — 200 clientes ≈ 600 queries, con lógica de dinero en el controller); `VisitResource.php:56-66` (llama `umbralAnomalia()` — 2 queries — por cada visita serializada); `TonerService.php:142-214` (3 queries por impresora en `rendimientoReal`). *Fix:* agregación SQL agrupada / memoización por request / reutilizar los helpers en lote que ya existen (`lecturasConNivelPorImpresora`).

**MEDIO B18 — `PeriodController`: duplicación masiva + GET con efectos.** `PeriodController.php:22-88` vs `:99-204`: `current()` y `close()` duplican ~60 líneas de agregación; `current()` es un GET que crea filas `period_close` y calcula métricas que luego descarta. *Fix:* extraer `PeriodService::snapshot($periodo)`; sin persistencia en GET.

**MEDIO B19 — Conciliación `link()` con FK ambigua y sin validaciones.** `ReconciliationController.php:79-126`: guarda `transaccion_vinculada_id` para `Payment` y `SupplierPayment` sin columna de tipo; no verifica montos, ni cuenta, ni unicidad de la transacción vinculada (doble conciliación silenciosa). *Fix:* columna de tipo (o relación polimórfica) + validación de monto con tolerancia + unicidad.

### Backend — datos y servicios

**MEDIO C7 — FKs sin índice en las rutas de query más calientes.** `payments.factura_id` (migración 000013:13), `invoice_details.factura_id` (000012:13), `readings.impresora_id`/`visita_id` (000009:13-14), `contract_printer.impresora_id` (000007:14), `notifications.(referencia_tipo,referencia_id)`. Seq scans que crecen con las tablas de mayor histórico (lecturas/detalles); `getPreviousReading` corre en cada captura. *Fix:* migración con `CREATE INDEX CONCURRENTLY` (patrón ya usado en la 000035).

**MEDIO C8 — Sin unique `(visita_id, impresora_id)` en readings (server-side).** Pilar del CRÍTICO A3; la dedup es solo client-side. *Fix:* índice único parcial + captura de 23505.

**MEDIO C9 — Flujo de caja con doble conteo de egresos.** `CashFlowService.php:18-33`: `egresos = SupplierPayment + PrinterExpense + Purchase.monto_total` sin filtro de estado — una compra recibida y pagada cuenta **dos veces**; una compra CANCELADA cuenta como egreso. El dashboard sobre-reporta egresos sistemáticamente. *Fix:* base caja (solo `SupplierPayment`) o compras RECIBIDAS por `monto_pagado`; filtrar CANCELADA.

**MEDIO C10 — Carrera en el primer código del día.** `CodeGeneratorService.php:9-46`: `SELECT ... FOR UPDATE` sobre filas del prefijo del día no bloquea nada cuando aún no existe ninguna → dos creaciones concurrentes generan el mismo `codigo_negocio` → `QueryException` 500 sin traducir. *Fix:* capturar `UniqueConstraintViolationException` y reintentar (2-3 veces) o tabla de secuencias con fila siempre existente.

**MEDIO C11 — Código muerto confirmado (backend).** Sin callers verificados: enum `UserRole` (solo un `use` muerto en `UserController.php:5`), `BasePolicy` (0 Policies en el sistema), middleware `EnsureUserRole` (alias `role` sin uso), `StoreExpenseRequest` (duplicado inline en `ExpenseController::store:53-61`), y ~15 métodos públicos de servicios: `InventoryService::{validateStockAvailability, generateLowStockNotifications, getStockReport, getArticleMovementHistory, getLowStockReport}`, `ReadingService::{calculatePagesConsumed, validateReadingAnomaly, processMultipleReadings}`, `PaymentService::recalculateInvoiceStatus`, `PurchaseService::{updatePendingBalance, generateAccountPayable}`, `ReportService::{getInventoryValue, getLowStockReport, getSupplierReport}`, `ContractService::calculateEstimatedAmount`, `VisitSchedulerService::detectClientsWithoutVisit` (contiene además `whereMonth('>=', now()->month)` — bug latente). Factories `BankAccount/BankMovement/PeriodClose/PeriodValidation` sin uso; `BankAccountFactory.php:28` consulta `User::where('rol','ADMIN')` — columna que ya no existe (factory roto); `User` usa `HasFactory` sin que exista `UserFactory`. Permisos `finanzas.cuentas-por-cobrar` y `sistema.configuracion` definidos en `config/permisos.php:49,62` sin ruta que los requiera. *Fix:* eliminar lo muerto; convertir `generateLowStockNotifications` en comando agendado (de lo contrario las alertas de stock bajo jamás se disparan).

**MEDIO C12 — Seed completo sin gate de entorno.** `DatabaseSeeder.php:11-31` ejecuta incondicionalmente 19 seeders de datos demo + usuarios `password` (`UserSeeder.php:30`, `RolePermissionSeeder.php:46`); el entrypoint hace migrate+seed cuando `RUN_MIGRATIONS=1` (default del compose). *Fix:* gatear por entorno (solo catálogo mínimo + admin en producción), contraseña inicial desde env con fallback aleatorio.

**MEDIO C13 — Duplicación de lógica de dinero.** Subtotal `cantidad × costo_unitario` implementado 3 veces (`DeliveryService.php:50`, `PurchaseService.php:37`, `MaintenanceService.php:99`, con casts inconsistentes); reportes gemelos duplicados entre `ReportService` e `InventoryService` (uno de cada par muerto); noción "pendiente/vencido" en 3 lugares con criterios distintos — `Invoice::scopeOverdue` (`Invoice.php:92-96`) **no** excluye BORRADOR/INCOBRABLE a diferencia de `checkOverdue`. *Fix:* helper único de subtotal; scope `porCobrar()` canónico.

**MEDIO C14 — Cache de permisos como atributo dinámico de modelo Eloquent.** `User.php:90-105`: `$this->permisosCache` no es propiedad declarada → Eloquent la almacena en `$attributes`; funciona como cache, pero cualquier `save()`/`update()` posterior sobre esa instancia intentaría persistir una columna `permisos_cache` inexistente (error latente). *Fix:* declarar `public ?array $permisosCache = null;` (propiedad real) o usar `Attribute` con cache.

### Frontend (medios)

**MEDIO D11 — Selects hardcodeados contra datos inexistentes.** Proveedores/artículos de compras (`PurchaseList.tsx:19-37` — "HP México", "ART-001"…), socios fijos (`InvoiceList.tsx:346-348`, `ReceivablesList.tsx:380-382`, `ReadingListPage.tsx:16-21`), cuentas bancarias fijas (`ReceivablesList.tsx:354-355`, `ReconciliationPage.tsx:75-77`), periodos fijos (reportes y conciliación). Los registros se crean contra valores que no existen en el backend. Los hooks correctos existen (`useSuppliers`, `useArticles`, `useBankAccounts`, `useSocios`) y otras páginas ya los usan. *Fix:* reemplazar por los hooks de catálogo.

**MEDIO D12 — Duplicación sistémica.** `formatCurrency`/`formatDate` duplicados (`lib/formatters.ts:1-42` vs `lib/utils.ts:9-23`, con semánticas distintas); dos sistemas de colores de estado (`formatters.ts:44-103` vs `types/colors.ts` + Badge — los hex claros **no se adaptan al dark mode**); modal de registro de pago triplicado (`InvoiceList:295-366`, `InvoiceDetail:613-668`, `ReceivablesList:297-396`); labels de visita/estado copiados entre `CalendarPage.tsx:30-66` y `VisitDetailPage.tsx:31-63`; manejo de errores a mano pese a existir `parseApiError` (`InvoiceList:63-69`, `ArticleDetail:80,106,405` con solo `console.error`). *Fix:* un solo módulo de formatters/colores; un componente `PaymentModal`; consumir `parseApiError` siempre.

**MEDIO D13 — Código muerto frontend.** Hooks sin consumidores: `useAuditLog.ts`, `useSupplierPayments.ts`, `usePrinterExpenses.ts`. Tipos muertos: `types/typography.ts`, `types/visit-printer.ts` (duplicado de `operations.ts`), `types/period-validation.ts` (duplicado). Componentes solo usados por stories: `RadioGroup`, `DatePicker`, `ProgressBar`. `PaymentList.tsx:23-24,170-192` (modal y "Ver detalle" muertos), `PurchaseDetail.tsx:25-29` (`metodoPagoIcons` sin uso), `ClosePeriodPage.tsx:14-15` (estados siempre null), `lib/utils.ts:25` (`truncate`). `ClosePeriodPage.tsx:259`: `title="Reporte Preliminar - {currentPeriod?.periodo}"` dentro de string literal (se muestra el placeholder tal cual). *Fix:* purga + eslint con no-unused-vars.

**MEDIO D14 — Componentes monolíticos.** `ContractDetail.tsx` (1.617 líneas), `CreateContract.tsx` (880), `InvoiceDetail.tsx` (809), `MaintenanceDetail.tsx` (783), `LinkFieldRecordModal.tsx` (771), `UserListPage.tsx` (764), `VisitDetailPage.tsx` (737), `ConfigPage.tsx` (616). Lógica+UI mezcladas; mantenimiento costoso y re-render difícil de razonar. *Fix:* extraer modales/paneles y compartir mapas de labels.

**MEDIO D15 — React anti-patrón varios.** `Table.tsx:336-338`: `key={rowIndex}` en filas de tabla server-side (estados/transiciones cruzadas al paginar/ordenar) y `render?: (value: any, ...)`; `Dashboard.tsx:131`: `Math.random()` como key; keys por índice en filas editables de formularios (`PurchaseList.tsx:357` — borrar una fila intermedia corrompe las demás, `CreateContract.tsx:388`, `ImportCfdiModal.tsx:150`); `Sidebar.tsx:59-70` useEffect con dependencia faltante (`visibleNavItems`); estado de query copiado a `useState` vía useEffect (`NotificationCenterPage:33-37`, `UserListPage:47-51`) — origen de D7; `NotificationCenterPage.tsx:189-203`: `tipoConfig[notif.tipo]` sin fallback → TypeError si el backend agrega un tipo; ~40 `any` en src; **sin ErrorBoundary** en `main.tsx` (los crashes D1/D2 blanquean toda la SPA). *Fix:* keys estables, derivar de `query.data`, ErrorBoundary raíz, tipar.

### Móvil / infraestructura (medios)

**MEDIO E1 — `fetchAll` con tope silencioso de 10 páginas.** `mobile/src/lib/api.ts:54-73` (`FETCH_ALL_MAX_PAGES=10` × 100 items): catálogos truncados sin aviso en entregas (`DeliveryPage.tsx:50`), historial de lecturas (`PrinterDetailPage.tsx:100`), impresoras/almacenes de instalación/retiro y notificaciones. *Fix:* señalizar el truncado ("mostrando N+") o tope por endpoint.

**MEDIO E2 — 401 en background redirige a login.** `mobile/src/lib/api.ts:20-33`: cualquier 401 (incluidos los del sync en background) hace `window.location.href='/m/login'` → formularios a medio llenar se pierden (la cola IndexedDB sí sobrevive: `sync.ts:43`). *Fix:* no redirigir en requests de sync; dejar el item pendiente con indicador.

**MEDIO E3 — Headers de seguridad ausentes y JS sin comprimir.** `nginx/default.conf.template:1-69`: sin `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP, HSTS; sin `gzip_types` → `frontend/dist/assets/index-*.js` (1.44 MB) viaja sin comprimir (móvil: 328 KB). Red de campo lenta = primera carga penalizada. *Fix:* block de headers + `gzip on; gzip_types application/javascript application/json text/css;`.

**MEDIO E4 — Contraseña de BD con default débil.** `docker-compose.yml:16,95` y `.env.example:11`: `DB_PASSWORD:-secret` como fallback silencioso (accesible vía `127.0.0.1:5432`). *Fix:* abortar arranque en producción sin `DB_PASSWORD` explícita.

**MEDIO E5 — Backups sin cifrar ni offsite.** `deploy/common.sh:33-41`, `deploy/backup-cron.sh:34`: dumps gzip en `/root/backups` del mismo VPS, con hashes de contraseñas y datos de clientes. Compromiso/borrado del VPS = fuga o pérdida total. *Fix:* cifrar (age/gpg) + copia offsite.

**MEDIO E6 — Imágenes sin pin de versión.** `docker-compose.yml:24,33,89,111`: `nginx:alpine` (efectivamente latest), `node:20-alpine`, etc. Un rebuild puede traer una base distinta sin cambio de código. *Fix:* pinear minor/digest en producción.

**MEDIO E7 — IndexedDB sin índices ni versionado.** `mobile/src/lib/db.ts:65-84`: `DB_VERSION=1`, store `sync_queue` sin índices, filtrado en memoria. Hoy inocuo; cualquier schema futuro (backoff, contador de intentos) no tiene camino. *Fix:* índice sobre `estado`/`created_at` + bloques `case` por versión.

---

## 5. Hallazgos bajos

| ID | Ubicación | Problema | Recomendación |
|---|---|---|---|
| BA-1 | `backend/app/Http/Controllers/AuthController.php:29-31,43-62` | Contrato de respuesta distinto entre `login` (modelo crudo sin `permisos`) y `/auth/user` (array manual) | `UserResource` en ambos |
| BA-2 | `VisitController.php:205` vs `InvoiceController.php:132`, `WarehouseController.php:79`, etc. | Códigos/estados HTTP inconsistentes para la misma operación (204+null vs 200+mensaje; 409 vs 422 para conflictos equivalentes) | Convención documentada: POST=201, DELETE=204, validación=422, conflicto=409; reglas de negocio vía `BusinessRuleException` |
| BA-3 | `SupplierPaymentController.php:21`; `FieldRecordController.php:18-20,51,65,105`; `BankAccountController.php:26,54,72-74` | Estilo: FQCN inline, DI duplicada constructor+método, rutas sin model binding; `movements()` filtra `activo=true` e invisibiliza histórico | Limpieza mecánica |
| BA-4 | `PrinterController.php` (`destroy`, `reason`), `AuthController.php:66` (`'CSRF cookie set'`) | Mezcla inglés/español en API y mensajes | Español consistente (D10) |
| BA-5 | `PrinterBrandController.php:24-38` | `store` responde 201 también en upsert de marca existente | Distinguir 200/201 |
| BA-6 | `RoleController.php:96-106` | Permisos inválidos descartados en silencio si config y BD divergen | 422 si `count(ids) != count(claves)` |
| BA-7 | `backend/app/Models/Printer.php:142-150` + `PrinterService.php:112-115` | `esEliminable()` no ve órdenes soft-deleted → `forceDelete` estalla con FK | `withTrashed()->exists()` |
| BA-8 | `backend/app/Services/ReadingService.php:66` | Lectura anómala con contador regresivo igual rebaja `contador_actual` → sobre-reporte posterior | No actualizar hacia abajo |
| BA-9 | `backend/database/seeders/InvoiceSeeder.php:21-61` | Facturas demo con periodos aleatorios que violan D20 (solapes que el runtime prohíbe) | Generar ciclos sin solape o marcar `DEMO` |
| BA-10 | `backend/app/Services/ReportService.php:41-67` | Agregaciones en memoria (todas las órdenes cargadas) vs SQL del propio `getProblematicPrinters` | `groupByRaw` como en `CashFlowService` |
| BA-11 | Repo raíz | `redprint.tar.gz` (899 KB, 765 entradas) commiteado; `frontend/tsconfig.*.tsbuildinfo`, `frontend/test-opencode.txt`, `frontend/vite.config.js/.d.ts` (ver D10) en git; `prototipoMovile/` (25 archivos) e `ideas/` como carpetas de proyecto | `git rm` + `.gitignore` (`*.tar.gz`, `*.tsbuildinfo`) |
| BA-12 | `.gitignore` | Referencia a `/frontend-new/` (directorio abortado inexistente); faltan `mobile/node_modules`, `mobile/dist` | Limpiar gitignore |
| BA-13 | `docker-compose.yml:97,115`, `setup.sh:41`, `.env.example:6` vs `deploy/DEPLOY.md:12-34` | Drift documental Caddy vs Traefik (el proxy real es Traefik/Dokploy) | Sincronizar comentarios/docs |
| BA-14 | `INICIAR-FRONTS.md`, `setup.sh:23-26`, `setup.ps1:23-33` | Documentan `npm run dev`/npm en host (contradice AGENTS.md) con ruta absoluta de máquina personal; `$LASTEXITCODE` frágil | Consolidar guías de arranque; delegar build al compose |
| BA-15 | `PROJECT.md` §10 | Dice "no hay scheduler para facturas vencidas" pero `routes/console.php` **sí** agenda `invoices:check-overdue` a las 02:30 | Actualizar el doc (gana el código) |
| BA-16 | Frontend varios | Tildes/ortografía inconsistentes ("Conciliacion", "Informacion", "Emitelo", "Estas seguro"…); accesibilidad: labels sin `htmlFor`, botones de icono sin `aria-label`, filas clickeables sin teclado | Pasada de ortografía + a11y básica |
| BA-17 | `frontend/tailwind.config.js:4-9,75-91` | `content` con globs de plantilla shadcn inexistentes (`./pages`, `./app`); keyframes accordion sin uso | Ajustar a `src/` |
| BA-18 | `frontend/index.html:5`; `Header.tsx:70-78`; `ReceivablesList.tsx:24-29,398-422` | Favicon con MIME equivocado; búsqueda decorativa sin handler; ramas duplicadas en `getDiasVencidosLabel` y modal "Historial de Pagos" sin pagos | Limpieza menor |

---

## 6. Sugerencias generales

### Arquitectura

1. **Extender el patrón de concurrencia ya probado a toda escritura de dinero.** El checklist obligatorio para todo endpoint validate-then-write debe ser: guard externo → re-fetch `lockForUpdate` → re-validación dentro de `DB::transaction` → captura de `UniqueConstraintViolationException` → `BusinessRuleException` 422. Hoy ese patrón vive en `InvoiceService::emitir`/`CfdiService`/`FieldRecordService` pero falta en `PaymentService`, `MaintenanceService::complete/cancel`, `PurchaseService::registerSupplierPayment` y `ContractService::assignPrinter`. Además: ningún `->update()` de estado/stock/saldo fuera de la capa de servicios (`VisitController:204` lo viola).
2. **Duplicar el success del módulo de facturación en el módulo banco/cierre.** Conciliación, cuentas y periodo son la zona más débil (A1, C6, B18, B19): necesitan services + FormRequests + Resources + feature tests, igual que sus hermanos nuevos.
3. **Introducir Policies para ownership** (notificaciones, registros por usuario) y un **observer de auditoría** que llene `audit_logs` en entidades de dinero: la bitácora anunciada tiene hoy un solo escritor.
4. **Contrato de API verificable para el móvil**: generar tipos desde OpenAPI o validar schema en tests de contrato (`mobile/src/types/api.ts` es una copia manual que deriva en silencio).

### Mantenibilidad

5. **Arreglar el toolchain antes que nada**: `tsc --noEmit` en el build del frontend (el móvil ya lo hace), eslint instalado y configurado, y CI (GH Actions: tests backend + lint/build de los tres paquetes). Los dos crashes críticos del frontend y el SQL roto de conciliación habrían sido atrapados por un pipeline mínimo.
6. **Purga coordinada de código muerto** (listas completas en C11 y D13) y de duplicados (formatters, colores, modales de pago, labels). Regla de oro del repo: lo que no se usa se borra; los mocks se marcan o se eliminan.
7. **Descomponer los 8 componentes de 600–1.600 líneas** y unificar el manejo de errores en `parseApiError`.
8. **Convención de respuesta JSON** única (Resource + paginación Laravel; 201/204/422/409) y validación siempre vía FormRequest con `Update*Request` separados.

### Rendimiento

9. **Resolver el N+1 estructural** (C4) memoizando accessores o moviendo los cálculos a los listados con `withSum`/agregación; añadir los índices de FK faltantes (C7) antes de que el histórico crezca.
10. **Ids de idempotencia en toda la cola offline** (lecturas ya; entregas si se offlinean después) y gzip en nginx (E3): 1.44 MB → ~350 KB por primera carga.

### Seguridad

11. **Endurecimiento barato y de alto retorno**: rate limiting en login, headers de seguridad, `APP_DEBUG=false` forzado en producción, regeneración de sesión, CSRF reactivado, `trustProxies` explícito, contraseñas temporales fuertes con rotación obligatoria, secretos obligatorios en arranque productivo.
12. **Migrar evidencia fotográfica** de base64-en-TEXT a almacenamiento de archivos con tamaño validado, y cifrar backups + copia offsite.

### Tests

13. **Prioridad de cobertura** (dinero > acceso > offline): `PaymentService` (pagos parciales/concurrentes), `SupplierPaymentController`, `ReconciliationController` (caracterización del fix A1), `AuthController` (throttle/CSRF/logout), `sync.ts` con fake-indexeddb, y el umbral de anomalía de `CaptureReadingPage`.

---

## 7. Plan de acción sugerido (ordenado por riesgo)

| # | Acción | Hallazgos que cierra | Esfuerzo |
|---|---|---|---|
| 1 | Fix `DATE_FORMAT` → Postgres + test de caracterización | A1 | XS |
| 2 | `lockForUpdate` en pagos (facturas y proveedores) + validación monto ≤ saldo + CHECK constraint | A2, C2 | S |
| 3 | Import de `useState`/`Input` + `tsc --noEmit` en build frontend | D1, D2 | XS |
| 4 | Conectar "Registrar Cobro" (y revisar botones muertos de dinero) | D3, D5 | S |
| 5 | `client_uuid` en lecturas + unique `(visita_id, impresora_id)` | A3, C8 | M |
| 6 | CI mínima (tests + lint + build) + eslint real | F1, D9 | S |
| 7 | Rate limiting login + session regenerate + password reset fuerte + APP_DEBUG | B1, B2, B4 | S |
| 8 | Re-fetch con lock en `MaintenanceService::complete/cancel` + transacción en `assignPrinter` | C1, C3 | S |
| 9 | `conciliacion_status` en cierre de periodo + `PeriodService` + tests | C6, B18 | M |
| 10 | IDOR notificaciones + dashboard por bloques de permiso | B3, B5 | S |
| 11 | `->only()/->except()` en apiResources con métodos ausentes | C5 | XS |
| 12 | Backoff en sync móvil + tope de fotos + post_max_size alineado | F3, B8 | M |
| 13 | Tests de pagos/auth/compras + sync.ts | F2 | M |
| 14 | Índices FK + memoización de appends | C7, C4 | M |
| 15 | Purga de código muerto y deps + convención de respuestas + mocks fuera | C11, D9, D13, D8 | M |
| 16 | Endurecimiento nginx (headers, gzip, rate limit) + backups cifrados + pins de imagen | E3, E5, E6 | S |

---

*Auditado con lectura completa de los servicios, controladores, páginas y componentes; cada hallazgo crítico y alto fue verificado contra el código fuente en el momento de la auditoría. Hallazgos positivos destacables: parser CFDI endurecido contra XXE; traits `Sortable`/`Searchable` con whitelist y escape de comodines; `deploy/update.sh` ejemplar (lock, ff-only, trap ERR, health check); tests backend con guard de BD; auth móvil por cookie httpOnly sin tokens en localStorage.*
