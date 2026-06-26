# Plan: Conectar el selector de tema y habilitar dark mode funcional completo

## Contexto

En `/sistema/configuracion` (tarjeta "Preferencias de Visualización", `frontend/src/pages/admin/ConfigPage.tsx`) el usuario puede elegir tema (Claro/Oscuro/Sistema), pero **no tiene ningún efecto**:

- El selector guarda `config.tema` en `localStorage` (`redprint_config`), pero **nada lo aplica al DOM**. No existe `ThemeProvider`, ni hook de tema, ni nada que añada la clase `.dark` a `<html>`.
- Aunque `tailwind.config.js` tiene `darkMode: ['class']` y `globals.css` define la paleta semántica completa (`:root` + `.dark`), **ningún componente la consume**: todo usa colores hardcodeados (`bg-white`, `text-gray-*`, `border-gray-*`, `bg-blue-*`, etc.). ~1.030 ocurrencias de los 8 patrones gris/blanco principales en `frontend/src`.

Objetivo: tema funcional completo (claro/oscuro/sistema) usando **tokens semánticos** de Tailwind.

## Decisiones acordadas

- **Estrategia de color:** tokens semánticos (`bg-background`, `text-foreground`, `bg-card`, `bg-muted`, `border-border`, `text-primary`, `bg-destructive`, etc.). Aprovechar la paleta `.dark` ya definida en `globals.css`.
- **Persistencia:** reutilizar la clave existente `redprint_config.tema`. El `ThemeProvider` lee/escribe solo ese campo.
- **Anti-FOUC:** sí. Script inline en `index.html` que aplica `.dark` antes del primer paint.
- **Alcance:** completo (componentes UI + layout + todas las páginas y features).

## Mapeo de tokens (referencia para toda la migración)

| Hardcodeado (claro) | Token semántico |
|---|---|
| `bg-white` (cards/popovers/superficies) | `bg-card` (o `bg-popover` en menús desplegables) |
| `bg-gray-50` / `bg-gray-100` (fondos, hover suave) | `bg-muted` (y `hover:bg-muted` / `bg-muted/50`) |
| `text-gray-900` (texto principal) | `text-foreground` |
| `text-gray-700` / `text-gray-600` (texto secundario) | `text-muted-foreground` |
| `text-gray-500` / `text-gray-400` (texto terciario) | `text-muted-foreground` |
| `border-gray-200` / `border-gray-300` | `border-border` (o `border-input`) |
| `bg-blue-500/600`, `text-blue-600`, `border-blue-500`, `hover:bg-blue-50` | `bg-primary`, `text-primary`, `border-primary`, `bg-primary/10`/`hover:bg-primary/10` |
| `bg-red-500/600`, `text-red-600` | `bg-destructive`, `text-destructive` |
| `text-green-500/600`, `bg-green-500` | `text-success`, `bg-success` |
| `text-amber-500/600`, `bg-amber-500` | `text-warning`, `bg-warning` |
| `text-white` (sobre primario/destructivo) | `text-primary-foreground` / `text-destructive-foreground` (mantener `text-white` sobre `success`/`warning` por sus foreground) |

> Nota: aplicar juicio en cada caso (ej. `bg-black/50` de overlays de modal/sidebar se mantiene; `bg-white` en hover de fila de tabla → `hover:bg-muted`).

## Tareas

### 1. Infraestructura de tema (nuevo)

1. Crear `frontend/src/contexts/ThemeContext.tsx`:
   - Estado `tema: 'claro' | 'oscuro' | 'sistema'`, inicializado desde `localStorage['redprint_config']` (parsear JSON, fallback `'claro'`).
   - Calcular `resolvedDark`: si `tema === 'sistema'`, usar `window.matchMedia('(prefers-color-scheme: dark)').matches`; si `'oscuro'`, `true`; si `'claro'`, `false`.
   - Effect: `document.documentElement.classList.toggle('dark', resolvedDark)`.
   - Effect: si `tema === 'sistema'`, suscribirse a `matchMedia` `change` y actualizar.
   - Exponer `setTema(t)` que persiste en `redprint_config` (merge con el objeto existente) y actualiza el estado.
   - Mantener sincronizado: escuchar evento `storage` para reflejar cambios desde otras pestañas.
2. Crear hook `frontend/src/hooks/useTheme.ts` (re-exporta el contexto, o define `useContext(ThemeContext)`).
3. Montar `<ThemeProvider>` en `frontend/src/main.tsx` (envolviendo `<App />`, dentro o fuera de `AuthProvider` — fuera para que aplique lo antes posible).
4. **Anti-FOUC:** añadir script inline al inicio de `<head>` en `frontend/index.html` que lea `localStorage.getItem('redprint_config')`, resuelva `tema`, y haga `document.documentElement.classList.toggle('dark', ...)` **antes** de que cargue React. Sincronizar la lógica de resolución con la del provider.
5. Conectar `ConfigPage.tsx` con el provider: usar `useTheme()` para leer/escribir `tema` en lugar del estado local aislado, de modo que al pulsar un botón el tema se aplique al instante (sin recargar). Mantener el resto del `config` en `redprint_config` intacto.

### 2. Extender paleta semántica

6. En `frontend/src/styles/globals.css`:
   - Añadir tokens `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--info`, `--info-foreground` (y los `--error*` si se separan de `--destructive`) en `:root` con los hex actuales como valores claros.
   - Añadir sus variantes en `.dark` (versiones ajustadas para fondo oscuro).
   - Mantener `--primary`, `--destructive` (ya existen con `.dark`).
7. En `frontend/tailwind.config.js`:
   - Convertir `success`, `warning`, `error`, `info` de hex fijos a `hsl(var(--success))` (con sus `foreground`), igual que `primary`/`destructive`.

### 3. Migrar componentes UI base (14 archivos en `components/ui/`)

8. `Button.tsx`, `Card.tsx`, `Input.tsx`, `Select.tsx`, `Table.tsx`, `Modal.tsx`, `Badge.tsx`, `Tabs.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Toast.tsx`, `ProgressBar.tsx`, `Calendar.tsx`, `DatePicker.tsx`: aplicar el mapeo de tokens. Prioridad alta (son reutilizables → propagan dark mode a toda la app).

### 4. Migrar layout (5 archivos en `components/layout/`)

9. `PageLayout.tsx` (`bg-gray-50` → `bg-background`, es el fondo global), `Sidebar.tsx`, `Header.tsx`, `BottomNav.tsx`, `Breadcrumbs.tsx`.

### 5. Barrido de páginas y features

10. Migrar las ~36 páginas bajo `frontend/src/pages/` aplicando el mismo mapeo, incluyendo estilos duplicados a mano (textareas en `ArticleDetail`/`PrinterDetail`, tablas manuales en `WarehouseDetail`/`BankAccountsPage`/reportes, etc.).
11. Migrar componentes de feature: `components/warehouse/*`, `components/dashboard/*`, `components/printer/*`.

### 6. Limpieza residual

12. Buscar patrones restantes (`bg-white`, `text-gray-`, `border-gray-`, `bg-blue-`, `text-red-`, etc.) con ripgrep y corregir lo que quede en `.tsx`. Omitir archivos `.stories.tsx` si no es crítico, pero idealmente alinearlos también.

## Riesgos / Notas

- **Estilos duplicados en páginas:** mucho CSS de UI base está copiado a mano dentro de páginas (no solo en `components/ui/`). Hay que migrar esos casos puntuales; no alcanza con tocar los componentes base.
- **`success`/`warning`/`info` actuales son hex fijos:** cambiarlos a tokens afecta a cualquier uso existente; tras la migración deben seguir viéndose igual en claro.
- **Overlays:** `bg-black/50` de Modal/Sidebar se mantiene (es overlay translúcido válido en ambos modos).
- **FOUC script:** debe replicar exactamente la lógica de resolución del provider para evitar discrepancias (ej. valor no válido → tratar como `'claro'`).
- **Compatibilidad con `redprint_config`:** no romper la estructura existente; el provider solo toca el campo `tema`.

## Validación

- `npm run lint` en `frontend`.
- `docker compose run --rm --no-deps frontend sh -c "npm run build"` y recargar `http://localhost:8080` con Ctrl+F5.
- Verificación manual en `/sistema/configuracion`:
  - Cambiar a **Oscuro**: la clase `.dark` aparece en `<html>` y toda la UI cambia inmediatamente (sin recarga).
  - Cambiar a **Claro**: revierte.
  - Cambiar a **Sistema**: sigue la preferencia del SO; al cambiar el SO, la app reacciona en vivo.
  - Recargar la página en modo **Oscuro**: no hay parpadeo blanco (FOUC) y la clase `.dark` ya está presente antes del paint.
  - Abrir en otra pestaña y cambiar tema: ambas pestañas se sincronizan (evento `storage`).
- Recorrer páginas clave (Dashboard, listados de inventario/clientes/finanzas, detalle de impresora, facturas, reportes) para confirmar contraste y legibilidad en ambos modos.

## Archivos nuevos

- `frontend/src/contexts/ThemeContext.tsx`
- `frontend/src/hooks/useTheme.ts`

## Archivos a modificar (resumen)

- `frontend/index.html` (script anti-FOUC)
- `frontend/src/main.tsx`
- `frontend/src/styles/globals.css`
- `frontend/tailwind.config.js`
- `frontend/src/pages/admin/ConfigPage.tsx`
- `frontend/src/components/ui/*.tsx` (14)
- `frontend/src/components/layout/*.tsx` (5)
- `frontend/src/pages/**/*.tsx` (~36)
- `frontend/src/components/{warehouse,dashboard,printer}/*.tsx`
