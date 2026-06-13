# Plan: Eliminar el campo "capacidad" de almacenes

## Contexto y hallazgo clave

El campo `capacidad` (y los conceptos derivados: `porcentaje_ocupacion`, `disponibilidad`, filtros de ocupación) **solo existen en el frontend**. El backend (`Warehouse` model, migración, seeder, `WarehouseResource`) no tiene este campo ni ninguno derivado.

**Por qué eliminarlo:**
- La capacidad estaba atada exclusivamente al conteo de impresoras, pero en el futuro los almacenes contendrán más tipos de artículos.
- En la práctica solo hay un almacén real + ubicaciones temporales (casa de socio) donde asignar una capacidad fija no tiene sentido.

### Nota importante (fuera del alcance de este plan)
Existe una desconexión general entre el modelo del frontend y el backend. El frontend espera campos que el backend no devuelve: `encargado`, `telefono`, `estado`, `notas`, `fecha_creacion`, `fecha_ultima_actualizacion`. El backend usa `responsable_id` (relación a User) y `activo` (booleano). **Este plan solo aborda la eliminación de `capacidad`**; la sincronización del resto de campos queda fuera de alcance.

## Reglas de alcance

- **Eliminar:** `capacidad`, `porcentaje_ocupacion`, `disponibilidad`, todos los cálculos de porcentaje, barras de progreso de ocupación y el filtro de ocupación.
- **Conservar:** `ocupacion_actual` / conteo de impresoras (sigue siendo información útil: "N impresoras en este almacén").

No hay cambios en el backend (ya no tiene `capacidad`). No hay tests de almacenes que actualizar.

---

## Cambios por archivo

### 1. `frontend/src/types/warehouse.ts`
- Eliminar `capacidad: number` de la interfaz `Warehouse`.
- Eliminar `capacidad: number` de `WarehouseFormData`.
- Eliminar `porcentaje_ocupacion` y `disponibilidad` de `WarehouseDetail`.
- Conservar `ocupacion_actual: number` en `Warehouse` y `impresoras` en `WarehouseDetail`.

### 2. `frontend/src/components/warehouse/WarehouseForm.tsx`
- Eliminar el estado `capacidad` y `setCapacidad`.
- Eliminar `capacidad` de `FormErrors`.
- Eliminar toda la lógica de validación de capacidad (líneas 46-53).
- Eliminar `capacidad` del objeto que se pasa a `onSubmit`.
- Eliminar el bloque del input "Capacidad" del JSX (líneas 126-138).
- Reorganizar el grid: "Estado" queda solo o se reacomoda (ya no comparte fila con capacidad).

### 3. `frontend/src/components/warehouse/WarehouseTable.tsx`
- Eliminar la columna "Capacidad" (`key: 'capacidad'`, muestra `ocupacion_actual / capacidad`).
- Cambiar la columna "Ocupación" (`key: 'ocupacion_actual'`): quitar el cálculo de porcentaje y la barra de progreso; mostrar solo el conteo de impresoras (ej. "{row.ocupacion_actual} impresoras").
- Eliminar `getOccupationColor` si ya no se usa tras los cambios.

### 4. `frontend/src/components/warehouse/WarehouseCard.tsx`
- Eliminar el cálculo `pct` y `getOccupationColor`.
- Eliminar el bloque de ocupación con barra de progreso (líneas 43-54).
- Reemplazar por una línea de texto simple: "Impresoras: {ocupacion_actual}".

### 5. `frontend/src/components/warehouse/WarehouseStats.tsx`
- Eliminar el cálculo `pct = warehouse.porcentaje_ocupacion`.
- Eliminar los stats "Ocupación" (porcentaje) y "Disponibilidad" (espacios) del arreglo `stats`.
- Eliminar `getOccupationColor` y `getOccupationLabel` si quedan sin uso.
- Eliminar la tarjeta de "Nivel de ocupación" con `ProgressBar` (líneas 78-100).
- Conservar los stats "Total Impresoras" y "Estado".

### 6. `frontend/src/pages/inventory/warehouses/WarehouseList.tsx`
- Eliminar el tipo `OccupationFilter` y la función `getOccupationLevel`.
- Eliminar el estado `occupationFilter` y `setOccupationFilter`.
- Eliminar `matchesOccupation` del filtro y la dependencia `occupationFilter` en el `useMemo`.
- Eliminar el bloque del filtro "Ocupación" del panel de filtros (líneas 234-250).
- Eliminar `setOccupationFilter('all')` de `clearFilters`.
- Eliminar `occupationFilter !== 'all'` de `hasActiveFilters`.

### 7. `frontend/src/stories/warehouse/WarehouseForm.stories.tsx`
- Eliminar `capacidad: 30` del story "Edit".
- Eliminar `capacidad: -1` del story "Validation".

---

## Verificación

1. **Typecheck:** `npm run typecheck` (o el comando configurado en el frontend) — no deben quedar referencias a `capacidad`, `porcentaje_ocupacion` ni `disponibilidad`.
2. **Build del frontend:** compilar sin errores TS.
3. **Revisión manual:**
   - `/inventario/almacenes` — la tabla y tarjetas ya no muestran capacidad ni barras de progreso; el filtro de ocupación desapareció.
   - Modal "Nuevo Almacén" — ya no aparece el campo Capacidad.
   - Detalle de almacén — los stats ya no muestran ocupación % ni disponibilidad.
   - Stories de Storybook compilan sin error.

## Archivos afectados (7)

| Archivo | Tipo de cambio |
|---------|---------------|
| `frontend/src/types/warehouse.ts` | Tipos |
| `frontend/src/components/warehouse/WarehouseForm.tsx` | Formulario |
| `frontend/src/components/warehouse/WarehouseTable.tsx` | Tabla |
| `frontend/src/components/warehouse/WarehouseCard.tsx` | Tarjeta |
| `frontend/src/components/warehouse/WarehouseStats.tsx` | Stats detalle |
| `frontend/src/pages/inventory/warehouses/WarehouseList.tsx` | Página listado |
| `frontend/src/stories/warehouse/WarehouseForm.stories.tsx` | Stories |
