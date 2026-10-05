# Informes de auditoría

## ¿Qué leer según lo que vas a hacer?

| Si vas a... | Leé |
| --- | --- |
| Ponerte al día / retomar trabajo | **[reporte-estado.md](reporte-estado.md)** §0 — estado de main, PRs abiertos y deuda consolidada |
| Entender la arquitectura del sistema | **[arquitectura/README.md](arquitectura/README.md)** — mapa navegable en 3 niveles (sistema → módulos → DB/código), con diagramas Mermaid |
| Hacer push / abrir PR | [checklist-pre-push.md](checklist-pre-push.md) |
| Tocar DB, migraciones o entornos | [entornos.md](entornos.md) + `AGENTS.md` + [arquitectura/base-de-datos.md](arquitectura/base-de-datos.md) |
| Entender el negocio o una feature | [guia-funcionamiento-pancheria.md](guia-funcionamiento-pancheria.md) |
| Escribir un prompt o auditar | [lecciones-aprendidas.md](lecciones-aprendidas.md) (referencia por tema, no lectura secuencial) |

## Tickets abiertos

- [auditoria-nueva-sucursal-stock-2026-10-04.md](auditoria-nueva-sucursal-stock-2026-10-04.md) — auditoría de solo lectura de factibilidad para una nueva sucursal: inventario de 59 ítems, menú de 11 promos + extras, trazabilidad por promo y facturación. Veredictos A–D parcialmente preparados; incluye plan por PRs y las 6 decisiones del usuario ya incorporadas (D-1..D-6); pendiente solo definir el servicio "Paquete".

> Cuando un PR mergea, su informe se archiva y `reporte-estado.md` §0 se actualiza.

## Referencia viva (nunca se archiva)

`reporte-estado.md` · `entornos.md` · `checklist-pre-push.md` · `guia-funcionamiento-pancheria.md` · `lecciones-aprendidas.md` · `runbook-nueva-sucursal.md` · `arquitectura/` (mapa de arquitectura vivo)

## Regla de vida del documento

- Todo informe nuevo lleva `**Estado:** abierto | en curso | implementado | archivado` en el encabezado.
- Se archiva **al cerrarse**: `archivados/` solo contiene material implementado por completo y con valor de guía futura (auditorías, planes, spikes con decisión).
- Si un informe archivado deja un pendiente, ese pendiente debe quedar listado en `reporte-estado.md` §0 — nada se pierde en archivados.
- `archivados/historico/` = snapshots sin valor de guía (reportes de estado viejos). Historia pura: no se edita, se consulta.

## Archivados

[archivados/](archivados/) — auditorías, planes e informes implementados: rediseño `/pedido` PR 1–3 (commits `3a029e4`, `f1e684c`, `dfb2872`), auditoría UX `/sucursales` (PR #10), prueba de imagen de promo (`ccf4e99`), pruebas manuales pre-producción + resultados (D1–D8/D10 resueltos; D9 decidido sin `admin:true`, atribución `performedBy` trackeada en `reporte-estado.md` §0), QA ronda 1 (PR #4), QA ronda 2 (PR #6), E4 sucursal eliminada (PRs #3/#5), ticket CI base compartida (PR #7), escalabilidad (con T14 diferido trackeado en `reporte-estado.md` §0), deploy Vercel, carrito de ventas, ubicación en chat, sucursales y caja por turnos, planes de acción/consolidación/limpieza y el spike SSE.

- [Índice general de `.devin`](../README.md) — prompts, informes y blueprint.
