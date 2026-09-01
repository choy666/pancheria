# Informes de auditoría

Este directorio contiene las lecciones aprendidas, el informe de estado vigente, la guía de funcionamiento y el archivo de informes históricos y planes resueltos del proyecto `pancheria`.

- [Lecciones aprendidas](lecciones-aprendidas.md) — resumen transversal para prompts y auditorías futuras.
- [Entornos y credenciales](entornos.md) — cómo identificar y usar las URLs de base de datos de desarrollo, producción y E2E; pasos para migraciones.
- [Reporte de estado](reporte-estado.md) — estado actual del proyecto, verificaciones y documentación.
- [Checklist pre-push](checklist-pre-push.md) — verificaciones y consejos para evitar errores de CI antes de subir a Git.
- [Guía de funcionamiento](guia-funcionamiento-pancheria.md) — conceptos de negocio, roles, flujos y decisiones arquitectónicas.
- [Plan de limpieza — hard delete y cachés en memoria (resuelto)](archivados/plan-limpieza-hard-delete-cache-2026-09-01.md) — plan detallado para implementar hard delete de productos/videos con liberación de archivos e invalidación de cachés del servidor.
- [Archivo de informes históricos](archivados/) — reportes anteriores (`reporte-estado-YYYY-MM-DD.md`) y planes resueltos (incluye el plan de acción de 2026-08-27 y el snapshot `reporte-estado-historico-2026-08-30.md`).
- [Índice general de `.devin`](../README.md) — prompts, informes y blueprint.

## Cómo usar este directorio

1. Incluir `lecciones-aprendidas.md` en prompts futuros para evitar regresiones documentadas.
2. Consultar el `reporte-estado.md` vigente antes de iniciar una tarea.
3. Para entender el negocio y la arquitectura, leer `guia-funcionamiento-pancheria.md`.
4. Para crear prompts nuevos, seguir la guía de `.devin/prompts/README.md`.
5. Consultar `AGENTS.md` para reglas, comandos y variables de entorno del proyecto.
