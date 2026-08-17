# `.devin` — Configuración, prompts e informes del proyecto Panchería

Este directorio agrupa la configuración del entorno de Devin, los prompts reutilizables y los informes del proyecto `pancheria`.

## Punto de entrada para cualquier tarea

- [Prompt maestro — Proyecto Panchería](prompts/pancheria.prompt.md)
- [Guía de escritura de prompts](prompts/README.md)
- [Prompt de auditoría y documentación](prompts/auditoria-y-documentacion.md)

## Estado del proyecto

- [Reporte de estado vigente](informes/reporte-estado.md)
- [Lecciones aprendidas](informes/lecciones-aprendidas.md)
- [Guía de funcionamiento del negocio](informes/guia-funcionamiento-pancheria.md)
- [Índice de informes](informes/README.md)

## Configuración del entorno

- [Blueprint para Declarative Repo Setup (DRS)](environment.yaml)

## Estructura

```
.devin/
├── environment.yaml              # Blueprint de snapshot para Devin Cloud
├── README.md                     # Este índice
├── informes/
│   ├── reporte-estado.md         # Informe de estado vigente (único)
│   ├── lecciones-aprendidas.md   # Resumen transversal de lecciones
│   ├── guia-funcionamiento-pancheria.md  # Conceptos de negocio y flujos
│   ├── plan-cobertura-pedidos-2026-08-17.md  # Plan de implementación
│   ├── reporte-auditoria-pedidos-sucursal-cliente-2026-08-17.md
│   └── archivados/               # Reportes históricos
├── prompts/
│   ├── pancheria.prompt.md       # Prompt maestro
│   ├── README.md                 # Guía para escribir prompts
│   ├── auditoria-y-documentacion.md
│   ├── recomendaciones-pedidos-sucursal-stock.md
│   ├── errores-deploy-vercel-forbidden-react-441.md
│   └── archivados/               # Prompts de funcionalidades resueltas
```

## Reglas de uso

1. **Idioma español** para toda explicación, comentario y documentación.
2. **No hardcodear** credenciales, URLs de APIs ni secretos.
3. **Prompts activos** reflejan el estado actual; los **prompts archivados** son contexto histórico y pueden tener referencias a líneas desfasadas.
4. **Un único `reporte-estado.md` vigente**: generar un nuevo informe editando este archivo; si se requiere histórico, archivar el anterior en `informes/archivados/`.
5. Antes de tocar código, leer `AGENTS.md`, `lecciones-aprendidas.md` y `guia-funcionamiento-pancheria.md`.
6. Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build` antes de dar por terminada una tarea.

## Documentación externa

- [AGENTS.md](../AGENTS.md)
- [README.md del proyecto](../README.md)
- [.env.example](../.env.example)
