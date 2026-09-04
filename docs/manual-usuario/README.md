# Manual de usuario RedPrint

Bienvenido al manual de usuario de **RedPrint**, el sistema de administración para el negocio de
**renta de impresoras con cobro por consumo** (renta fija + excedente por página).

Este manual está organizado **por función/perspectiva**: cada capítulo explica el sistema desde
el punto de vista de un rol de trabajo concreto (administrador, operador de campo, técnico,
almacenista y personal de finanzas), con sus pantallas, sus flujos paso a paso y sus reglas.

---

## Índice

| Capítulo | Para quién | Qué cubre |
|---|---|---|
| [01 · Conceptos básicos](01-conceptos.md) | Todos | Glosario del negocio, estados, reglas de oro |
| [02 · Administrador](02-administrador.md) | Dueño / administrador | Dashboard, clientes, contratos, supervisión de operaciones, usuarios y roles |
| [03 · Operador de campo](03-operador-campo.md) | Socios / operadores | App móvil "RedPrint Operativo": visitas, lecturas, entregas, instalación/retiro |
| [04 · Técnico de mantenimiento](04-tecnico-mantenimiento.md) | Técnicos | Órdenes preventivas/correctivas, piezas, reportes de mantenimiento |
| [05 · Almacenista](05-almacenista.md) | Encargado de almacén/inventario | Impresoras, artículos, almacenes, movimientos (kardex) |
| [06 · Administración financiera](06-finanzas.md) | Contador / finanzas | Facturas, pagos, CFDI, compras, bancos, conciliación, cierre, reportes |
| [07 · Preguntas frecuentes y errores](07-preguntas-frecuentes.md) | Todos | Mensajes de error comunes, problemas de acceso, limitaciones conocidas |

> Si es tu primera vez en el sistema, lee primero el [capítulo de conceptos](01-conceptos.md).
> Después ve directo al capítulo de tu rol.

---

## Cómo entrar al sistema

RedPrint tiene **dos aplicaciones** que comparten la misma cuenta de usuario:

| Aplicación | Uso | Dirección |
|---|---|---|
| **Panel web** | Administración completa (todos los módulos) | La URL de tu instalación (en local: `http://localhost:8080`) |
| **App móvil de campo** ("RedPrint Operativo") | Trabajo diario del operador en campo | La misma URL seguida de `/m/` (en local: `http://localhost:8080/m/`) |

Ambas se abren en el navegador; no hay que instalar nada en la computadora. La app móvil está
pensada para usarse en el teléfono.

### Inicio de sesión

1. Abre la dirección del sistema en tu navegador.
2. Escribe tu **correo electrónico** y **contraseña** (te los asigna el administrador).
3. Pulsa **Iniciar sesión**.

Reglas de la contraseña: mínimo **8 caracteres**, al menos **una mayúscula** y **un número**.
Puedes cambiarla desde el enlace *"¿Olvidaste tu contraseña? -> cambiar contraseña"* de la
pantalla de acceso (necesitas tu contraseña actual) o pidiendo al administrador que te la
reestablezca desde **Sistema -> Usuarios**.

### Usuarios de prueba (solo instalación local/demo)

| Usuario | Contraseña | Rol | Sirve para |
|---|---|---|---|
| `admin@redprint.com` | `password` | Administrador | Ver todo el panel web |
| `operador1@redprint.com` | `password` | Operador | App móvil, flujo completo de campo |
| `mvp1@redprint.com` | `password` | Operador de inventario | Solo inventario (sin visitas ni finanzas) |

En producción estas cuentas demo deben desactivarse o eliminarse.

---

## Roles y permisos (cómo se decide qué ve cada persona)

RedPrint no funciona por "perfiles fijos" sino por **permisos granulares**: 23 permisos
agrupados en 6 módulos (Inventario, Clientes, Contratos, Operaciones, Finanzas, Sistema).
A cada usuario se le asigna **un rol**, y cada rol tiene una lista de permisos.

Consecuencias prácticas:

- **El menú se adapta**: cada persona solo ve las secciones para las que tiene permiso.
- **El Dashboard se adapta**: los widgets que no corresponden a tus permisos no aparecen.
- **Cada botón y acción** está protegido por el mismo catálogo de permisos.

### Roles que trae el sistema

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Todo (rol de sistema, no se puede limitar) |
| **Operador** | Por defecto se le asignan todos los permisos, pero el administrador puede recortárselos |
| **Operador de inventario** | Solo impresoras, artículos y almacenes (rol limitado de ejemplo) |

El administrador puede **crear roles nuevos** (por ejemplo "Técnico" o "Almacenista") y marcar
exactamente qué permisos tiene cada uno, desde **Sistema -> Usuarios -> pestaña Roles**
(ver [capítulo 2](02-administrador.md)).

### Correspondencia sugerida rol de trabajo ↔ permisos

| Perspectiva del manual | Módulos/permisos que necesita |
|---|---|
| Administrador | Todos |
| Operador de campo | `operaciones.calendario`, `operaciones.lecturas`, `operaciones.registros-campo`, `inventario.articulos` (entregas), `inventario.mantenimiento` (fallas), `contratos` + `inventario.impresoras`/`inventario.almacenes` (instalación/retiro) |
| Técnico | `inventario.mantenimiento` (+ `inventario.articulos` y `inventario.movimientos` si también gestiona piezas) |
| Almacenista | `inventario.impresoras`, `inventario.articulos`, `inventario.almacenes`, `inventario.movimientos` |
| Finanzas / contador | `finanzas.*` (los 10 permisos del módulo) |

---

## Convenciones usadas en este manual

- Las rutas de menú se escriben como **Módulo -> Submódulo -> Acción** (por ejemplo:
  **Finanzas -> Facturas -> Nueva factura**).
- Los botones de la interfaz se marcan en **negrita**.
- Las advertencias importantes aparecen en bloques como este:

> **Importante:** …

- "App móvil" = la aplicación de campo servida en `/m/`. "Panel web" = la aplicación principal.
- Las pantallas muestran todos los textos, fechas y montos en español y formato de México
  (moneda MXN).
