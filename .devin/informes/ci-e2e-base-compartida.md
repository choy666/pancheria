# Ticket — CI E2E: dos runs concurrentes comparten la misma base

**Origen:** observado durante el merge de `fix/e4-orphan-branch`
(2026-09-22). No es un bug de producto; es un defecto de aislamiento del
pipeline que produce falsos rojos.

## Evidencia

- El job E2E del PR #3 falló con `1 failed + 3 flaky` entre 11:52 y 11:58
  UTC (login del operador seed que no redirigía, `Pan` ausente en stock,
  asserts 201 que devolvían otros códigos).
- El re-run falló a las 12:05 UTC con `deadlock detected` en el
  `global-setup` (truncate `RESTART IDENTITY CASCADE`).
- El job E2E del PR #4 corrió en paralelo de **11:50 a 12:10 UTC** sobre
  la **misma** base (`E2E_DATABASE_URL`, Neon remota).
- El segundo re-run del PR #3 (12:07→12:23 UTC, solape mínimo con el
  cierre del job de PR #4) pasó completo.

## Mecanismo

Dos workflows activos ejecutan `global-setup.ts` contra la misma base:
`TRUNCATE ... RESTART IDENTITY CASCADE` + re-seed compiten entre sí y con
los tests en curso del otro run → deadlocks de PostgreSQL y datos que
aparecen/desaparecen a mitad de un test (de ahí los flaky y el 1 failed).
El sharding por secrets (`E2E_DATABASE_URL_SHARD<N>`) aísla shards dentro
de un run, pero **no** runs/PRs concurrentes entre sí.

## Reproducción

Determinista: abrir dos PRs que disparen el job E2E en la misma ventana,
o re-lanzar un job fallido mientras otro run E2E está activo. Ambos usan
la misma `E2E_DATABASE_URL` → se pisan.

## Propuesta (sin implementar)

Opciones, en orden de costo:

1. `concurrency` en el job E2E del workflow
   (`concurrency: { group: e2e-db, cancel-in-progress: false }`):
   serializa los jobs que usan la base compartida. Barato; penaliza
   tiempo total de CI cuando hay varios PRs abiertos.
2. Base por run: crear una base Neon efímera por `github.run_id`
   (branch efímero de Neon) y destruirla al finalizar. Elimina el falso
   rojo por completo; requiere API key de Neon como secret y un step de
   provisioning (~30 s).
3. Mantener el status quo y reintentar manualmente — aceptable mientras
   la frecuencia de PRs simultáneos sea baja, pero cada falso rojo cuesta
   ~15 min de investigación.

Recomendación: opción 1 ahora (una línea de YAML) y evaluar la 2 si los
PRs concurrentes se vuelven habituales.
