# TODO — RedPrint

> Última actualización: 2026-09-21. Fuente: estado de git (`origin/main`
> incluye toner F1–F3 que el `main` local aún no tiene), `ideas/*.md` y
> PROJECT.md §10.

## Inmediato — sincronización del entorno local

- [ ] `git pull` — el `main` local está 3 commits atrás de `origin/main`
      (fast-forward limpio): toner F1+F3 (`267cad8`), toner F2 (`d5c2a2d`),
      auditoría de calidad (`55d2a88`).
- [ ] Tras el pull: `docker compose exec app php artisan migrate`
      (migraciones nuevas: `niveles_toner` en `readings`/`field_records`,
      `es_color` en `printer_models`).
- [ ] Tras el pull: recompilar dists (`frontend` y `mobile`) y recargar
      `http://localhost:8080` con Ctrl+F5.
- [ ] Leer `docs/audits/auditoria-calidad-2026-09-13.md` (llega con el pull)
      y decidir qué hallazgos entran al backlog.

## VPS — operación manual, sin código (despliegue-vps.md)

- [ ] Migrar el VPS de tarball a git preservando los volúmenes nombrados
      (DEPLOY.md §4.2).
- [ ] Instalar el cron del host: update cada 1 min + backup diario
      (DEPLOY.md §4.3).
- [ ] Ajustar `.env` del VPS: `RUN_MIGRATIONS=0` (que migre el orquestador).
- [ ] Probar la primera actualización real con una migración trivial de
      prueba y verificar datos intactos.

## Backlog priorizado (ideas vigentes)

1. [ ] `tecnico-mantenimiento.md` **F1** — analítica técnica: stats con rango
       y desgloses, reportes de fallas y de piezas más usadas. Solo lectura,
       sin migraciones.
2. [ ] `monitoreo-red.md` **F0** — calibración SNMP de 3–5 D1620 del almacén:
       OID contador vs panel, decisión Total 1/Total 2, perfil YAML. Una
       tarde, $0, sin código.
3. [ ] `niveltoner.md` **F4** — costo por página real con insumo →
       `ProfitabilityService` (responde §11.3.1 de PROJECT.md; solo
       estimativo, no tocar facturación).
4. [ ] `tecnico-mantenimiento.md` **F2/F3** — condición técnica de impresora
       (migración + guards) y dashboard "Taller".
5. [ ] `monitoreo-red.md` **F1+** — poller/sonda (repo aparte, requiere
       sesión de diseño dedicada).
6. [ ] `ubicacion.md` **F1/F2** — coords de clientes (aprendizaje desde GPS
       de lecturas) + orden por cercanía en el móvil.

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
