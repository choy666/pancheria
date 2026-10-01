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

- [auditoria-ux-sucursales-2026-09-26.md](auditoria-ux-sucursales-2026-09-26.md) — auditoría documental de `/sucursales` (jerarquía invertida formulario↔inventario, estado operativo por fila, refuerzo del diálogo de eliminación: sucursal por defecto, lockout de la propia cuenta, caja abierta, resumen falso en cero si falla la consulta, renombrado del default) + propuesta de rediseño en dos tramos. **Estado:** implementado completo el 2026-09-26 — Tramo A (A1–A8, H-M1–H-M5, H-C1 con banners de advertencia sin bloqueos — decisión del usuario —, H-m2/H-m9–H-m13), menores (H-m1, H-m3–H-m8) y Tramo B (rutas dedicadas `/sucursales/nueva` y `/sucursales/[id]/editar`).

Ningún otro ticket al 2026-09-26 — los últimos (QA ronda 2 y CI base compartida) mergearon y se archivaron.

> Cuando un PR mergea, su informe se archiva y `reporte-estado.md` §0 se actualiza.

## Referencia viva (nunca se archiva)

`reporte-estado.md` · `entornos.md` · `checklist-pre-push.md` · `guia-funcionamiento-pancheria.md` · `lecciones-aprendidas.md` · `arquitectura/` (mapa de arquitectura vivo)

## Regla de vida del documento

- Todo informe nuevo lleva `**Estado:** abierto | en curso | implementado | archivado` en el encabezado.
- Se archiva **al cerrarse**: `archivados/` solo contiene material implementado por completo y con valor de guía futura (auditorías, planes, spikes con decisión).
- Si un informe archivado deja un pendiente, ese pendiente debe quedar listado en `reporte-estado.md` §0 — nada se pierde en archivados.
- `archivados/historico/` = snapshots sin valor de guía (reportes de estado viejos). Historia pura: no se edita, se consulta.

## Archivados

[archivados/](archivados/) — auditorías y planes implementados: QA ronda 1 (PR #4), QA ronda 2 (PR #6), E4 sucursal eliminada (PRs #3/#5), ticket CI base compartida (PR #7), escalabilidad (con T14 diferido trackeado en `reporte-estado.md` §0), deploy Vercel, carrito de ventas, ubicación en chat, sucursales y caja por turnos, planes de acción/consolidación/limpieza y el spike SSE.

- [Índice general de `.devin`](../README.md) — prompts, informes y blueprint.
