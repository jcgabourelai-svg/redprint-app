# Plan UX: regularización de registros de campo (crear cliente derivado + contrato precargado)

## Contexto

Un registro de campo capturado en el móvil con cliente fuera de sistema exige hoy salir de la
bandeja `/operaciones/registros-campo`, dar de alta cliente y contrato en otras pantallas y
volver a buscar todo a mano. Además el botón del detalle dice "Vincular a lectura…", que
confunde (sugiere vincular a una lectura existente; la lectura se **crea**, y el destino real
de la vinculación es cliente + contrato).

Este plan es 100% frontend (sin backend, sin móvil). Coherente con D15 (el alta sigue siendo
acción explíciva del admin en la web; no se contradice la decisión de no dar de alta desde el
móvil).

## Decisiones resueltas

1. **Cliente nuevo: modal inline reutilizable, no navegación con prefill.** Se extrae el
   formulario de alta de `ClientList.tsx` a `ClientFormModal` y se abre apilado sobre el
   modal de vinculación, precargado con los datos reportados. El usuario no pierde el contexto
   de la regularización y el cliente queda preseleccionado al crearlo.
2. **Prefill desde el registro:** `razon_social` ← `nombre_cliente_reportado`;
   `direccion_instalacion` ← `direccion_reportada` (si existe);
   `notas` ← `Cliente derivado del registro de campo #N — capturado por {socio_nombre} el {capturado_en}.`
   (nota editable, da trazabilidad).
3. **Contrato: no inline (respeta D15).** Cuando el cliente seleccionado no tiene contratos
   activos, se ofrece link a `/contratos/crear?cliente_id=X` en pestaña nueva; el wizard
   aprende a leer ese param y preseleccionar el cliente.
4. **Refresco de contratos al volver de la pestaña:** la query de contratos del modal de
   vinculación overridea los defaults globales (`refetchOnWindowFocus: false`,
   `staleTime: 5min` en `frontend/src/lib/query-client.ts`) con `staleTime: 0` +
   `refetchOnWindowFocus: true`, para que el select se actualice al regresar el foco tras
   crear el contrato.
5. **Botón del detalle:** "Vincular a {tipo}…" → **"Regularizar…"** (unifica con el botón de
   fila de la tabla; elimina también el absurdo "Vincular a otro…").
6. **Permisos:** los nuevos accesos se condicionan con `useTienePermiso` —
   `clientes` para "+ Crear cliente nuevo…", `contratos` para el link al wizard
   (claves existentes en `backend/config/permisos.php`; sin backend nuevo).

## Cambios

### 1. NUEVO `frontend/src/components/clients/ClientFormModal.tsx`

Extraer el modal "Nuevo Cliente" de `frontend/src/pages/clients/ClientList.tsx:165-267`
(campos: razon_social, rfc, nombre_contacto, telefono, correo, direccion_instalacion, notas;
usa `useCreateClient` + `parseApiError`).

API del componente:

```tsx
interface ClientFormModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string                    // default "Nuevo Cliente"
  initialValues?: Partial<Record<string, string>>
  onCreated?: (client: Client) => void
}
```

- Comportamiento idéntico al actual (estado local useState, error inline, submit con
  `createClient.mutate`).
- Al crear con éxito: reset del form, `onClose` y llamar `onCreated(created)` con el cliente
  devuelto por la mutación (`api.post('/clients')` devuelve el recurso con `id`).
- La invalidación de `['clients']` que ya hace `useCreateClient` refresca el select del modal
  de vinculación (query key `['clients', 'field-record-link']` casará por prefijo).

### 2. `frontend/src/pages/clients/ClientList.tsx`

- Eliminar el modal inline y el estado `newClient`/`createError`; renderizar
  `<ClientFormModal isOpen={showNewClientModal} … />` sin `initialValues`.
- Comportamiento visible idéntico al actual.

### 3. `frontend/src/components/fieldrecords/LinkFieldRecordModal.tsx`

a) **Crear cliente inline (paso 1):**
- Estado `showNewClient` + render de `ClientFormModal` al final del JSX (apila por orden de
  DOM sobre este modal).
- Botón tipo ghost/secundario junto al Select de cliente: "+ Crear cliente nuevo…" visible
  solo si `useTienePermiso('clientes')`.
- `initialValues` derivados del `record` (decisión 2).
- `onCreated`: `setClienteId(String(client.id))` y limpiar `contratoId`/`impresoraContratoId`
  (mismo efecto que seleccionar a mano). El cliente queda seleccionado y aparece el paso de
  contrato.

b) **Camino al contrato (paso 1):**
- Donde hoy dice "El cliente no tiene contratos activos. Crea el contrato antes de vincular."
  (línea ~332): mantener el texto y agregar, si `useTienePermiso('contratos')`, un
  `<Link to={/contratos/crear?cliente_id=${clienteId}} target="_blank">Crear contrato para este cliente…</Link>`.
- Actualizar el copy introductorio del paso 1 (líneas 297-308): explicar que el cliente puede
  crearse aquí mismo ("+ Crear cliente nuevo") y el contrato se abre en pestaña nueva con el
  cliente precargado; al volver a esta ventana el select de contratos se actualiza.

c) **Query de contratos refrescable:**
- En el `useQuery` de contratos (líneas 82-89) agregar `staleTime: 0` y
  `refetchOnWindowFocus: true` (override puntual; el resto de la app no cambia).

### 4. `frontend/src/components/fieldrecords/FieldRecordDetailModal.tsx`

- Línea 163-165: reemplazar `Vincular a {FieldRecordTypeLabels[record.tipo].toLowerCase()}…`
  por `Regularizar…`. Queda sin uso el import de `FieldRecordTypeLabels` si no se usa en otro
  lado del archivo → limpiar import.

### 5. `frontend/src/pages/contracts/CreateContract.tsx`

- Leer `cliente_id` de la URL con `useSearchParams`; usarlo como valor inicial de
  `cliente_id` (`useState(searchParams.get('cliente_id') ?? '')`).
- Asegurar que el cliente precargado aparezca en las opciones del Select:
  - `useClients({ per_page: 100 })` en lugar de `useClients()` (hoy trae solo 15).
  - Si el `cliente_id` inicial no está en la lista (fetch con `useClient(id)` habilitado solo
    si hay param), fusionarlo en `clientOptions`.
- Sin otros cambios al wizard.

## No cambios (explícito)

- Backend: ningún endpoint/permiso nuevo (`POST /clients` ya existe y valida con
  `StoreClientRequest`).
- Móvil: sigue solo capturando (D15).
- Deuda del Select con `per_page: 100` (búsqueda server-side) — fuera de alcance; el problema
  de "no aparece el cliente" se mitiga con la creación inline, no resuelto de raíz.
- No se embebe la creación de contrato en el modal (D15: el contrato parametriza dinero).

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Regresión en el alta desde `/clientes` | `ClientFormModal` es extracción literal; `ClientList` solo cambia el origen del render |
| Modales apilados cierren ambos a la vez | Cada `Modal` tiene overlay propio; el click/escape afecta solo al superior (verificar en prueba manual) |
| Cliente creado inline no aparece en el select | La mutación invalida prefijo `['clients']`; el select usa ese prefijo. Preseleccionar por id devuelto, no por búsqueda |
| Wizard no muestra el cliente precargado | `per_page: 100` + merge del `useClient(id)` |
| Usuario sin permiso `clientes` ve el botón y recibe 403 | Botón condicionado a `useTienePermiso('clientes')`; link de contrato condicionado a `contratos` |

## Validación

1. `docker compose run --rm --no-deps frontend sh -c "npm run lint"` (cero warnings;
   incluye detección de imports sin usar).
2. `docker compose run --rm --no-deps frontend sh -c "npm run build"` (recompila `dist`
   sin borrar la carpeta — D14; deja el cambio visible en `http://localhost:8080` con
   Ctrl+F5).
3. Prueba manual end-to-end en `http://localhost:8080` (admin `admin@redprint.com` /
   `password`):
   - Capturar un registro de campo desde `/m/` con cliente inexistente.
   - Bandeja → fila → detalle: botón dice **"Regularizar…"** y abre el wizard de vinculación.
   - Paso 1: "+ Crear cliente nuevo…" abre el modal precargado (razón social = cliente
     reportado, dirección, nota de trazabilidad #N); guardar → queda preseleccionado.
   - Con cliente nuevo (sin contratos): aparece link "Crear contrato…" que abre
     `/contratos/crear?cliente_id=X` con el cliente ya elegido; crear contrato ACTIVO
     (podemos dejar el wizard con plan sin series, D16); volver a la pestaña de la bandeja →
     el select de contratos ya lo lista (refetch por foco).
   - Completar la vinculación (LECTURA: elegir impresora de contrato o instalar desde
     almacén) → registro VINCULADO e inmutable; verificar en detalle los links a
     cliente/contrato/visita/lectura.
   - Regresión: alta de cliente desde `/clientes` sigue funcionando igual.
