# Informes de auditoría

## ¿Qué leer según lo que vas a hacer?

| Si vas a... | Leé |
| --- | --- |
| Ponerte al día / retomar trabajo | **[reporte-estado.md](reporte-estado.md)** §0 — estado de main, PRs abiertos y deuda consolidada |
| Hacer push / abrir PR | [checklist-pre-push.md](checklist-pre-push.md) |
| Tocar DB, migraciones o entornos | [entornos.md](entornos.md) + `AGENTS.md` |
| Entender el negocio o una feature | [guia-funcionamiento-pancheria.md](guia-funcionamiento-pancheria.md) |
| Escribir un prompt o auditar | [lecciones-aprendidas.md](lecciones-aprendidas.md) (referencia por tema, no lectura secuencial) |

## Tickets abiertos

- [auditoria-ux-sucursales-2026-09-26.md](auditoria-ux-sucursales-2026-09-26.md) — auditoría documental de `/sucursales` (jerarquía invertida formulario↔inventario, estado operativo por fila, refuerzo del diálogo de eliminación: sucursal por defecto, lockout de la propia cuenta, caja abierta, resumen falso en cero si falla la consulta, renombrado del default) + propuesta de rediseño en dos tramos. **Estado:** abierto — implementación parcial (resueltos H-M5, H-m9 y A8 el 2026-09-26; cambios en el working tree sin commit); quedan H-C1 puntos 1-3 (flags del diálogo de eliminación, con decisión del usuario sobre bloqueos) y los Tramos A/B de rediseño. Revisado en v3: afirmaciones re-verificadas contra el código post-implementación; menores nuevos H-m10–H-m13 absorbidos por A7.

Ningún otro ticket al 2026-09-26 — los últimos (QA ronda 2 y CI base compartida) mergearon y se archivaron.

> Cuando un PR mergea, su informe se archiva y `reporte-estado.md` §0 se actualiza.

## Referencia viva (nunca se archiva)

`reporte-estado.md` · `entornos.md` · `checklist-pre-push.md` · `guia-funcionamiento-pancheria.md` · `lecciones-aprendidas.md`

## Regla de vida del documento

- Todo informe nuevo lleva `**Estado:** abierto | en curso | implementado | archivado` en el encabezado.
- Se archiva **al cerrarse**: `archivados/` solo contiene material implementado por completo y con valor de guía futura (auditorías, planes, spikes con decisión).
- Si un informe archivado deja un pendiente, ese pendiente debe quedar listado en `reporte-estado.md` §0 — nada se pierde en archivados.
- `archivados/historico/` = snapshots sin valor de guía (reportes de estado viejos). Historia pura: no se edita, se consulta.

## Archivados

[archivados/](archivados/) — auditorías y planes implementados: QA ronda 1 (PR #4), QA ronda 2 (PR #6), E4 sucursal eliminada (PRs #3/#5), ticket CI base compartida (PR #7), escalabilidad (con T14 diferido trackeado en `reporte-estado.md` §0), deploy Vercel, carrito de ventas, ubicación en chat, sucursales y caja por turnos, planes de acción/consolidación/limpieza y el spike SSE.

- [Índice general de `.devin`](../README.md) — prompts, informes y blueprint.
