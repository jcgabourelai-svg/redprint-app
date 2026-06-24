# Plan: Selector de tamaño de página (page size) reutilizable

## Objetivo
Permitir al usuario elegir cuántos elementos mostrar por página en las tablas
server-side (impresoras, artículos, mantenimiento — y cualquier tabla que use el
componente compartido). Opciones: **10 / 25 / 50 / 100**, con **25 por defecto**.

## Alcance
- **Solo frontend.** El backend ya acepta `per_page` arbitrario vía
  Laravel `paginate($request->per_page ?? X)` en todos los controladores
  (`PrinterController`, `ArticleController`, `MaintenanceOrderController`, etc.).
  No hay tope máximo.
- Actualmente el tamaño fijo de 25 viene de `useServerTable` (`pageSize = 25`),
  que siempre envía `per_page: 25`.

## Archivos a modificar (2)
1. `frontend/src/hooks/useServerTable.ts`
2. `frontend/src/components/ui/Table.tsx`

**Vistas a modificar: 0.** `PrinterList.tsx`, `ArticleList.tsx` y
`MaintenanceList.tsx` ya esparcen `{...tableProps}` sobre `<Table>`, por lo que
heredan el cambio automáticamente.

## Cambios concretos

### 1) `useServerTable.ts`
- Convertir `pageSize` en **estado**: `const [pageSize, setPageSize] = useState(initialPageSize)`,
  con `initialPageSize = options.pageSize ?? 25`.
- Añadir callback `onPageSizeChange`:
  ```ts
  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    resetPage() // volver a página 1 al cambiar el tamaño
  }, [resetPage])
  ```
- Incluir `onPageSizeChange` dentro del objeto `tableProps` retornado.
- `pageSize` ya está en `tableProps` y en `params.per_page`: conserva ese flujo.
  Confirmar que `params` (useMemo) dependa de `pageSize` (ya depende).

### 2) `Table.tsx`
- Añadir props opcionales a `TableProps<T>`:
  ```ts
  pageSizeOptions?: number[]          // default [10, 25, 50, 100]
  onPageSizeChange?: (size: number) => void
  ```
- Destructurar con default: `pageSizeOptions = [10, 25, 50, 100]`.
- Patrón controlado/no-controlado (igual que búsqueda/orden/página existentes):
  - Si llega `onPageSizeChange` → usar el prop `pageSize` como fuente de verdad
    y llamar `onPageSizeChange(n)` al cambiar (modo server-side).
  - Si NO llega → mantener `pageSize` en estado interno local inicializado desde
    el prop `pageSize` (modo cliente, tablas que no usan `useServerTable`).
    Actualizar ese estado interno al cambiar el `<select>`.
- UI: añadir un `<select>` "Filas por página" en el bloque de paginación
  (junto a "Mostrando X a Y de Z"). Estilo coherente con los `<select>` de
  filtros ya existentes (clases `rounded-md border border-gray-300 ...`).
- **Ajuste de visibilidad del footer:** hoy solo se renderiza si
  `effectiveTotalPages > 1`. Cambiar a renderizar el bloque cuando `paginatable`
  sea `true` (aunque haya 1 sola página) para que el selector siempre sea visible.
  Los botones anterior/siguiente siguen condicionados a `effectiveTotalPages > 1`.
  Actualizar el cálculo de `firstItemIndex`/`lastItemIndex`/`totalCount` si fuera
  necesario para que el texto "Mostrando..." siga correcto con 1 sola página.

## Decisión confirmada
- Opciones del selector: **[10, 25, 50, 100]**.
- Valor por defecto: **25** (sin cambios respecto al comportamiento actual).

## Validación
1. Typecheck/build del frontend (`npm run build` o `tsc --noEmit` en `frontend/`).
2. Prueba manual en las 3 rutas:
   - `http://localhost:8080/inventario/impresoras`
   - `http://localhost:8080/inventario/articulos`
   - `http://localhost:8080/inventario/mantenimiento`
3. En cada una:
   - Cambiar el selector a 100 → verificar refetch con `per_page=100` (Network).
   - Cambiar a 10 → verificar refetch y reset automático a página 1.
   - Verificar conteo "Mostrando X a Y de Z" correcto.
   - Verificar que el selector es visible incluso con <1 página de datos.
4. Verificar que tablas puramente cliente (sin `useServerTable`), si las hay,
   también respetan el selector vía estado interno.

## Riesgos / consideraciones
- **Otros consumidores de `Table`:** revisar si existe alguna tabla que pase un
  `pageSize` fijo esperado o que sea puramente cliente. El diseño es
  retrocompatible (props nuevas opcionales con defaults), por lo que no debería
  romper nada; pero conviene confirmar durante la implementación.
- **Sin tope backend:** el `<select>` limita a las 4 opciones, así que no hay
  riesgo de que el usuario envíe `per_page` arbitrariamente grandes.
