# Informes de auditoría

Este directorio contiene las lecciones aprendidas, el informe de estado vigente, la guía de funcionamiento y el archivo de informes históricos y planes resueltos del proyecto `pancheria`.

- [Lecciones aprendidas](lecciones-aprendidas.md) — resumen transversal para prompts y auditorías futuras.
- [Entornos y credenciales](entornos.md) — cómo identificar y usar las URLs de base de datos de desarrollo, producción y E2E; pasos para migraciones.
- [Reporte de estado](reporte-estado.md) — estado actual del proyecto, verificaciones y documentación.
- [Checklist pre-push](checklist-pre-push.md) — verificaciones y consejos para evitar errores de CI antes de subir a Git.
- [Guía de funcionamiento](guia-funcionamiento-pancheria.md) — conceptos de negocio, roles, flujos y decisiones arquitectónicas.
- [Auditoría de escalabilidad (2026-09-19)](auditoria-escalabilidad-2026-09-19.md) — veredicto, cuadro de riesgo, orden de quiebre a 10×/50×/100× y plan de acción hacia multi-tenant (10–50 comercios).
- [Plan de implementación de la auditoría de escalabilidad (2026-09-19)](plan-implementacion-escalabilidad-2026-09-19.md) — tareas T1–T16 por fases (quick wins, corto plazo, estratégico, verificaciones en producción) con trazabilidad a los hallazgos H1–H14.
- [Archivo de informes históricos y auditorías resueltas](archivados/) — reportes de estado anteriores, planes resueltos y auditorías implementadas. Incluye la auditoría del deploy de Vercel (`auditoria-deploy-vercel-2026-09-14.md`, recomendaciones implementadas el 2026-09-15; queda abierta la verificación periódica de `VERCEL_PRODUCTION_URL` en `checklist-pre-push.md`), la auditoría de sucursales y caja por turnos (`auditoria-sucursales-y-caja-por-turnos-2026-09-13.md`, con su plan de observaciones ya implementado), el plan de limpieza de hard delete y cachés (`plan-limpieza-hard-delete-cache-2026-09-01.md`), el plan de acción de 2026-08-27, la auditoría del carrito de ventas 2026-09-06 y la de ubicación en chat 2026-09-09.
- [Índice general de `.devin`](../README.md) — prompts, informes y blueprint.

## Cómo usar este directorio

1. Incluir `lecciones-aprendidas.md` en prompts futuros para evitar regresiones documentadas.
2. Consultar el `reporte-estado.md` vigente antes de iniciar una tarea.
3. Para entender el negocio y la arquitectura, leer `guia-funcionamiento-pancheria.md`.
4. Para crear prompts nuevos, seguir la guía de `.devin/prompts/README.md`.
5. Consultar `AGENTS.md` para reglas, comandos y variables de entorno del proyecto.
