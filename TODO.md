# TODO — RedPrint

> Última actualización: 2026-09-23. Fuente: estado de git (`main` local y
> `origin/main` sincronizados), `ideas/*.md` y PROJECT.md §10.
>
> Cambios desde la versión anterior: `tecnico-mantenimiento.md` F1–F5 quedó
> implementada por completo (2026-09-22) y sale del backlog;
> `despliegue-vps.md` F0–F2 ya está terminada y operando (confirmada contra
> código); el pull de toner/auditoría ya está aplicado.

## Verificar entorno local (post-pull del 2026-09-22)

- [ ] `docker compose exec app php artisan migrate:status` — confirmar que la
      BD local tiene las migraciones nuevas: `condicion` en printers,
      `origen` en articles, `origen_snapshot` en articles_used,
      `maintenance_plans` y `plan_id` en maintenance_orders.
- [ ] Recompilar dists si hay cambios sin compilar: `docker compose run --rm
      --no-deps frontend sh -c "npm run build"` (ídem `mobile`) y recargar
      `http://localhost:8080` con Ctrl+F5.
- [ ] Leer `docs/audits/auditoria-calidad-2026-09-13.md` y decidir qué
      hallazgos entran al backlog.

## Backlog priorizado (ideas vigentes)

1. [ ] `monitoreo-red.md` **F0** — calibración SNMP de 3–5 D1620 del almacén:
       OID contador vs panel, decisión Total 1/Total 2, perfil YAML del modelo.
       Una tarde, $0, sin código.
2. [ ] `niveltoner.md` **F4** — costo por página real con insumo →
       `ProfitabilityService` (responde §11.3.1 de PROJECT.md; solo estimativo,
       no tocar facturación).
3. [ ] `ubicacion.md` **F1/F2** — coords de clientes (aprendizaje desde GPS de
       lecturas) + orden por cercanía en el móvil.
4. [ ] `monitoreo-red.md` **F1+** — poller/sonda (repo aparte, requiere sesión
       de diseño dedicada).
5. [ ] `despliegue-vps.md` **F3** (opcional) — badge "desactualizado" contra
       GitHub API y/o disparo del update por GitHub Action.

## Deuda conocida (resumen PROJECT.md §10)

- [ ] Sin scheduler para: marcar facturas vencidas, notificaciones de stock
      bajo, cierres automáticos.
- [ ] Sin unicidad server-side por (visita, impresora) en lecturas manuales
      (los registros de campo sí la tienen por `client_uuid`).
- [ ] `PeriodController` cuenta conciliados/pendientes por `tipo` en vez de
      `conciliacion_status` — posible bug latente en el resumen de cierre.
- [ ] Mocks/botones decorativos en frontend: campana con badge "3"
      hardcodeado, `ConfigPage` solo `localStorage`, selects hardcodeados
      (compras/conciliación/socios), reportes con `mockTrend`, botones sin
      handler ("Imprimir", "Eliminar", "Ver Reporte/Enviar email").
- [ ] Wizard de contrato: `fecha_inicio` por defecto fija (2026-05-15).
