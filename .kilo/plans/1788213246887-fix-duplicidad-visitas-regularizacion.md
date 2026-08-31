# Fix: duplicidad de visitas al regularizar registros de campo

## Problema (evidencia)

`FieldRecordService::link()` (`backend/app/Services/FieldRecordService.php:75-86`) **siempre crea una visita nueva** (`origen=CAMPO`, fecha `capturado_en`), aunque ya exista una visita PENDIENTE programada (generada por el scheduler o por la creación del contrato) del mismo contrato ese mismo día. Resultado: 2 visitas LECTURA el mismo día — una COMPLETADA (CAMPO) y la programada que queda PENDIENTE huérfana.

El scheduler **no** necesita cambios: su guarda anticopia (`VisitSchedulerService.php:137-151`) ya bloquea crear visitas en fechas con visita no-CANCELADA existente, y con la reutilización el slot queda consumido de forma natural (el siguiente ciclo se genera al día siguiente con la fecha correcta).

## Decisiones acordadas

1. **Reutilización automática** (server-side, sin decisión extra del admin): si existe visita PENDIENTE coincidente, se reutiliza; si no, se crea la visita CAMPO como hoy.
2. **Coincidencia por fecha exacta**: `fecha_programada == capturado_en->toDateString()`.
3. **Alcance**: registros tipo LECTURA y ENTREGA_INSUMOS reutilizan. Los OTRO siempre crean visita nueva (el admin eligió explícitamente tipo + motivo).

## Cambios

### 1. Backend — `backend/app/Services/FieldRecordService.php`

En `link()`, dentro de la transacción, antes del `Visit::create` actual:

- Nuevo método privado `findReusableVisit(Contract $contract, FieldRecord $record): ?Visit`:
  - Retorna `null` si `$record->tipo` es OTRO.
  - Query: `contrato_id = contract.id`, `cliente_id = contract.cliente_id`, `estado = PENDIENTE`, fecha igual a `capturado_en->toDateString()` (columna DATE), orden preferente `tipo_visita = 'LECTURA'` y luego `id` asc, con `lockForUpdate()`.
- Si hay candidata:
  - Actualizar `socio_id` al socio del registro (quien realmente asistió) y **appendear** a `notas`: `"Regularizada desde registro de campo #{$record->id}"` (conservar notas previas; si el registro trae notas propias, incluirlas).
  - Mantener intactos `tipo_visita`, `origen` (null = programada), `fecha_programada`, `creado_por`.
- Si no hay candidata: flujo actual (crear visita CAMPO).
- El resto del flujo no cambia: lectura/entregas usan el `visit->id` (reutilizada o nueva), cierre con `visitService->complete($visit, 'Regularizado desde registro de campo #'.$record->id)` y `field_records.visita_id` apunta a la visita usada.

### 2. Tests — `backend/tests/Feature/FieldRecordTest.php`

1. `test_link_reutiliza_visita_pendiente_de_la_misma_fecha`: contrato + PENDIENTE LECTURA fechada `capturado_en` (socio distinto) + registro LECTURA → `assertDatabaseCount('visits', 1)`; la visita queda COMPLETADA con el id de la programada; lectura con `visita_id` correcto; `socio_id` = socio del registro; notas contienen el marcador; `field_records.visita_id` = id programada.
2. `test_link_crea_visita_cuando_la_pendiente_es_de_otra_fecha`: PENDIENTE con fecha distinta → 2 visitas (la programada queda PENDIENTE, la nueva CAMPO COMPLETADA).
3. `test_link_entrega_reutiliza_visita_pendiente`: registro ENTREGA_INSUMOS + PENDIENTE LECTURA misma fecha → 1 visita; deliveries y salidas de stock sobre esa visita.
4. `test_link_otro_no_reutiliza_visita_pendiente`: registro OTRO + PENDIENTE LECTURA misma fecha → 2 visitas; la nueva con el tipo elegido y `origen = CAMPO`.
5. (opcional) preferencia LECTURA si hay dos PENDIENTES el mismo día (LECTURA + INSTALACION).

Los tests existentes usan `Contract::create` directo (sin scheduler) → siguen pasando por la rama de creación sin cambios.

### 3. Frontend — `frontend/src/components/fieldrecords/LinkFieldRecordModal.tsx`

- El callback `onSuccess` de `linkMutation.mutate` ya recibe el `FieldRecord` de respuesta (incluye `visit` cargada, con `origen`): diferenciar el mensaje — `visit.origen === 'CAMPO'` → "…se creó la visita de campo #Y"; si no → "…se vinculó a la visita programada #Y". La prop `onSuccess(mensaje)` hacia `FieldRecordsPage` no cambia de firma.
- Paso 3 (confirmación): ajustar el copy "Se creará una visita de campo del …" → "Se registrará en la visita del {fecha}: si existe una visita programada para ese día se usará; de lo contrario se creará una visita de campo." (Sin endpoint de preview.)

### 4. Documentación — `PROJECT.md`

- §5 fila FieldRecord: la regularización reutiliza la visita programada del mismo contrato/fecha si existe; si no, crea una CAMPO ya completada.
- §6 Visita (excepción de autocierre): matizar la reutilización.
- D15: añadir la regla fecha-exacta (LECTURA/ENTREGA reutilizan; OTRO no).

## Fuera de alcance (explícito)

- **Sin cambios en `VisitSchedulerService`** (análisis arriba).
- **Sin índice único parcial en visits**: dos PENDIENTES del mismo contrato el mismo día pueden ser legítimas (visitas manuales); la carrera teórica con el cron (02:00) se acepta y documenta.
- **Dos registros el mismo día**: el primero reutiliza la pendiente; el segundo crea visita nueva (las COMPLETADAS son inmutables, invariante §6). Aceptado.
- **Limpieza del duplicado ya existente en la BD de prueba**: manual (cerrar la PENDIENTE con motivo o marcarla OMITIDA desde la UI de visitas). No hay backfill.
- Mobile (`/m/`): sin cambios (la captura no crea visitas).

## Validación

1. `docker compose exec app php artisan test` — suite completa; deben pasar los tests nuevos y los existentes.
2. Verificación manual end-to-end: contrato con visita programada HOY → capturar registro en `/m/` → regularizar en web → debe quedar **1 visita COMPLETADA** con la lectura; al día siguiente el cron genera el siguiente ciclo con fecha correcta.
3. Rebuild del front (requerido para ver el cambio del modal):
   `docker compose run --rm --no-deps frontend sh -c "npm run build"` + hard refresh (`Ctrl+F5`) en `http://localhost:8080`.
4. Backend es volumen montado: no requiere rebuild ni `config:cache` (no cambian config/rutas).
