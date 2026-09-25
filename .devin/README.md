# `.devin` — Configuración, prompts e informes del proyecto Panchería

Este directorio agrupa la configuración del entorno de Devin, los prompts reutilizables y los informes del proyecto `pancheria`.

## Punto de entrada para cualquier tarea

- [Prompt maestro — Proyecto Panchería](prompts/pancheria.prompt.md)
- [Guía de escritura de prompts](prompts/README.md)
- [Auditoría integral pre-release](prompts/auditoria-pre-release.md) — prompt consolidado para auditar antes de un release o deploy a producción.
- [Auditoría de escalabilidad](prompts/auditoria-escalabilidad.md) — prompt para auditar escalabilidad a futuro (DB, API, polling, caching, auth, storage, observabilidad, CI/CD y negocio).
- [Prompt de auditoría y documentación](prompts/auditoria-y-documentacion.md)
- [Auditoría de cobertura de pruebas y tests](prompts/auditoria-cobertura-de-pruebas.md)
- [Auditoría QA integral con ejecución de tests](prompts/auditoria-qa-integral.md) — auditoría QA por etapas con tests ejecutables, revisión visual por perfiles e informe con evidencia.
- [Plan de implementación — multi-tenant compartido](prompts/plan-implementacion-multi-tenant.md) — propuesta futura, no implementada.

> **Plan de pedidos con múltiples líneas resuelto:** los prompts `plan-pedidos-personalizados-multiples-lineas.md` y `plan-pedidos-personalizados-pendientes.md` se archivaron en `prompts/archivados/` y se actualizó `reporte-estado.md`.

## Estado del proyecto

- [Reporte de estado vigente](informes/reporte-estado.md) — **punto de entrada**: qué está en main, PRs abiertos y deuda consolidada.
- [Entornos y credenciales](informes/entornos.md)
- [Lecciones aprendidas](informes/lecciones-aprendidas.md)
- [Checklist pre-push](informes/checklist-pre-push.md) — verificaciones antes de subir a Git para evitar errores de CI.
- [Guía de funcionamiento del negocio](informes/guia-funcionamiento-pancheria.md)
- [Auditoría QA ronda 2 (2026-09-23, archivada)](informes/archivados/auditoria-qa-ronda-2-2026-09-23.md) — CSP en producción (`/pedido/seguimiento` estática sin nonce → corregida y verificada en prod), `X-Forwarded-For` fail-closed, revisión con daltonismo.
- [Ticket CI E2E base compartida (archivado)](informes/archivados/ci-e2e-base-compartida.md) — runs concurrentes se contaminaban; `concurrency` por shard + timeout 25 min implementados.
- [Auditoría de escalabilidad (2026-09-19, archivada)](informes/archivados/auditoria-escalabilidad-2026-09-19.md) — fuente del pendiente T14 multi-tenant (diferido); §3.9 alimenta trabajo futuro.
- [Auditoría QA integral (2026-09-21, archivada)](informes/archivados/auditoria-qa-2026-09-21.md) — QA-01/02/03/05 mergeados (PR #4); QA-04 estaba pendiente en `main` y su implementación está en el working tree, con migración generada y E2E/CI/merge pendientes (ver `reporte-estado.md` §0).
- [Plan de implementación de la auditoría de escalabilidad (2026-09-19, resuelto)](informes/archivados/plan-implementacion-escalabilidad-2026-09-19.md) — plan por fases (T1–T16) derivado de la auditoría: T1–T13, T15 y Fase M implementadas; T16 decidido "no implementar"; T14 (multi-tenant) diferido — fuente de verdad: `prompts/plan-implementacion-multi-tenant.md`.
- [Auditoría del deploy de Vercel (2026-09-14, archivada)](informes/archivados/auditoria-deploy-vercel-2026-09-14.md) — validaciones de build y entorno; la recomendación de revisar consistencia de migraciones ahora tiene `drizzle-kit check` en el workflow E2E (ejecución remota pendiente). Siguen los controles operativos de `VERCEL_PRODUCTION_URL`, cron y consumo Neon/Vercel.
- [Auditoría del carrito de ventas (2026-09-06, resuelta)](informes/archivados/auditoria-carrito-ventas-2026-09-06.md) — auditoría del terminal `/ventas`; el rediseño del carrito ya fue implementado.
- [Auditoría de ubicación en el chat de pedidos (2026-09-09, resuelta)](informes/archivados/auditoria-chat-ubicacion-2026-09-09.md) — auditoría de compartir ubicación por chat; la funcionalidad ya fue implementada.
- [Auditoría de sucursales y caja por turnos (2026-09-13, resuelta)](informes/archivados/auditoria-sucursales-y-caja-por-turnos-2026-09-13.md) — contactos de sucursal (`phones`, `social_links`) y avisos de caja por turnos; incluye su plan de observaciones ya implementado (`plan-observaciones-auditoria-sucursales-caja-2026-09-13.md`).
- [Índice de informes](informes/README.md)

> **Plan de acción cerrado:** el plan de acción de 2026-08-27 fue resuelto y se archivó en `informes/archivados/plan-de-accion-2026-08-27.md`.
> **Plan de limpieza — hard delete y cachés cerrado:** el plan de limpieza de hard delete, papelera y cachés en memoria fue resuelto y se archivó en `informes/archivados/plan-limpieza-hard-delete-cache-2026-09-01.md`.
> **Auditoría de sucursales cerrada:** la auditoría de sucursales y caja por turnos (2026-09-13) y su plan de observaciones fueron implementados (commit `a3d70d5`) y archivados en `informes/archivados/`.
> **Planes de escalabilidad cerrados (2026-09-20):** el plan de implementación de la auditoría de escalabilidad, el plan de consolidación pre-multi-tenant y el spike SSE del chat (T13, decisión: opt-in deshabilitado) quedaron resueltos y se archivaron en `informes/archivados/`. La auditoría de escalabilidad quedó archivada como referencia: su §3.9 (complementos de T14 multi-tenant) alimenta trabajo pendiente trackeado en `reporte-estado.md`.
> **Reorganización documental (2026-09-23):** informes implementados/mergeados movidos a `informes/archivados/`; snapshots de estado antiguos a `informes/archivados/historico/` (historia pura, no guía).

## Configuración del entorno

- [Blueprint para Declarative Repo Setup (DRS)](environment.yaml)

## Estructura

```
.devin/
├── environment.yaml              # Blueprint de snapshot para Devin Cloud
├── README.md                     # Este índice
├── informes/
│   ├── reporte-estado.md         # Informe de estado vigente (único)
│   ├── entornos.md               # Entornos, credenciales y pasos de migración
│   ├── lecciones-aprendidas.md   # Resumen transversal de lecciones
│   ├── checklist-pre-push.md     # Verificaciones antes de subir a Git
│   ├── guia-funcionamiento-pancheria.md  # Conceptos de negocio y flujos
│   ├── README.md                 # Índice de informes (tabla de decisión + regla de vida)
│   └── archivados/               # Solo guías con valor futuro: auditorías y planes implementados por completo (con marcador de estado). Incluye historico/ con snapshots de reportes de estado antiguos (historia, no guía).
└── prompts/
    ├── pancheria.prompt.md       # Prompt maestro
    ├── README.md                 # Guía para escribir prompts
    ├── auditoria-pre-release.md  # Auditoría integral pre-release/pre-deploy
    ├── auditoria-escalabilidad.md  # Auditoría de escalabilidad a futuro
    ├── auditoria-y-documentacion.md
    ├── auditoria-cobertura-de-pruebas.md
    ├── auditoria-qa-integral.md  # Auditoría QA por etapas con ejecución de tests
    ├── plan-implementacion-multi-tenant.md
    └── archivados/               # Prompts resueltos (incluye auditoria-masiva.md, auditoria-masiva-resumen.md, plan de pedidos personalizados, datos-sucursal-y-mapa-en-pedido.md, sucursal-form-validacion-mapa-y-horarios.md, destacar-boton-cierre-caja.md y auditoria-fallos-e2e-caja-y-rate-limit.md)
```

## Reglas de uso

1. **Idioma español** para toda explicación, comentario y documentación.
2. **No hardcodear** credenciales, URLs de APIs ni secretos.
3. **Prompts activos** reflejan el estado actual; los prompts resueltos se archivan en `prompts/archivados/` para evitar referencias desfasadas. Su contexto histórico queda en `lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md` y en `informes/archivados/`.
4. **Un único `reporte-estado.md` vigente**: generar un nuevo informe editando este archivo; si se requiere histórico, archivar el anterior en `informes/archivados/`.
5. Antes de tocar código, leer `AGENTS.md`, `lecciones-aprendidas.md` y `guia-funcionamiento-pancheria.md`.
6. Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` antes de dar por terminada una tarea; `npm run test:e2e` solo con `.env.e2e` en base descartable.

## Documentación externa

- [AGENTS.md](../AGENTS.md)
- [README.md del proyecto](../README.md)
- [.env.example](../.env.example)
