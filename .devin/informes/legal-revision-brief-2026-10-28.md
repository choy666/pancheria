**Estado:** abierto (2026-10-28).

# Brief para revisión legal — página pública de pedidos

Material de trabajo para un profesional del derecho (Argentina). No es un
dictamen: releva qué textos legales muestra hoy la aplicación, qué datos
recolecta y dónde están los puntos que necesitan validación. El objetivo es
que la revisión sea rápida y barata: todo está citado con su ubicación.

## 1. Qué muestra hoy la aplicación (inventario)

### Pie de página público (`src/components/publico/public-footer.tsx`, sección "Legal")

- **"Términos y condiciones"** y **"Política de privacidad"**: enlaces que solo
  aparecen si el dueño carga `terms_url` / `privacy_url` en `/pedido-config`.
  **Hoy producción no tiene ninguno cargado** → no existen esos documentos.
- **"Botón de arrepentimiento"**: enlaza a `/pedido/seguimiento`, donde el
  cliente puede cancelar su pedido **solo mientras está pendiente** (una vez
  aceptado por el local ya no se puede cancelar desde la web).
- **"Defensa del consumidor"**: enlaza al reclamo oficial
  (`src/config/legal.ts` → `CONSUMER_DEFENSE_URL`).
- **CUIT y razón social**: se muestran solo si el dueño los carga (hoy vacíos).
- **Dos leyendas de protección de datos** (ver §4.a: están parafraseadas).
- **"Acceso para el personal"** → `/login`; copyright `© {año} {nombre legal o marca}`.

### Nota de aceptación en el checkout (`src/components/pedido/checkout-legal-note.tsx`)

> "Al confirmar aceptás los Términos y condiciones y la Política de privacidad.
> Usamos tus datos para gestionar tu pedido y coordinarlo con la sucursal."

Solo se muestra si hay URLs cargadas. Aceptación implícita (sin casilla).

### Cancelación pública

La API (`/api/public/pedido/[id]/cancelar`) permite cancelar **únicamente**
pedidos en estado `pending`, con el token del pedido. Pedidos aceptados o en
preparación no se cancelan por la web (queda el chat para hablar con el local).

## 2. Datos personales que recolecta la app

| Dato | Dónde | Finalidad |
| --- | --- | --- |
| Nombre y apellido (`orders.customer_name`) | formulario de pedido | identificar el pedido |
| Teléfono (`orders.customer_phone`, obligatorio) | formulario | coordinar entrega/aviso |
| Dirección (`orders.address`, opcional) | formulario, solo delivery | entrega |
| Coordenadas exactas (`orders.delivery_location`, lat/lng del pin, **obligatorio** en delivery desde migración 0043) | mapa del checkout | llevar el pedido al punto exacto |
| Notas libres (`orders.notes`) | formulario | indicaciones del cliente |
| Mensajes y adjuntos del chat (imágenes/archivos, `sender_name`, `attachment_name`) | chat del pedido | comunicación con el local |
| IP (`public_order_rate_limits.ip`, `login_attempts`) | rate limit antiabuso | seguridad |
| Pedido completo: items, total, estado, timestamps | base | operación y comprobantes |

No hay cookies propias en el flujo público (el chat usa token en la URL). Los
empleados sí usan cookie de sesión (login del panel).

**Encargados/terceros que procesan datos:** Neon (PostgreSQL sobre AWS,
us-east-1, EE. UU.), Vercel (hosting, EE. UU.), el almacenamiento de adjuntos
(Vercel Blob u otro `STORAGE_PROVIDER`) y, si el local cobra online, el medio
de pago correspondiente. → transferencia internacional de datos (ver §4.f).

## 3. Marco normativo probablemente aplicable (a confirmar)

- **Ley 24.240** (Defensa del Consumidor) y su decreto reglamentario 1798/94
  (art. 10: identificación del proveedor en ofertas electrónicas).
- **Art. 34 ter de la Ley 24.240** + **Resolución 424/2020** de la Secretaría
  de Comercio Interior: derecho de arrepentimiento (10 días) y obligación del
  "botón de arrepentimiento" destacado en ventas por medios electrónicos.
  Excepciones del propio art. 34 ter (bienes perecederos, personalizados,
  higiene) a evaluar para comida preparada.
- **Ley 25.326** (Protección de Datos Personales): consentimiento e información
  al recolectar (art. 5-6), derechos del titular, deber de seguridad (art. 9),
  transferencia internacional (art. 12) y la **Disposición 10/2015 de la AAIP**,
  que fija textos modelo para las leyendas de acceso y autoridad de control.
- Régimen fiscal/facturación: la app no emite comprobante fiscal; confirmar que
  el local lo emite por otro canal.

## 4. Puntos concretos a revisar (hallazgos)

**a. Leyendas de la AAIP parafraseadas.** La Disposición 10/2015 provee textos
modelo que conviene usar **textualmente**. Los actuales (en
`src/config/legal.ts`) están resumidos. Texto modelo a validar:

> "El titular de los datos personales tiene la facultad de ejercer el derecho
> de acceso a los mismos en forma gratuita a intervalos no inferiores a seis
> meses, salvo que se acredite un interés legítimo al efecto conforme lo
> establecido en el artículo 14, inciso 3 de la Ley N° 25.326."
>
> "La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de
> Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y
> reclamos que se interpongan con relación al incumplimiento de las normas
> sobre protección de datos personales."

**b. "Botón de arrepentimiento": ubicación y alcance.** Hoy es un enlace en el
pie hacia `/pedido/seguimiento`. La Resolución 424/2020 exige un acceso
"destacado" para revocar la aceptación dentro de los 10 días. Preguntas:
¿alcanza con el pie o debe figurar también en el encabezado/home? ¿Aplica el
derecho a comida preparada/perecedera (excepciones del art. 34 ter) o el botón
debe aclarar que la cancelación web solo cubre pedidos pendientes? ¿Debe
existir un canal de confirmación acreditando que el arrepentimiento se recibió
(hoy queda el estado "cancelado" en el seguimiento)?

**c. Aceptación implícita en el checkout.** "Al confirmar aceptás…" sin casilla
(browsewrap). ¿Conviene un checkbox "Acepto los Términos y la Política de
privacidad" para robustecer el consentimiento (art. 5 de la Ley 25.326)?

**d. Faltan los documentos.** `terms_url` y `privacy_url` están vacíos: la app
ya prevé mostrarlos pero el contenido no existe. Anexo §5 con bosquejos.

**e. Sin política escrita de cancelación y reembolso.** El sistema solo permite
cancelar pedidos pendientes; no hay texto que informe al cliente cuándo puede
cancelar, cómo se devuelve el dinero ni plazos. Va en los Términos.

**f. Transferencia internacional de datos.** Base y hosting fuera del país
(Neon/AWS y Vercel, EE. UU.). La política debe declararlo (art. 12 Ley 25.326)
y se recomienda mencionar los encargados.

**g. IP guardada** en rate limits e intentos de login → declarar como medida
de seguridad en la política.

**h. Adjuntos del chat.** El cliente puede subir imágenes/archivos: declarar el
almacenamiento y, si se desea, prohibición de contenido sensible en los Términos.

**i. Ubicación exacta obligatoria en delivery.** Se guarda lat/lng del pin.
Declarar finalidad y conservación; evaluar si el aviso debe mostrarse en el
momento del pedido y no solo en la política.

**j. Menores.** El pedido no exige mayoría de edad. Confirmar si corresponde
una cláusula (datos de menores en base de datos).

## 5. Checklist para el profesional

1. ¿Los textos AAIP deben ir literalmente como el modelo (§4.a)?
2. ¿El botón de arrepentimiento cumple con Res. 424/2020 en el pie, o debe ir
   destacado en el primer acceso? ¿Redacción exacta dada la excepción de
   perecederos?
3. ¿Checkbox de aceptación expresa en el checkout? (§4.c)
4. Validar/completar los borradores del anexo (Términos + Privacidad).
5. ¿Declaración de transferencia internacional suficiente como cláusula?
6. ¿Alguna obligación provincial/municipal adicional (direcciones de defensa
   del consumidor de la provincia además de la nacional)?
7. ¿Hace falta registro de la base de datos o declaración ante AAIP? (hoy la
   inscripción de bases cambió; confirmar criterio vigente)

## Anexo A — Bosquejo de Términos y Condiciones (borrador)

```
TÉRMINOS Y CONDICIONES DE USO — [NOMBRE DE LA MARCA / PANCHERIA POPULAR]

1. Titular. [RAZÓN SOCIAL], CUIT [CUIT], domicilio [DOMICILIO LEGAL], correo
   [EMAIL]. El servicio es operado por las sucursales listadas en el sitio.
2. Objeto. El sitio permite consultar el catálogo, realizar pedidos online
   para retiro o delivery, seguir su estado y comunicarse con la sucursal.
3. Precios y medios de pago. Los precios se publican en pesos argentinos e
   incluyen IVA. Medios de pago aceptados: [LISTAR]. El cobro se realiza
   [en la sucursal/al recibir/online a través de ___].
4. Pedidos. El pedido queda sujeto a confirmación de la sucursal, que puede
   rechazarlo (por disponibilidad, zona de entrega u horario) avisando por
   los medios de contacto declarados.
5. Delivery. Disponible dentro de la zona y horarios publicados por cada
   sucursal. El cliente debe marcar el punto de entrega en el mapa; la
   sucursal no responde por direcciones o ubicaciones incorrectas.
6. Cancelación. El cliente puede cancelar gratis desde el sitio mientras el
   pedido figure "pendiente". Una vez aceptado o en preparación, la
   cancelación queda a criterio de la sucursal a través del chat del pedido.
7. Derecho de arrepentimiento (Ley 24.240, art. 34 ter). [A DEFINIR CON EL
   PROFESIONAL: alcance aplicable a comida preparada y procedimiento, con
   el botón habilitado en el sitio.]
8. Reembolsos. [A DEFINIR: condiciones, medio y plazo de devolución.]
9. Datos personales. El tratamiento se rige por la Política de Privacidad
   [ENLACE].
10. Responsabilidad. [Límites habituales: disponibilidad del servicio,
    exactitud del catálogo, fuerza mayor.]
11. Contenido del usuario. Se prohíbe enviar contenido ilícito o sensible en
    notas, chat y adjuntos.
12. Legislación y jurisdicción. Ley argentina; fuero del domicilio del
    consumidor (Ley 24.240).
13. Contacto. [EMAIL] — Defensa del Consumidor: enlace oficial incluido en
    el pie del sitio.
```

## Anexo B — Bosquejo de Política de Privacidad (borrador)

```
POLÍTICA DE PRIVACIDAD — [NOMBRE DE LA MARCA / PANCHERIA POPULAR]

1. Responsable. [RAZÓN SOCIAL], CUIT [CUIT], domicilio [DOMICILIO], correo de
   contacto para datos personales: [EMAIL].
2. Datos que recolectamos: nombre, teléfono, dirección de entrega (opcional),
   ubicación exacta de entrega cuando corresponde a delivery, contenido del
   pedido, mensajes y adjuntos del chat, y dirección IP por motivos de
   seguridad. No recolectamos datos sensibles.
3. Finalidad: gestionar y entregar el pedido, comunicar su estado, atender
   reclamos y prevenir abusos del servicio. No se usan los datos para
   publicidad ni se venden a terceros.
4. Base del tratamiento: ejecución del pedido y consentimiento del titular
   (Ley 25.326, art. 5).
5. Destinatarios y encargados: la sucursal que procesa el pedido y los
   proveedores de infraestructura (base de datos y alojamiento en
   servidores de [AWS/Neon] y [Vercel], ubicados fuera del país; el
   almacenamiento de adjuntos en [PROVEEDOR]; [medio de pago si aplica]).
   Esto implica transferencia internacional de datos (art. 12, Ley 25.326),
   que el titular acepta al usar el servicio.
6. Conservación: los pedidos se conservan [PLAZO — p. ej. por obligaciones
   fiscales/comerciales]; los chats quedan de solo lectura al expirar y se
   conservan con el pedido.
7. Derechos: acceso, rectificación, actualización y supresión escribiendo a
   [EMAIL]. + leyendas AAIP del §4.a de este brief.
8. Seguridad: medidas técnicas y organizativas razonables; acceso al pedido
   por token único en el enlace de seguimiento/chat.
9. Menores: [A DEFINIR con el profesional].
10. Cambios de esta política: se publicarán en el sitio.
11. Autoridad de control: Agencia de Acceso a la Información Pública
    (leyendas §4.a).
```

## Próximos pasos sugeridos

1. El profesional valida §4 y completa los borradores de los anexos.
2. Una vez aprobados, puedo cargar los textos como páginas internas
   (`/legal/terminos` y `/legal/privacidad`) o en los campos de URL de
   `/pedido-config` — hoy son configurables por el dueño.
3. Si el profesional pide cambios de UI (checkbox de aceptación, botón de
   arrepentimiento destacado en el encabezado, textos AAIP verbatim), los
   implemento: son cambios chicos en `public-footer.tsx`,
   `checkout-legal-note.tsx` y `legal.ts`.
