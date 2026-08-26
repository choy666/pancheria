# Informe estratégico — De panchería multisucursal a plataforma para comercios

**Fecha:** 2026-08-26  
**Proyecto:** `pancheria`  
**Contexto:** el proyecto ya funciona como sistema de gestión para una panchería con varias sucursales. El objetivo de este informe es pulir la idea de negocio y definir cómo pasar de un sistema propio a una plataforma que se pueda ofrecer a otros comercios.

---

## 1. Resumen ejecutivo

El proyecto actual es una base sólida para un negocio gastronómico con múltiples sucursales. Tiene un stack moderno, una arquitectura limpia, tests de calidad y funcionalidades que cubren el día a día: ventas, caja, stock, pedidos online, chat con clientes y contenido de video.

Sin embargo, **sucursal ≠ cliente**. Hoy el sistema asume que todas las sucursales pertenecen al mismo dueño y comparten la misma base de datos. Eso está bien para una franquicia o una cadena propia, pero no para venderle el sistema a comercios distintos, donde cada uno es un **tenant** (inquilino) con sus propias sucursales, usuarios, productos, precios, caja y datos.

La idea de "copiar y pegar el proyecto y cambiar variables" es entendible como primer escalón, pero **no es escalable** más allá de 3 o 4 clientes. Más temprano que tarde genera un dolor de cabeza operativo, de seguridad y de mantenimiento.

La recomendación principal es:

1. Terminar de validar el producto actual en una o dos pancherías reales.
2. Antes de ofrecerlo a terceros, decidir el modelo de negocio: ¿franquicia propia, SaaS, licencia por copia o desarrollo a medida?
3. Elegir la arquitectura acorde a ese modelo: **deploy separado por cliente** (corto plazo, pocos clientes) o **plataforma multi-tenant** (mediano plazo, muchos clientes).
4. No improvisar precios, contratos ni soporte: lo que parece "un software" se convierte rápidamente en un servicio que requiere administración de negocio, atención al cliente y continuidad operativa.

---

## 2. Qué tenés hoy: diagnóstico del proyecto

### 2.1 Fortalezas técnicas

- **Stack robusto:** Next.js 16.3.3, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2, PostgreSQL, NextAuth v5 (<ref_file file="C:/developer/paginas/pancheria/package.json" />).
- **Arquitectura limpia:** separación en `app/`, `application/`, `repositories/`, `domain/`, `lib/`, `config/` (<ref_file file="C:/developer/paginas/pancheria/README.md" />).
- **Multi-sucursal implementado:** cada dato de negocio está aislado por `branchId` (<ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />).
- **Roles claros:** `admin` y `operator` con permisos diferenciados.
- **Flujos de negocio funcionales:** ventas, pedidos, chat, caja, cierres diarios, stock, productos con recetas, videos.
- **Configuración por variables de entorno:** sin valores sensibles hardcodeados (<ref_file file="C:/developer/paginas/pancheria/.env.example" />).
- **Cobertura de tests:** más de 1000 tests unitarios y 84 tests E2E planificados (<ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />).

### 2.2 Limitaciones actuales para escalar a otros comercios

- No existe el concepto de **tenant / organización / cliente** en el esquema. La sucursal (`branches`) es la unidad de aislamiento más alta.
- No hay **onboarding automático**: crear un nuevo comercio requiere tocar variables de entorno, base de datos, seed y deploy.
- No hay **facturación, suscripciones ni planes**.
- No hay **panel de administración de tenants** para gestionar múltiples comercios desde un solo lugar.
- No hay **dominios personalizados ni white-label** más allá del número de WhatsApp y variables de entorno.
- El almacenamiento, la base de datos y las credenciales están atados a un único deploy.
- El esquema está pensado para una sola base de datos por negocio; no está preparado para compartir infraestructura entre comercios con aislamiento real.

---

## 3. La confusión natural: franquicia, sucursales y clientes

Es normal confundir estos conceptos al principio. Conviene aclararlos:

| Concepto | Qué representa en el proyecto actual | Qué representaría en una plataforma |
| --- | --- | --- |
| **Franquicia / dueño** | Una persona o empresa que tiene varias sucursales de panchería. | El tenant o cliente que contrata el software. |
| **Sucursal / branch** | Un local físico de la panchería, con sus cajas, operadores y stock. | Una sucursal del cliente, con sus usuarios y operación diaria. |
| **Cliente externo** | Una persona que hace un pedido por la web. | Lo mismo: el consumidor final. |
| **Comercio adopter** | No existe: solo hay una panchería dueña del sistema. | Otro comercio (otra panchería, kiosco, etc.) que usa la plataforma. |

En una plataforma real, la jerarquía sería:

```
Plataforma (tú)
└── Tenant / Comercio (ej. "Panchería Don Pancho")
    └── Sucursal 1
    └── Sucursal 2
    └── Sucursal N
```

El proyecto actual ya tiene la capa de sucursal. Lo que le falta es la capa de tenant.

---

## 4. Modelos de negocio posibles

Antes de decidir la arquitectura hay que decidir qué se quiere vender. No es lo mismo ser franquiciante que ser proveedor de software.

### 4.1 Operador de franquicia (un dueño, varias sucursales)

- Tú sos el dueño de la marca y das el sistema a tus franquiciados.
- El software es una herramienta interna; no es un producto separado.
- La prioridad es control: que el dueño vea todas las sucursales, que los franquiciados operen dentro de la suya y que la marca sea uniforme.
- **Ingreso principal:** royalties, fee de franquicia, ventas, no licencia de software.

### 4.2 SaaS para comercios (software como servicio)

- Vendés acceso mensual a la plataforma a comercios independientes.
- Cada comercio paga por sus usuarios, sucursales o transacciones.
- Tú mantenés el código, la infraestructura, los backups y el soporte.
- **Ingreso principal:** suscripción recurrente, setup fee, soporte premium, comisión por transacción.

### 4.3 Licencia por copia / desarrollo a medida

- Instalás una copia del sistema en la infraestructura de cada cliente.
- Cobrás un fee inicial y después mantenimiento o actualizaciones.
- Cada cliente puede pedir personalizaciones.
- **Ingreso principal:** venta de licencia + servicios de implementación.
- **Riesgo:** si hay 10 clientes con 10 copias distintas, el costo de mantenimiento se multiplica.

### 4.4 Modelo mixto recomendado para empezar

Para un emprendimiento sin muchos recursos iniciales, lo más realista es empezar con una **versión manejada (managed service)**:

- Cobrás una mensualidad por comercio.
- Cada comercio tiene su propio deploy y base de datos (aislamiento total).
- Tú te encargás de deployar, configurar y mantener.
- Esto permite validar el mercado sin invertir de entrada en una plataforma multi-tenant compleja.
- Una vez que tenés, por ejemplo, 5 o 10 clientes pagando recurrentemente, evaluás migrar a multi-tenant.

---

## 5. Opciones técnicas para crecer

### 5.1 Opción A: Deploy separado por cliente ("copiar y pegar" automatizado)

Cada cliente tiene su propia instancia del mismo código, su base de datos y su dominio.

**Ventajas:**

- Aislamiento total de datos: un cliente no puede ver a otro.
- Personalización por cliente sin afectar a los demás.
- No hay que cambiar el modelo de datos actual.
- Fallas de un cliente no afectan a los otros.

**Desventajas:**

- Cada bug fix, mejora o actualización debe aplicarse en N deploys.
- Gestión de variables de entorno, secretos y dominios se vuelve compleja.
- No hay economía de escala: 10 clientes = 10 bases, 10 proyectos en Vercel, 10 conjuntos de credenciales.
- Costos operativos de soporte y mantenimiento crecen linealmente.
- Difícil de escalar a decenas de clientes.

**Cuándo conviene:**

- Para los primeros 1 a 5 clientes.
- Cuando cada cliente pide personalizaciones significativas.
- Cuando aún no está claro el modelo de negocio.

### 5.2 Opción B: Plataforma multi-tenant compartida

Una sola aplicación y una o varias bases de datos compartidas. Cada comercio es un tenant y sus datos se aíslan por `tenantId`.

**Ventajas:**

- Un solo deploy para todos los clientes.
- Actualizaciones y mejoras llegan a todos a la vez.
- Menor costo operativo por cliente a medida que escala.
- Permite un panel central de administración.
- Facilita el onboarding automático y la facturación.

**Desventajas:**

- Mayor complejidad inicial: hay que diseñar el aislamiento de datos, los roles, los límites y la personalización.
- Un error en el código puede exponer datos de varios clientes.
- Requiere inversión en seguridad, observabilidad y backup.
- Las migraciones de base de datos afectan a todos.

**Cuándo conviene:**

- Cuando se tienen 5 o más clientes con necesidades similares.
- Cuando el objetivo es crecer a 20, 50 o 100 comercios.
- Cuando el producto está maduro y estandarizado.

### 5.3 Opción C: Híbrida — plataforma compartida, base de datos aislada por tenant

El mismo código servido desde un deploy, pero cada tenant tiene su propia base de datos (o esquema).

**Ventajas:**

- Aislamiento fuerte de datos.
- Un solo deploy central.
- Personalización de base de datos por cliente.

**Desventajas:**

- Complejidad operativa: conexiones dinámicas a múltiples bases.
- Migraciones más difíciles de coordinar.
- Costo de infraestructura más alto que el multi-tenant puro.

### 5.4 Tabla comparativa

| Criterio | A — Deploy separado | B — Multi-tenant compartido | C — Híbrida |
| --- | --- | --- | --- |
| Aislamiento de datos | Excelente | Bueno, si se diseña bien | Excelente |
| Costo inicial de desarrollo | Bajo | Alto | Muy alto |
| Costo operativo a escala | Alto | Bajo | Medio-alto |
| Tiempo para nuevo cliente | Horas/días | Minutos | Minutos/horas |
| Personalización por cliente | Fácil | Limitada | Media |
| Seguridad | Simple por cliente | Compleja, crítica | Compleja |
| Mantenimiento y updates | N deploys | Uno solo | Uno + N bases |
| Escalabilidad a muchos clientes | Mala | Buena | Media |
| Recomendación | Primeros clientes | Escala real | Clientes grandes o regulados |

---

## 6. Análisis realista del "copiar y pegar"

La frase "copiar y pegar y cambiar variables" suena práctica, pero conviene mirarla con honestidad.

### ¿Qué implica realmente?

Por cada nuevo cliente hay que:

1. Crear un nuevo proyecto en Vercel.
2. Crear una nueva base de datos en Neon.
3. Configurar `DATABASE_URL`, `NEXTAUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dominio, WhatsApp, storage, etc.
4. Ejecutar migraciones y seed.
5. Asignar un dominio o subdominio.
6. Mantener actualizadas las variables en cada deploy.
7. Si surge un bug, aplicar el fix en cada instancia.
8. Si un cliente pide una funcionalidad nueva, decidir si se mergea al core o se queda en esa copia.

Con 3 clientes es manejable. Con 10, ya es un trabajo de operaciones. Con 50, es insostenible.

### Ejemplo cotidiano

Imaginá que descubrís un bug en el cálculo de caja. Con copiar y pegar tenés que:

- Arreglar el código.
- Correr tests.
- Hacer deploy en el cliente 1, cliente 2, cliente 3...
- Verificar que cada deploy salió bien.
- Si un cliente tiene una versión con personalizaciones, el fix puede no aplicarse directamente.

Con una plataforma multi-tenant:

- Arreglás una vez.
- Hacés un solo deploy.
- Todos los clientes reciben el fix.

### Veredicto

El "copiar y pegar" es un **puente**, no un destino. Sirve para aprender, para validar y para facturar los primeros clientes. Pero si el objetivo es crecer, hay que planificar la transición a una plataforma.

---

## 7. Recomendaciones de buenas prácticas de programación

### 7.1 Antes de ofrecer el sistema a otros

- **Congelar el core del producto.** Terminar las funcionalidades esenciales y estabilizar el comportamiento antes de multiplicar instancias.
- **Subir la cobertura de tests E2E.** Hoy quedan flujos sin cubrir: confirmación/cancelación de pedidos desde panel, edición de recetas, rate limit, expiración de pedidos, cierre automático de caja (<ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />).
- **Documentar el proceso de deploy para un cliente nuevo.** Que no dependa de memoria ni de tocar archivos a mano.
- **Automatizar el provisionamiento.** Scripts de CLI (Vercel, Neon) para crear proyectos, bases y variables de entorno. Esto reduce errores y tiempo de onboarding.
- **Separar el código core de las personalizaciones.** Ninguna personalización debe meterse en el repositorio principal si no es reutilizable.
- **Centralizar la configuración.** Hoy muchas cosas son variables de entorno. A futuro, parte de la configuración debería vivir en la base de datos por tenant/sucursal (horarios, mensajes de WhatsApp, colores, límites, etc.).
- **No exponer `localhost` en producción.** Asegurar que `NEXT_PUBLIC_APP_URL` y `NEXTAUTH_URL` apunten al dominio real (<ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />).
- **Usar almacenamiento remoto en producción.** `STORAGE_PROVIDER=local` no sirve en Vercel; usar `vercel-blob`, `s3` o `r2` (<ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />).
- **Implementar observabilidad.** Logging estructurado, monitoreo de errores y alertas antes de tener clientes pagos.
- **Definir una estrategia de backups y recuperación.** Neon tiene PITR, pero hay que saber el RPO/RTO y probar restauraciones.

### 7.2 Si se decide ir a multi-tenant

- **Agregar la tabla `tenants` (o `organizations`).**
- **Agregar `tenantId` a `branches`, `users`, `products`, `sales`, etc.** O, alternativamente, aislar por esquema o base de datos.
- **Crear un flujo de onboarding:** formulario de registro, creación de tenant, sucursal por defecto y usuario administrador.
- **Crear un panel de superadministrador** para gestionar tenants, suspender cuentas, ver métricas y facturación.
- **Implementar límites por plan:** cantidad de sucursales, usuarios, productos, almacenamiento, pedidos.
- **Añadir auditoría y logs de acceso por tenant.** Quién hizo qué y cuándo.
- **Definir un mecanismo de feature flags.** Para probar funcionalidades con ciertos clientes sin afectar a todos.
- **Planear migraciones con cuidado.** En multi-tenant, un error de migración afecta a todos.
- **Mantener tests aislados por tenant.** Que no haya fugas de datos entre clientes en los tests.

---

## 8. Recomendaciones de administración de negocios

### 8.1 Define el producto antes de venderlo

- **¿A quién se lo vendés?** Pancherías, kioscos, food trucks, restaurantes, cafeterías. Cada uno tiene necesidades distintas.
- **¿Qué problema resuelve?** Control de stock, pedidos online, caja, evitar pérdidas, escalar franquicias.
- **¿Cuál es la propuesta de valor?** Más rápido, más barato, más simple que las alternativas existentes.

### 8.2 Modelo de precios realista

Algunos ejemplos comunes en el mercado latinoamericano de software para gastronomía:

| Modelo | Descripción | Ejemplo de precio |
| --- | --- | --- |
| Por sucursal/mes | Cobro fijo mensual por cada local. | USD 30-60 por sucursal/mes. |
| Por usuario/mes | Cobro por cada operador/admin. | USD 10-20 por usuario/mes. |
| Setup fee | Cobro único por configuración inicial. | USD 200-500. |
| Por transacción | Pequeña comisión por pedido o venta. | 1-2% del volumen. |
| Soporte premium | Atención prioritaria, capacitación, personalizaciones. | USD 50-200/mes. |

> **Importante:** los precios son referencias. El precio real depende del país, la competencia, el valor percibido y los costos operativos. No subestimar el costo del soporte.

### 8.3 Contratos y términos

- **Contrato de licencia o servicio:** quién es el dueño de los datos, qué pasa si el cliente se va, cuál es el periodo de aviso.
- **Términos y condiciones:** uso permitido, prohibición de revender, responsabilidades.
- **Política de privacidad:** cómo se manejan los datos de clientes finales (consumidores) y empleados.
- **SLA (Service Level Agreement):** disponibilidad garantizada, tiempos de respuesta de soporte, compensaciones.
- **Propiedad intelectual:** el código es tuyo; el cliente no puede pedir el fuente salvo acuerdo específico.

### 8.4 Cumplimiento legal y fiscal

- **Protección de datos personales:** en Argentina, la Ley 25.326; en Europa, GDPR; en otros países, leyes similares. Si almacenás nombres, teléfonos o direcciones de consumidores, estás sujeto a estas normas.
- **Facturación electrónica:** si el sistema va a emitir comprobantes fiscales, hay que integrar con los organismos correspondientes (AFIP en Argentina, SAT en México, SUNAT en Perú, SII en Chile, etc.).
- **Medios de pago:** si manejás pagos con tarjeta, Mercado Pago, Stripe o similares, hay regulaciones de PCI DSS o equivalentes.
- **Términos de uso para empleados:** claridad sobre quién puede acceder a qué datos.

### 8.5 Operaciones y soporte

- **Documentación para usuarios:** guías de uso, videos cortos, FAQs.
- **Capacitación inicial:** incluirla en el setup fee o venderla aparte.
- **Soporte con niveles:** básico por email/chat, premium con atención en horario comercial.
- **Respuesta ante incidentes:** plan de contingencia si se cae la plataforma, si falla un pago, si hay un bug crítico.
- **Comunicación con clientes:** avisos de mantenimiento, cambios, nuevas funcionalidades.

### 8.6 Finanzas y crecimiento

- **Cash flow:** el SaaS requiere paciencia. Los ingresos son recurrentes pero bajos al principio.
- **Costo de adquisición de clientes (CAC):** cuánto te cuesta conseguir un cliente y cuánto te paga en promedio (LTV).
- **Churn:** la tasa de clientes que se van mensualmente. Un churn del 5% mensual es alto.
- **No personalices gratis:** cada pedido especial sin costo te roba tiempo y complica el producto.
- **Métricas clave:** MRR (ingreso recurrente mensual), cantidad de clientes activos, tickets de soporte por cliente, uptime.

---

## 9. Hoja de ruta sugerida

### Fase 0 — Validación local (1-2 meses)

- Operar el sistema en una o dos pancherías reales.
- Recoger feedback de operadores y dueños.
- Corregir bugs y pulir flujos críticos.
- Terminar cobertura E2E de flujos pendientes.
- Definir el modelo de negocio.

### Fase 1 — Producto base estandarizado (1-2 meses)

- Refactorizar configuraciones sensibles a la base de datos (no solo env vars).
- Agregar white-label básico: logo, color, dominio, mensajes de WhatsApp.
- Crear documentación de deploy y un script de provisionamiento.
- Definir precios, contratos y soporte.
- Preparar un demo o entorno de prueba gratuito.

### Fase 2 — Primeros clientes con deploy separado (3-6 meses)

- Vender a 3-5 comercios.
- Usar deploys separados y bases de datos separadas.
- Automatizar la creación de nuevos clientes con scripts.
- Medir churn, soporte y rentabilidad.
- Acumular casos de uso reales.

### Fase 3 — Plataforma multi-tenant (6-12 meses)

- Diseñar e implementar el modelo de tenants.
- Migrar clientes existentes o atraer nuevos a la plataforma compartida.
- Construir panel de superadministración y facturación.
- Implementar planes, límites y onboarding automático.
- Escalar infraestructura y observabilidad.

### Fase 4 — Escalar (continuo)

- Integraciones: facturación electrónica, medios de pago, delivery, contabilidad.
- Marketplace de funcionalidades.
- API pública para integraciones de terceros.
- App móvil para operadores.

---

## 10. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Copiar y pegar se vuelve inmanejable | Alta a mediano plazo | Alto | Planear la transición a multi-tenant desde el inicio. |
| Fuga de datos entre clientes | Baja si se diseña bien | Muy alto | Aislamiento estricto, tests de seguridad, auditorías. |
| Clientes piden personalizaciones sin fin | Alta | Medio | Política clara de personalización, cobro por desarrollo a medida. |
| Costos de infraestructura crecen más que ingresos | Media | Alto | Modelo de precios que escale con el uso, monitoreo de costos. |
| Dependencia de Neon / Vercel | Media | Medio | Tener plan de salida, backups, monitoreo de límites de plan. |
| Soporte consume todo el tiempo | Alta | Alto | Documentación, capacitación, FAQs, soporte escalonado. |
| Bugs críticos en producción | Media | Muy alto | Tests, CI/CD, observabilidad, rollback rápido. |
| Cumplimiento legal no resuelto | Media | Alto | Consultar con abogado, revisar regulaciones locales. |
| Competencia con soluciones más maduras | Alta | Medio | Diferenciarse por nicho (pancherías, simplicidad, precio). |

---

## 11. Decisiones que tenés que tomar ahora

Antes de seguir, conviene responder estas preguntas con honestidad:

1. **¿Querés vender software o construir una franquicia?**
   - Si querés franquicia, el sistema es una herramienta interna; el negocio es la marca.
   - Si querés vender software, el negocio es la plataforma.

2. **¿Cuántos clientes esperás tener en 12 meses?**
   - 1-5: deploy separado es razonable.
   - 10 o más: conviene planear multi-tenant.

3. **¿Qué tan iguales son esos comercios?**
   - Si todos son pancherías con el mismo flujo, multi-tenant es más fácil.
   - Si cada uno pide cosas distintas, deploy separado o personalizaciones por tenant.

4. **¿Cuánto podés invertir en desarrollo antes de facturar?**
   - Multi-tenant requiere más tiempo y dinero antes del primer cliente.
   - Deploy separado permite empezar a cobrar más rápido.

5. **¿Quién se encarga del soporte, deploy y operación?**
   - Si sos solo, el deploy separado te puede consumir.
   - Si tenés equipo, se puede automatizar.

6. **¿En qué país operarán los clientes?**
   - Esto define obligaciones fiscales, de datos y facturación.

---

## 12. Conclusión

El proyecto `pancheria` es un excelente primer escalón: ya tiene una base técnica sólida, una arquitectura limpia y funcionalidades que resuelven problemas reales de una panchería con sucursales. La pregunta ahora no es si el código funciona, sino **qué modelo de negocio querés construir sobre ese código**.

La idea de "copiar y pegar" no es mala en sí misma: es una forma económica de empezar y aprender. Pero **no es un plan de negocio sostenible** si la ambición es crecer. Más allá de unos pocos clientes, el costo operativo y el riesgo de errores superan los beneficios.

La recomendación es:

- **Corto plazo:** terminá de validar el producto, vendé a los primeros clientes con deploys separados y automatizá todo lo que puedas.
- **Mediano plazo:** diseñá una plataforma multi-tenant con concepto de tenant/organización, onboarding, planes, facturación y panel de administración.
- **Continuo:** tratá el producto como un servicio, no como un software entregado una vez. Eso implica soporte, documentación, legal, finanzas y una operación clara.

El sistema ya es bueno. El siguiente paso es convertirlo en un negocio.

---

## 13. Enlaces relevantes

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/plan-de-accion-pendientes.md" />
