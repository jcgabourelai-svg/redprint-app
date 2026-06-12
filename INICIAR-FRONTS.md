# Iniciar Frontends RedPrint

Guía para iniciar los dos frontends de RedPrint en paralelo para comparación visual.

---

## Prerequisitos

- Docker corriendo con el backend
- Node.js y npm instalados
- Docker containers de redprint-app deben estar activos

---

## Verificar Backend

```bash
cd /home/jcfolken/proyectos/redprint/redprint-app
docker compose ps
```

Los siguientes contenedores deben estar corriendo:
- `redprint-app` (backend Laravel)
- `redprint-db` (PostgreSQL)
- `redprint-nginx` (nginx)

Si no están corriendo:
```bash
docker compose up -d
```

---

## Iniciar Frontends

### Opción 1: Dos terminales (recomendada)

**Terminal 1 - Frontend Original:**
```bash
cd /home/jcfolken/proyectos/redprint/redprint-app/frontend
npx vite --port 5173
```

**Terminal 2 - Frontend Nuevo:**
```bash
cd /home/jcfolken/proyectos/redprint/redprint-app/frontend-new
npx vite --port 5174 --strictPort
```

---

### Opción 2: Una sola terminal

```bash
cd /home/jcfolken/proyectos/redprint/redprint-app/frontend && npx vite --port 5173 &
cd /home/jcfolken/proyectos/redprint/redprint-app/frontend-new && npx vite --port 5174 --strictPort &
```

Nota: Esta opción puede requerir que mantengas la terminal abierta.

---

## URLs de Acceso

| Frontend | URL | Propósito |
|----------|-----|-----------|
| **Original** | `http://localhost:5173/` | Referencia actual (código sin cambios) |
| **Nuevo** | `http://localhost:5174/` | Desarrollo visual rediseñado |

---

## Pantallas Piloto Rediseñadas

Las siguientes pantallas en el frontend nuevo ya tienen el estilo visual mejorado:

1. **Detalle de Impresora** (`/impresoras/:id`)
   - Layout 3 columnas con sidebar de métricas
   - Contador, vida útil, costo, estado en cards laterales

2. **Lista de Facturas** (`/facturas`)
   - 4 KPI cards (total, vencidas, pendientes, saldo pendiente)
   - FilterBar con botón "Limpiar"

3. **Lista de Movimientos** (`/inventario/movimientos`)
   - 3 KPI cards (total, entradas, salidas)
   - FilterBar con botón "Limpiar"

---

## Componentes de Layout Creados

Los siguientes componentes están listos para usar en `frontend-new/src/components/layout/`:

- `DetailLayout` - Grid 3 columnas (2 + sidebar)
- `KPICards` - Cards resumen con iconos y tendencias
- `SidebarStats` - Métricas laterales con variantes de color
- `FormWizard` - Wizard multi-step con indicador visual
- `FilterBar` - Barra de filtros con botón "Limpiar"

---

## Autenticación

El backend Laravel tiene configurado `SANCTUM_STATEFUL_DOMAINS` para aceptar cookies de ambos puertos:

```
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:5173,localhost:5174,...
```

Si el login falla en el frontend nuevo, verifica:
1. Backend corriendo: `docker compose ps`
2. Config cache actualizado: `docker exec redprint-app php artisan config:cache`

---

## Flujo de Trabajo

1. Iniciar ambos frontends (ver arriba)
2. Abrir `http://localhost:5173/` en tab 1 (original)
3. Abrir `http://localhost:5174/` en tab 2 (nuevo)
4. Navegar a la misma pantalla en ambos tabs
5. Comparar visualmente lado a lado
6. Modificar código en `frontend-new/`
7. Los cambios se reflejan automáticamente (HMR) en el puerto 5174

---

## Detener Frontends

```bash
# Detener ambos frontends
pkill -f "vite.*5173\|vite.*5174"

# O Ctrl+C en cada terminal individual
```

---

## Estructura de Directorios

```
redprint-app/
├── backend/                 # Laravel backend (Docker)
├── frontend/               # Frontend ORIGINAL (5173)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts      # port: 5173
└── frontend-new/           # Frontend NUEVO (5174)
    ├── src/                # Copia inicial de frontend/
    │   └── components/layout/  # NUEVOS componentes de layout
    ├── package.json        # port: 5174, name: redprint-frontend-new
    └── vite.config.ts      # port: 5174
```

---

## Sync de Cambios

Si modificas el frontend original y quieres llevar cambios al nuevo:

```bash
# Archivos específicos
cp /home/jcfolken/proyectos/redprint/redprint-app/frontend/src/lib/api.ts \
   /home/jcfolken/proyectos/redprint/redprint-app/frontend-new/src/lib/api.ts

# Estructura completa (solo source)
rsync -av --exclude='node_modules' --exclude='dist' \
  /home/jcfolken/proyectos/redprint/redprint-app/frontend/src/ \
  /home/jcfolken/proyectos/redprint/redprint-app/frontend-new/src/
```

---

## Próximos Pasos

Con los 3 pilotos validados, el siguiente paso es aplicar los componentes de layout a las 30 pantallas restantes. Seguir el análisis detallado en:

`comparacion/analisis-pantallas.md` - Comparación pantalla por pantalla con recomendaciones

---

## Solución de Problemas

### Frontend no responde
```bash
# Verificar puertos
lsof -i :5173 -i :5174

# Reiniciar frontend
kill $(lsof -ti :5174)
cd /home/jcfolken/proyectos/redprint/redprint-app/frontend-new
npx vite --port 5174 --strictPort
```

### Login falla en puerto 5174
```bash
# Verificar config Sanctum
docker exec redprint-app grep SANCTUM_STATEFUL_DOMAINS .env

# Recargar config
docker exec redprint-app php artisan config:cache
```

### Build errors
```bash
cd /home/jcfolken/proyectos/redprint/redprint-app/frontend-new
npx vite build
```

---

## Referencias

- `comparacion/pantallas.md` - Comparación de pantallas entre ambas versiones
- `comparacion/analisis-pantallas.md` - Análisis detallado pantalla por pantalla
- `FRONTENDS-PARALELOS.md` - Documentación técnica de la configuración