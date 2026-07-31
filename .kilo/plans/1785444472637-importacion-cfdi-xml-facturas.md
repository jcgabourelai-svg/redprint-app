# Plan: Importación de facturas desde CFDI XML (conciliación bidireccional)

> Entorno: TODO corre en Docker (puerto 8080). Stack: Laravel 11 / PHP 8.2 / PostgreSQL / React 18 + Vite.
> Modelo interno de "factura" = `Invoice` (tabla `invoices`), fuertemente acoplado a renta de impresoras (lecturas/periodos). NO existe ningún manejo XML/CFDI/SAT hoy.

## Objetivo
Permitir importar facturas reales emitidas en un PAC externo mediante su XML (CFDI), almacenarlas como entidad fiscal independiente (`XmlComprobante`), conciliarlas con las facturas del sistema en ambos sentidos, y soportar futuros egresos.

## Decisiones de diseño (confirmadas con el usuario)
1. **Alcance v1 = conciliación bidireccional completa:**
   - (A) Importar XML → crear `XmlComprobante`.
   - (B) Generar una `Invoice` desde un XML de **ingreso**.
   - (C) Vincular/desvincular un XML a una `Invoice` ya registrada manualmente.
2. **Cliente desconocido:** si el RFC del Receptor no coincide con ningún `Client`, el `XmlComprobante` queda **sin asignar** (bandeja de pendientes). El usuario lo resuelve a mano (asignar cliente existente o crear uno). No se crean clientes automáticamente.
3. **Carga múltiple + parser CFDI 4.0 y 3.3** (detección automática por namespace).
4. **Almacenamiento del XML crudo:** columna `contenido_xml` (longText) en la propia tabla. **No** se introduce subsystema de archivos (no existe `config/filesystems.php` ni uploads hoy). Es la fuente de verdad fiscal para auditoría.
5. **Entidad preparada para egreso:** `tipo_comprobante` (`I`/`E`/...) se guarda, pero el flujo de egreso (proveedores/compras) queda **fuera de v1** (ver "Fuera de alcance").
6. **Idempotencia:** reimportar el mismo XML no falla; se reconoce por `uuid` único y se devuelve "duplicado".
7. **Auto-conciliación al importar:** (a) match receptor por RFC → `receptor_id`; (b) match `Invoice` por `numero_factura` = Serie-Folio → enlaza automáticamente si existe.
8. **Nuevo permiso** `finanzas.cfdi` (etiqueta "Comprobantes CFDI (XML)").

---

## Modelo de datos

### Migración 1 — `0001_01_01_000036_create_xml_comprobantes_table.php`
(continúa la secuencia pinned del proyecto; al final siembra el permiso `finanzas.cfdi` de forma idempotente, como hace `000032`).

Tabla `xml_comprobantes`:
```
id
uuid                string  UNIQUE          -- Comprobante@UUID (folio fiscal)
version             string                  -- '4.0' | '3.3'
serie               string  nullable        -- @Serie
folio               string  nullable        -- @Folio
serie_folio         string  nullable  INDEX -- Serie-Folio normalizado para match/display
tipo_comprobante    string  INDEX           -- enum TipoComprobante (@TipoDeComprobante)
fecha_emision       datetime
moneda              string  nullable        -- @Moneda (MXN...)
tipo_cambio         decimal(12,4) nullable  -- @TipoCambio
forma_pago          string  nullable        -- @FormaPago
metodo_pago         string  nullable        -- @MetodoPago (PUE/PPD)
lugar_expedicion    string  nullable        -- @LugarExpedicion
condiciones_de_pago string  nullable        -- @CondicionesDePago
confirmacion        string  nullable        -- @Confirmacion
-- Emisor (tu empresa en ingresos)
rfc_emisor              string
nombre_emisor           string  nullable
regimen_fiscal_emisor   string  nullable
-- Receptor (tu cliente en ingresos)
rfc_receptor            string  INDEX
nombre_receptor         string  nullable
uso_cfdi                string  nullable    -- Receptor@UsoCFDI
regimen_fiscal_receptor string  nullable    -- 4.0
domicilio_fiscal_receptor string nullable    -- 4.0
-- Totales
subtotal                    decimal(12,2)
descuento                   decimal(12,2) nullable
total                       decimal(12,2)
total_impuestos_trasladados decimal(12,2) nullable
total_impuestos_retenidos   decimal(12,2) nullable
iva_trasladado              decimal(12,2) nullable   -- impuesto 002 traslado
iva_retenido                decimal(12,2) nullable
-- Meta
contenido_xml   longText     nullable        -- XML crudo (auditoría)
estado_sat      string  nullable             -- reservado (Vigente/Cancelado); NO se verifica en v1
notas           text    nullable
receptor_id     foreignId nullable -> clients  nullOnDelete   -- cliente resuelto por RFC
creado_por      foreignId -> users
fecha_creacion  timestamp nullable
timestamps
-- index: unique(uuid), index(rfc_receptor, tipo_comprobante, serie_folio, receptor_id)
```

### Migración 2 — `0001_01_01_000037_create_xml_conceptos_table.php`
Tabla `xml_conceptos`:
```
id
xml_comprobante_id  foreignId -> xml_comprobantes cascadeOnDelete
clave_prod_serv     string  nullable    -- @ClaveProdServ
no_identificacion   string  nullable
cantidad            decimal(12,4)
clave_unidad        string  nullable    -- @ClaveUnidad
unidad              string  nullable
descripcion         text
valor_unitario      decimal(12,2) nullable  -- 4.0 opcional
importe             decimal(12,2)
descuento           decimal(12,2) nullable
objeto_imp          string  nullable    -- 4.0 @ObjetoImp
timestamps
```

### Migración 3 — `0001_01_01_000038_add_xml_comprobante_id_to_invoices_table.php`
```
$table->foreignId('xml_comprobante_id')->nullable()
      ->constrained('xml_comprobantes')->nullOnDelete()->after('comprobante');
```
(La FK vive en `invoices`; relación 1:1 opcional. Para egreso v2 se añadirá `purchases.xml_comprobante_id`.)

---

## Backend — tareas ordenadas

### B1. Enum `app/Enums/TipoComprobante.php`
Backed string enum, `INGRESO='I'`, `EGRESO='E'`, `TRASLADO='T'`, `NOMINA='N'`, `PAGO='P'`.

### B2. Modelos
- `app/Models/XmlComprobante.php`: `$table='xml_comprobantes'`; `$fillable` (todas las columnas excepto id/timestamps); `casts()` método (fechas, money `decimal:2`, `fecha_emision` datetime, `tipo_comprobante` => `TipoComprobante::class`); `use Searchable;`; relaciones `conceptos()` (HasMany `XmlConcepto`, FK `xml_comprobante_id`), `invoice()` (hasOne `Invoice`, FK `xml_comprobante_id`) — inversa del enlace, `receptor()` (BelongsTo `Client`, `receptor_id`), `creator()` (BelongsTo `User`, `creado_por`); `$appends = ['estado_conciliacion','estado_cliente']` con accessores: `estado_conciliacion` = `invoice` cargada? 'conciliado' : 'sin_factura'; `estado_cliente` = `receptor_id`? 'asignado':'sin_cliente'; scopes `scopeSinFactura` (`whereDoesntHave('invoice')`), `scopeSinCliente` (`whereNull('receptor_id')`).
- `app/Models/XmlConcepto.php`: `$table='xml_conceptos'`; fillable + casts money; relación `comprobante()` BelongsTo.
- `app/Models/Invoice.php`: añadir relación `xmlComprobante()` (BelongsTo, `xml_comprobante_id`) y `'xml_comprobante_id'` al `$fillable`.

### B3. Parser `app/Services/Cfdi/CfdiParser.php`
- `parse(string $xmlContent): array` → devuelve array normalizado (todos los campos del encabezado + `conceptos[]`).
- Detección de versión por namespace root: v4.0 `http://www.sat.gob.mx/cfd/4`, v3.3 `http://www.sat.gob.mx/cfd/3`.
- Usar `SimpleXMLElement`; acceder con namespaces vía `->children($ns)`. **Hardening XXE:** `libxml_use_internal_errors(true)`; **NO** usar `LIBXML_NOENT`; `simplexml_load_string($c, null, LIBXML_NOCDATA)`.
- Extraer: `Comprobante` (Version/Serie/Folio/Fecha/TipoDeComprobante/Moneda/TipoCambio/FormaPago/MetodoPago/SubTotal/Descuento/Total/LugarExpedicion/CondicionesDePago/Confirmacion/UUID); `Emisor` (Rfc/Nombre/RegimenFiscal); `Receptor` (Rfc/Nombre/UsoCFDI/DomicilioFiscalReceptor/RegimenFiscalReceptor); `Impuestos` (Traslados/Retenciones, sumar impuesto `002`=IVA); `Conceptos/Concepto[]`.
- Lanzar `App\Exceptions\BusinessRuleException` (ya renderiza 422) si no es un CFDI válido (sin root/UUID/TipoDeComprobante) o el XML está malformado.

### B4. Servicio `app/Services/CfdiService.php`
Inyección por constructor (`CfdiParser`). Todo multi-escritura en `DB::transaction`. Reglas de negocio → `BusinessRuleException`.
- `importFiles(array $uploadedFiles, User $user): array` — recorre cada `UploadedFile`; parsea; si `uuid` ya existe → resultado `'duplicado'` (no error); si no, crea `XmlComprobante` + `conceptos`, guarda `contenido_xml`, hace **auto-match receptor** por RFC (`Client::where('rfc', $rfcReceptor)->first()`) y **auto-match invoice** por `numero_factura = serie_folio` (si existe y sin enlace previo, enlaza). Devuelve `[['archivo','estado','xml_comprobante'|null,'errores'|null]]`.
- `create(array $parsed, User $user): XmlComprobante`.
- `generateInvoice(XmlComprobante $cfdi, User $user, array $overrides = []): Invoice` — solo si `tipo_comprobante === INGRESO` (si no, `BusinessRuleException`). Construye datos de `Invoice`: `numero_factura` = `serie_folio` normalizado (o, si vacío, `'UUID-'.substr(uuid,0,8)`); `cliente_id` = `receptor_id` (requerido: si `sin_cliente`, lanzar excepción pidiendo asignar cliente primero); `fecha_emision` = `cfdi->fecha_emision`; `fecha_vencimiento` = override o `fecha_emision`; `monto_total` = `total`; `monto_pagado`=0; `saldo_pendiente`=`total`; `estado`='PENDIENTE'; `contrato_id`=null; `periodo_inicio/fin`=null; `notas` auto ("Generada desde CFDI {uuid}"); `socio_id`/`creado_por`=`$user`. Valida `numero_factura` unique; si existe, `BusinessRuleException` sugiriendo "Vincular" en vez de crear. Crea `Invoice` y fija `xml_comprobante_id`.
- `linkToInvoice(XmlComprobante $cfdi, int $invoiceId): Invoice` — valida que la `Invoice` no tenga ya otro `xml_comprobante_id`; valida que el CFDI sea ingreso; fija `invoice->xml_comprobante_id = $cfdi->id`.
- `unlink(XmlComprobante $cfdi): void` — `Invoice` con ese xml → `xml_comprobante_id = null`.
- `assignClient(XmlComprobante $cfdi, ?int $clientId, ?string $notas): XmlComprobante`.
- `delete(XmlComprobante $cfdi): void` — **bloquear** si está enlazado a una factura (BusinessRuleException "desvincula primero"); si no, borra (cascade conceptos).

### B5. Controller `app/Http/Controllers/CfdiController.php`
`use Sortable;`; inyección `CfdiService`. Endpoints:
- `index(Request)` — eager `receptor`,`invoice`; filtros `tipo_comprobante`, `receptor_id`, `estado_conciliacion` (scope), `estado_cliente` (scope); `->search($q,['uuid','serie_folio','rfc_receptor','nombre_receptor'])`; `applySorting(...)`; `->paginate(per_page ?? 15)`; `XmlComprobanteResource::collection`.
- `show(XmlComprobante $cfdi)` — load `conceptos`,`invoice.client`,`receptor`; resource.
- `import(ImportCfdiRequest)` — `$files = $request->file('archivos')`; devuelve `200 { resultados: [...] }`.
- `generateInvoice(Request, XmlComprobante $cfdi)` — valida `fecha_vencimiento?`/`notas?` inline; `$service->generateInvoice($cfdi, $user, $validated)`; `201` con `InvoiceResource`.
- `link(Request, XmlComprobante $cfdi)` — valida `invoice_id` exists; `linkToInvoice`.
- `unlink(XmlComprobante $cfdi)` — `unlink`.
- `update(Request, XmlComprobante $cfdi)` — valida `cliente_id`(nullable exists)/`notas`; `assignClient`.
- `destroy(XmlComprobante $cfdi)` — `delete`.

### B6. Form Requests
- `app/Http/Requests/ImportCfdiRequest.php`: `authorize()=>true`; `archivos=>'required|array'`, `archivos.*=>'file|mimes:xml|max:2048'`; `messages()` en español.

### B7. Resources
- `app/Http/Resources/XmlComprobanteResource.php` — expone todos los campos (fechas `?->toDateString()` / `fecha_emision` con hora, enums `?->value`), `conceptos` (XmlConceptoResource whenLoaded), `invoice` (InvoiceResource whenLoaded), `receptor` (ClientResource whenLoaded), y los accessors `estado_conciliacion`/`estado_cliente`.
- `app/Http/Resources/XmlConceptoResource.php`.
- `app/Http/Resources/InvoiceResource.php` — añadir `xml_comprobante_id` y `xml_comprobante` (resource whenLoaded) para que el listado de facturas muestre conciliación.

### B8. Rutas (`routes/api.php`, dentro del bloque Finanzas)
```php
Route::middleware('permission:finanzas.cfdi')->group(function () {
    Route::post('cfdi/import',   [CfdiController::class, 'import']);
    Route::post('cfdi/{cfdi}/factura',  [CfdiController::class, 'generateInvoice']);
    Route::post('cfdi/{cfdi}/vincular', [CfdiController::class, 'link']);
    Route::delete('cfdi/{cfdi}/vincular',[CfdiController::class, 'unlink']);
    Route::patch('cfdi/{cfdi}', [CfdiController::class, 'update']);
    Route::apiResource('cfdi', CfdiController::class)->only(['index','show','destroy']);
});
```
Importar el controlador en el `use` superior.

### B9. Permiso
- Añadir a `config/permisos.php` → módulo `finanzas`: `['clave'=>'finanzas.cfdi','etiqueta'=>'Comprobantes CFDI (XML)']`.
- En la **migración 000036** (después de crear tablas) insertar idempotente el permiso (`Permission::firstOrCreate(['clave'=>'finanzas.cfdi'], [...])`) y asociarlo a roles `administrador` y `operador` (igual que `000032`), para que el entrypoint `up -d` lo deje operativo sin seed manual.
- Tras editar `config/permisos.php`: `docker compose exec app php artisan config:cache`.

---

## Frontend — tareas ordenadas

### F1. Tipos `frontend/src/types/cfdi.ts`
`XmlComprobante`, `XmlConcepto`, `CfdiImportResultItem` (`{archivo, estado:'importado'|'duplicado'|'error', xml_comprobante?, errores?}`).

### F2. Enums `frontend/src/types/enums.ts`
Añadir `TipoComprobante` (`'I'|'E'|'T'|'N'|'P'`) y `EstadoConciliacion` (`'conciliado'|'sin_factura'`), `EstadoCliente` (`'asignado'|'sin_cliente'`). Etiquetas en español (mapa label) para la UI.

### F3. Hook `frontend/src/hooks/useCfdi.ts`
react-query (claves `['cfdi', params]`, `['cfdi', id]`):
- `useCfdi(params)` — GET `/cfdi`.
- `useCfdiDetail(id)` — GET `/cfdi/{id}`.
- `useImportCfdi()` — **multipart**: construye `FormData`, append cada archivo como `archivos[]`; **override del header** (ver F-nota). Invalida `['cfdi']` y `['invoices']`.
- `useGenerateInvoiceFromCfdi()`, `useLinkCfdi()`, `useUnlinkCfdi()`, `useAssignCfdiClient()`, `useDeleteCfdi()` — invalidan `['cfdi']` y `['invoices']`.

**F-nota (gotcha de upload):** `frontend/src/lib/api.ts` fija `Content-Type: application/json` por defecto. Para `FormData`, enviar `headers: { 'Content-Type': 'multipart/form-data' }` en la llamada (el navegador rellena el boundary) o, mejor, una utilidad `apiUpload()` que elimine el header json para esa petición. Documentarlo en el hook.

### F4. Página `frontend/src/pages/finance/cfdi/CfdiListPage.tsx`
- `useServerTable<XmlComprobante>({ queryKey:['cfdi'], fetcher:(p)=>api.get('/cfdi',{params:p}).then(r=>r.data), defaultSort:{column:'fecha_emision',dir:'desc'} })`.
- Envuelta en `<PageLayout title="Finanzas" showSearch>`.
- **KPI Cards** (grid 4): Total importados, Conciliados (con factura), Sin factura (pendientes), Sin cliente.
- **Filtros:** `<Select>` tipo (I/E/Todos), estado conciliación, estado cliente.
- **Tabla** columnas: Fecha, UUID (truncado), Serie-Folio, Tipo (badge I/E), Receptor (RFC + nombre), Total (MXN), Cliente (badge asignado/sin cliente), Estado (badge conciliado/sin factura), Acciones.
- **Botón "Importar XML"** → abre `ImportCfdiModal`.
- **Acciones por fila:** Ver detalle (modal/drawer con conceptos + datos fiscales), Generar factura (solo ingreso + cliente asignado; confirmación), Vincular a factura (modal selector de `Invoice`), Asignar cliente (modal selector de `Client`), Desvincular, Eliminar.
- Feedback con patrón existente: `useState` + `<Toast>` (igual que `InvoiceList.tsx:35`).
- Errores vía `parseApiError(err)` de `@/lib/api-errors`.

### F5. Componentes `frontend/src/components/cfdi/`
- `ImportCfdiModal.tsx` — `<input type="file" multiple accept=".xml">` (o drag-drop sencillo con `<input>`); lista de archivos; al confirmar `useImportCfdi`; tabla de resultados (por archivo: estado badge + mensaje). Mantiene el patrón `useState` + validación manual (NO react-hook-form; está declarado pero sin usar en el repo).
- `CfdiDetailDrawer.tsx` (o `Modal` `lg`) — muestra encabezado fiscal, totales, conceptos, conciliación, cliente.
- `LinkInvoiceModal.tsx` — selector/buscador de `Invoice` por `numero_factura` o cliente.
- `AssignClientModal.tsx` — selector de `Client` por RFC/razón social.

### F6. Integración con listado de facturas (opcional pero recomendada, mínima)
- En `frontend/src/pages/finance/invoices/InvoiceList.tsx` añadir columna/badge "CFDI" (conciliado ↔ sin XML) usando `xml_comprobante_id`/`xml_comprobante` que ahora expone `InvoiceResource`.

### F7. Navegación y rutas
- `frontend/src/config/nav.ts` → añadir hijo en bloque `finanzas` (tras `facturas`): `{ id:'cfdi', label:'Comprobantes CFDI', icon: FileText/FileCheck (lucide), path:'/finanzas/cfdi', permiso:'finanzas.cfdi' }`.
- `frontend/src/App.tsx` → import estático + `<Route path="finanzas/cfdi" element={<RequirePermission permiso="finanzas.cfdi"><CfdiListPage/></RequirePermission>} />` (junto al bloque finanzas ~línea 71-81).
- `frontend/src/types/admin.ts` → si `PermisosCatalogo` lista claves explícitas, añadir `'finanzas.cfdi'`.

---

## Validación

### Backend
1. `docker compose exec app php artisan migrate` (crea las 3 migraciones + siembra permiso).
2. `docker compose exec app php artisan config:cache`.
3. **Tests** `tests/Feature/CfdiImportTest.php`: fixture `tests/Fixtures/cfdi_ingreso_4.0.xml` y `_3.3.xml`. Casos: parse correcto; import idempotente (doble import = duplicado); auto-match por RFC; auto-enlace por serie-folio; `generateInvoice` crea `Invoice` con `xml_comprobante_id`; `generateInvoice` requiere cliente asignado; `link`/`unlink`; `delete` bloqueado si enlazado; rechazo de XML no-CFDI (422). Ejecutar: `docker compose exec app php artisan test --filter=Cfdi`.
4. `docker compose exec app php artisan test` (regresión completa).

### Frontend + integración
5. Recompilar dist: `docker compose run --rm --no-deps frontend sh -c "npm run build"` (NO usar `rm -rf dist`; el script vacía sin borrar carpeta para no romper el bind mount de nginx).
6. Navegador `http://localhost:8080`, **Ctrl+F5**: verificar menú "Comprobantes CFDI", importar 2-3 XML reales, revisar auto-conciliación, generar factura desde un XML de ingreso, vincular/desvincular a una factura manual, bandeja "sin cliente".

---

## Riesgos / gotchas
- **Upload multipart:** el cliente axios fuerza JSON; resolver el `Content-Type` (F-nota) o el backend no recibirá archivos.
- **XXE en parser:** nunca `LIBXML_NOENT`; PHP 8 + libxml ≥2.9 desactiva entidades externas por defecto, pero confirmar.
- **`numero_factura` único:** al generar desde XML puede chocar con una factura ya existente con el mismo Serie-Folio → el flujo sugiere "Vincular" (no crear duplicado).
- **`fecha_vencimiento` no viene en CFDI:** por defecto = `fecha_emision`; permitir override en el modal de generación.
- **Idempotencia:** clave en `uuid` (unique) para no duplicar al reimportar.
- **`config:cache`** obligatorio tras tocar `config/permisos.php`.
- **No `npm run dev` en host ni puerto 3000/5173.** Todo vía Docker en 8080.
- **Windows/PowerShell** para operaciones de archivos en el host (`Remove-Item`, no `rm`).

---

## Fuera de alcance (v1)
- **Egreso** (CFDI `E` → `Supplier`/`Purchase`): la entidad guarda `tipo_comprobante`, pero el flujo de proveedores se deja para una v2 (añadiendo `purchases.xml_comprobante_id` y match por `rfc_emisor` → suppliers).
- **Verificación de estado SAT** (cancelaciones vía web service del SAT): `estado_sat` queda reservado, no se consulta.
- **Representación PDF del CFDI:** solo se importa el XML.
- **Import por ZIP:** solo multi-archivo suelto.
- **Arreglar la ruta inexistente `/finanzas/facturas/:id`** (`InvoiceList.tsx:128`): anotado; no se incluye en este plan.

## Open questions (no bloqueantes)
- ¿Mostrar badge "CFDI" en el listado de facturas existente? → Recomendado sí (F6, mínimo). El agente implementador puede dejarlo como tarea opcional si acorta el alcance.
