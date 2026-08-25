# Reporte de estado — Auditoría completa de documentación vigente

**Fecha:** 2026-08-25  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se realizó una auditoría completa de la documentación vigente (`.devin`, `README.md`, `AGENTS.md`, `.env.local`, `.env.example`, prompts e informes) y del código fuente, siguiendo el checklist de `.devin/prompts/auditoria-y-documentacion.md`. Se ejecutaron las verificaciones de calidad: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip`, todos con éxito. Se detectaron inconsistencias entre documentación y código, algunas ya corregidas. No se ejecutó `npm run test:e2e` ni `npx drizzle-kit push/check` por requerir una base de datos descartable y confirmación explícita.

---

## 2. Alcance verificado

| Área | Estado | Evidencia |
|------|--------|-----------|
| `README.md` | Estable | Coincide con `package.json` y la estructura del proyecto. |
| `AGENTS.md` | Corregido | Se agregó `AUTH_SECRET` a la lista de variables de entorno. |
| `.env.example` | Corregido | Se agregaron valores sugeridos para `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` y `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING`. |
| `.env.local` | Revisado | Contiene secretos; `.gitignore` lo excluye. Se recomienda rotar si se expuso. |
| `.devin/environment.yaml` | Revisado | Se corrigió la lista de tablas truncadas en E2E. El bloque `initialize` con `uses: github.com/actions/setup-node@v4` requiere verificación contra el esquema DRS. |
| `.devin/informes/lecciones-aprendidas.md` | Corregido | Se actualizaron observaciones obsoletas sobre rate limit de chat/leido, fallback `?content=` y `getLocalBaseUrl()`. |
| `.devin/informes/plan-de-accion-pendientes.md` | Actualizado | Se corrigió el estado de `knip.json` y la propuesta de archivo inexistente. |
| Código fuente | Corregido | Se eliminaron los defaults hardcodeados de `getPublicBaseUrl()` (protege producción con error) y `getWhatsAppMessageParts()` (lee variables de entorno). `jest.setup.ts` provee `NEXTAUTH_URL` para tests. |
| Verificaciones | Pasan | `lint`, `tsc`, `test` (92/890), `build` (42 páginas dinámicas), `knip`. |

---

## 3. Hallazgos y acciones correctivas

| Gravedad | Hallazgo | Acción |
|----------|----------|--------|
| Mayor / Documentación | `.devin/informes/lecciones-aprendidas.md` contenía observaciones obsoletas: `POST /api/public/pedido/[id]/chat/leido` sin rate limit, fallback `?content=` en chat y referencia a `getLocalBaseUrl()`. | Se actualizaron las lecciones con el estado real del código. |
| Mayor / Documentación | `AGENTS.md` no documentaba `AUTH_SECRET`, aunque `auth.config.ts`, `.env.example` y `.env.e2e.example` lo soportan. | Se agregó `AUTH_SECRET` a la lista de variables de entorno. |
| Mayor / Configuración | `.devin/environment.yaml` no fue verificado con `devin.exe cloud drs build` porque `devin.exe auth login` no está configurado. El bloque `uses: github.com/actions/setup-node@v4` es válido según la documentación oficial de DRS (soporta GitHub Actions en blueprints), pero el build real sigue siendo necesario. | Pendiente: autenticarse y ejecutar `devin.exe cloud drs build`. Se corrigió la lista de tablas truncadas en E2E. |
| Menor / Documentación | El `reporte-estado.md` anterior afirmaba que `src/db/seeds.ts` fue eliminado de `knip.json`; el archivo aún lo incluye y `package.json`/CI no lo referencian como punto de entrada. | Se actualizó el plan de acción y el informe; se mantiene la entrada en `knip.json` hasta decidir si es realmente redundante. |
| Menor / Documentación | `plan-de-accion-pendientes.md` proponía eliminar `.devin/informes/archivados/plan-implementacion-chat-2026-08-23.md`, que no existe. | Se corrigió el plan; el archivo ya fue eliminado o nunca existió en esta ruta. |
| Menor / Código | `src/lib/public-url.ts` tenía el fallback `http://localhost:3000` hardcodeado; `src/config/catalog.ts` tenía mensajes de WhatsApp default hardcodeados. | Se refactorizó `getPublicBaseUrl()`: en producción lanza error si falta `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL`; en desarrollo/test permite fallback a `http://${HOST}:${PORT}` o `http://localhost:3000` con warning. Se refactorizó `getWhatsAppMessageParts()` para leer las variables sin defaults; los valores sugeridos pasaron a `.env.example`. |
| Menor / Código | `src/db/seeds.ts` define `DEFAULT_BRANCH_NAME = process.env.DEFAULT_BRANCH_NAME ?? 'Sucursal por defecto'`. | El fallback duplica el valor de `.env.example`; se recomienda requerir la variable en lugar de hardcodear un default. |
| Informativo / Seguridad | `.env.local` contiene secretos reales. | Verificar que no se haya compartido y rotar si es necesario. `.gitignore` lo excluye correctamente. |
| Informativo | CI usa Node.js 22 mientras `.devin/environment.yaml` y `README.md` indican Node.js 20 LTS. | No es un error; 20 es el mínimo documentado, 22 es compatible. |
| Informativo | `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` está en `.env.example` pero no en `AGENTS.md`. | Se puede agregar a `AGENTS.md` si se considera parte de la documentación principal. |

---

## 4. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 92 suites, 890 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (42 páginas dinámicas) |
| 5 | `npm run knip` | Sin problemas (exit 0) |
| 6 | `npm run test:e2e` | No ejecutado (requiere `.env.e2e` y base descartable). |

---

## 5. Recomendaciones

1. **Verificar `environment.yaml` con DRS.** Autenticarse con `devin.exe auth login` y ejecutar `devin.exe cloud drs build`. El uso de `uses: github.com/actions/setup-node@v4` es válido según la documentación oficial de DRS, pero solo un build real confirma que el blueprint funciona.
2. **Correr E2E en base descartable.** Configurar `.env.e2e` y ejecutar `npm run test:e2e` para validar flujos críticos.
3. **Revisar archivos archivados.** Confirmar la eliminación segura de `.devin/informes/archivados/plan-implementacion-chat-2026-08-23.md` (ya no existe) y limpiar referencias obsoletas.
4. **Sincronizar `.devin`.** Usar el checklist de `auditoria-y-documentacion.md` con cada cambio arquitectónico.
5. **Rotar secretos si `.env.local` se expuso.** Cambiar `NEXTAUTH_SECRET`/`AUTH_SECRET`, `ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN` y credenciales de Neon.
6. **Actualizar `.env.local` con los nuevos defaults de WhatsApp.** Si se desea conservar el saludo/cierre en desarrollo, copiar los valores sugeridos de `.env.example` a `.env.local`.

---

## 6. Enlaces relevantes

- `AGENTS.md` — notas para agentes.
- `.devin/informes/lecciones-aprendidas.md` — lecciones transversales.
- `.devin/informes/plan-de-accion-pendientes.md` — plan de acción actualizado.
- `.devin/environment.yaml` — blueprint de Devin.
- `.env.example` — plantilla de variables de entorno.
