# Plan: Contacto del cliente en el detalle de visita (mobile)

## Objetivo

Portar la mejora UX #1 del prototipo (`prototipoMovile/js/screens/visit-detail.js`) a la app
real (`mobile/`): mostrar el **contacto del cliente** (persona de contacto, teléfono clicable,
correo clicable y dirección con enlace a mapa) en la pantalla de detalle de visita, que es lo
primero que un técnico necesita en campo.

## Hallazgos clave (ya verificados en el código — NO se necesita cambio de backend)

1. `GET /api/v1/visits/{id}` **ya devuelve el cliente completo**: `VisitController::show()`
   (backend/app/Http/Controllers/VisitController.php:47) carga `client`, y `VisitResource`
   (backend/app/Http/Resources/VisitResource.php:27) lo expone como `'client' => $this->whenLoaded('client')`.
2. Al serializarse el modelo crudo, los campos llegan en snake_case (nombres de columna):
   `nombre_contacto`, `telefono`, `correo`, `direccion_instalacion` (más otros que ignoraremos:
   `rfc`, `notas`, `saldo_pendiente`, etc.).
3. El seeder (`backend/database/seeders/ClientSeeder.php`) ya puebla todos los campos de
   contacto → el cambio será visible de inmediato en la demo.
4. El frontend web no consume `visit.client` (solo `invoice.client`), así que el payload actual
   es estable; no lo tocaremos.

## Cambios (solo `mobile/`)

### 1. Tipos — `mobile/src/types/api.ts`

- Agregar interfaz para el cliente embebido (solo los campos que consume la app, siguiendo el
  patrón existente de declarar lo consumido):

```ts
export interface VisitClient {
  id: number
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  correo: string | null
  direccion_instalacion: string | null
}
```

- En `interface Visit` (línea ~83), agregar: `client?: VisitClient`.

### 2. UI — `mobile/src/pages/VisitDetailPage.tsx`

En el `Card` de cabecera (el que muestra fecha/socio/contrato/notas, líneas ~186-210), agregar
después de la fila de contrato un **bloque de contacto** que se renderiza solo si
`visit.client` existe y tiene al menos un dato de contacto:

- Estructura sugerida (separador superior sutil + filas con el mismo estilo
  `text-sm text-gray-600` existente):

```tsx
const client = visit.client
const contacto = client && (client.nombre_contacto || client.telefono || client.correo || client.direccion_instalacion)
```

```tsx
{contacto && (
  <div className="mt-2 border-t border-gray-100 pt-2">
    {client.nombre_contacto && (
      <p className="mt-1 text-sm text-gray-600">👤 {client.nombre_contacto}</p>
    )}
    {client.telefono && (
      <a href={`tel:${telHref(client.telefono)}`} className="mt-1 block text-sm font-medium text-blue-600">
        📱 {client.telefono}
      </a>
    )}
    {client.correo && (
      <a href={`mailto:${client.correo}`} className="mt-1 block text-sm font-medium text-blue-600">
        📧 {client.correo}
      </a>
    )}
    {client.direccion_instalacion && (
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(client.direccion_instalacion)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block text-sm font-medium text-blue-600"
      >
        📍 {client.direccion_instalacion}
      </a>
    )}
  </div>
)}
```

- Helper local mínimo para sanitizar el teléfono (los seeders usan guiones, p. ej. `555-4001`):

```ts
function telHref(tel: string): string {
  return tel.replace(/[^\d+]/g, '')
}
```

Sin comentarios en el código, estilos Tailwind consistentes con la página, enlaces con
`active:` states si se desea (opcional).

## Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Fuente de datos | `visit.client` embebido en `GET /visits/{id}` | Ya existe; evita request extra y permisos del módulo clientes |
| Cambio de backend | Ninguno | El payload ya contiene todo; riesgo cero |
| Ubicación | Bloque dentro del Card de cabecera de `VisitDetailPage` | Equivalente al prototipo; la cabecera ya concentra el contexto |
| Alcance | Solo detalle de visita | Las subpáginas (entrega/instalación/retiro/falla) ya enlazan de vuelta al detalle |
| Mapa | Deep-link a `maps.google.com/?q=` | Abre la app de mapas del teléfono sin dependencias |
| Campos vacíos | Fila omitida; bloque completo oculto si no hay ninguno | Clientes con datos incompletos no deben mostrar huecos |

## Casos borde

- Cliente sin teléfono/correo/dirección (columnas nullable) → no se renderizan filas sueltas.
- `visit.client` ausente (p. ej. respuesta de un endpoint futuro sin la relación) → sin bloque,
  sin error (`client?` opcional en el tipo).
- Teléfono con formato (`555-4001`) → `tel:5554001` vía `telHref`.
- Dirección con caracteres especiales/acentos → `encodeURIComponent` en el enlace de mapa.

## Fuera de alcance (explícito)

- Mostrar contacto en `VisitCard` (listas Hoy/Calendario) o en las subpáginas de acciones.
- Normalizar/adelgazar el `client` embebido en `VisitResource` (optimización de payload).
- Caché offline del contacto (la página ya es online-only).
- Cambios en `prototipoMovile/`.

## Validación

1. Lint + build (lo que valida CI):
   ```bash
   docker compose run --rm --no-deps mobile sh -c "npm run lint && npm run build"
   ```
2. Prueba manual en `http://localhost:8080/m/` (hard refresh `Ctrl+F5`) con
   `operador1@redprint.com` / `password`:
   - Abrir una visita de Hoy → verificar bloque "Contacto" con las 4 filas (seeders las llenan).
   - Tocar teléfono → dialer; tocar correo → cliente de correo; tocar dirección → mapas.
   - Verificar que el bloque no rompe el layout (badges, notas, motivo_cierre siguen ok).
3. Regresión rápida: capturar una lectura en la misma visita y confirmar que la página
   recarga sin cambios raros en la cabecera.

## Nota de despliegue

El cambio es solo frontend móvil: tras implementar, recompilar el dist según AGENTS.md
(`docker compose run --rm --no-deps mobile sh -c "npm run build"`). No requiere
`config:cache` ni migraciones.
