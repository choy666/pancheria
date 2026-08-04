# Notas para Agentes — Proyecto Panchería

## Idioma
Todas las explicaciones, comentarios y documentación deben estar en español.

## Seguridad
- No hardcodear credenciales, URLs de APIs ni parámetros sensibles en el código.
- Todos los valores sensibles deben provenir de variables de entorno o configuraciones dinámicas.

## Comandos principales

| Propósito                | Comando                                           |
| ------------------------ | ------------------------------------------------- |
| Instalar dependencias    | `npm install`                                     |
| Ejecutar en desarrollo   | `npm run dev`                                     |
| Compilar                 | `npm run build`                                   |
| Lint                     | `npm run lint`                                    |
| Tests unitarios          | `npm test`                                        |
| Tests E2E                | `npx playwright test`                             |
| Generar migraciones      | `npx drizzle-kit generate`                        |
| Empujar migraciones      | `npx drizzle-kit push`                            |
| Ejecutar seed            | `npx tsx src/db/seeds.ts`                         |

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar:

- `DATABASE_URL` — URL de conexión a PostgreSQL (Neon).
- `NEXTAUTH_URL` — URL base de la app, por defecto `http://localhost:3000`.
- `NEXTAUTH_SECRET` — secreto para sesiones de NextAuth.
- `ADMIN_USERNAME` — usuario administrador único.
- `ADMIN_PASSWORD` — contraseña en texto plano; el seed la hashea con bcrypt.

## Configuración del blueprint de Devin
- El blueprint para el snapshot de Devin vive en `.devin/environment.yaml`.
- Para subirlo a Devin Cloud se requiere autenticación con `devin.exe auth login` y un repositorio en GitHub.
- El flujo de DRS es:
  1. `devin.exe cloud drs blueprint-create --repo <owner/repo> --from-file .devin/environment.yaml`
  2. `devin.exe cloud drs build`

## Notas del plan
- Ver `PLAN.md` para la arquitectura, esquema de base de datos, endpoints y fases de implementación.
- Tecnologías: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM, PostgreSQL, NextAuth v5.

## Despliegue en Vercel
1. Conectar el repositorio de GitHub en el dashboard de Vercel.
2. Configurar las variables de entorno en Vercel:
   - `DATABASE_URL`
   - `NEXTAUTH_URL` (la URL de producción, por ejemplo `https://pancheria-five.vercel.app`)
   - `NEXTAUTH_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
3. Ejecutar `npx drizzle-kit push` en producción para sincronizar el schema.
4. Ejecutar `npx tsx src/db/seeds.ts` para crear el usuario admin y datos iniciales.
5. Hacer push a `main` para que Vercel haga el deploy automático.
