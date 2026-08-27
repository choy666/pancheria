# `.devin` — Configuración, prompts e informes del proyecto Panchería

Este directorio agrupa la configuración del entorno de Devin, los prompts reutilizables y los informes del proyecto `pancheria`.

## Punto de entrada para cualquier tarea

- [Prompt maestro — Proyecto Panchería](prompts/pancheria.prompt.md)
- [Guía de escritura de prompts](prompts/README.md)
- [Prompt de auditoría y documentación](prompts/auditoria-y-documentacion.md)
- [Auditoría de cobertura de pruebas y tests](prompts/auditoria-cobertura-de-pruebas.md)
- [Plan de implementación — multi-tenant compartido](prompts/plan-implementacion-multi-tenant.md) — propuesta futura, no implementada.

## Estado del proyecto

- [Reporte de estado vigente](informes/reporte-estado.md)
- [Entornos y credenciales](informes/entornos.md)
- [Lecciones aprendidas](informes/lecciones-aprendidas.md)
- [Guía de funcionamiento del negocio](informes/guia-funcionamiento-pancheria.md)
- [Índice de informes](informes/README.md)

> **Plan de acción cerrado:** el plan de acción de 2026-08-27 fue resuelto y se archivó en `informes/archivados/plan-de-accion-2026-08-27.md`.

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
│   ├── guia-funcionamiento-pancheria.md  # Conceptos de negocio y flujos
│   ├── README.md                 # Índice de informes
│   └── archivados/               # Reportes históricos y planes resueltos
└── prompts/
    ├── pancheria.prompt.md       # Prompt maestro
    ├── README.md                 # Guía para escribir prompts
    ├── auditoria-y-documentacion.md
    ├── auditoria-cobertura-de-pruebas.md
    ├── plan-implementacion-multi-tenant.md
    └── archivados/               # Prompts resueltos
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
