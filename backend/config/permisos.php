<?php

/*
|--------------------------------------------------------------------------
| Catalogo de permisos (RBAC por opcion de menu)
|--------------------------------------------------------------------------
|
| Fuente unica de verdad para el catalogo de permisos. La leen:
|   - La migracion 0001_01_01_000032_create_rbac_tables.php (siembra permisos)
|   - El modelo App\Models\Permission
|   - El endpoint GET /permisos (para la UI de checkboxes de roles)
|   - Las reglas de validacion de StoreRoleRequest/UpdateRoleRequest
|
| Estructura: cada modulo agrupa una lista de permisos con { clave, etiqueta }.
| La "clave" (ej. "inventario.impresoras") es lo que se persiste en la tabla
| permissions y lo que usa el middleware `permission:` y el frontend.
| El "modulo" es solo un agrupador cosmético, nunca unidad de exclusion.
|
| El Dashboard (/) no requiere permiso de acceso; sus widgets se filtran en UI.
*/

return [

    'inventario' => [
        ['clave' => 'inventario.impresoras', 'etiqueta' => 'Impresoras'],
        ['clave' => 'inventario.articulos', 'etiqueta' => 'Articulos'],
        ['clave' => 'inventario.mantenimiento', 'etiqueta' => 'Mantenimiento'],
        ['clave' => 'inventario.almacenes', 'etiqueta' => 'Almacenes'],
        ['clave' => 'inventario.movimientos', 'etiqueta' => 'Movimientos'],
    ],

    'clientes' => [
        ['clave' => 'clientes', 'etiqueta' => 'Clientes'],
    ],

    'contratos' => [
        ['clave' => 'contratos', 'etiqueta' => 'Contratos'],
    ],

    'operaciones' => [
        ['clave' => 'operaciones.calendario', 'etiqueta' => 'Calendario'],
        ['clave' => 'operaciones.lecturas', 'etiqueta' => 'Lecturas'],
    ],

    'finanzas' => [
        ['clave' => 'finanzas.facturas', 'etiqueta' => 'Facturas'],
        ['clave' => 'finanzas.cfdi', 'etiqueta' => 'Comprobantes CFDI (XML)'],
        ['clave' => 'finanzas.cuentas-por-cobrar', 'etiqueta' => 'Cuentas por Cobrar'],
        ['clave' => 'finanzas.cuentas-por-pagar', 'etiqueta' => 'Cuentas por Pagar'],
        ['clave' => 'finanzas.compras', 'etiqueta' => 'Compras'],
        ['clave' => 'finanzas.rentabilidad', 'etiqueta' => 'Rentabilidad'],
        ['clave' => 'finanzas.flujo-caja', 'etiqueta' => 'Flujo de Caja'],
        ['clave' => 'finanzas.cuentas-bancarias', 'etiqueta' => 'Cuentas Bancarias'],
        ['clave' => 'finanzas.conciliacion', 'etiqueta' => 'Conciliacion'],
        ['clave' => 'finanzas.cierre', 'etiqueta' => 'Cierre de Periodo'],
    ],

    'sistema' => [
        ['clave' => 'sistema.usuarios', 'etiqueta' => 'Usuarios'],
        ['clave' => 'sistema.notificaciones', 'etiqueta' => 'Notificaciones'],
        ['clave' => 'sistema.configuracion', 'etiqueta' => 'Configuracion'],
    ],

];
