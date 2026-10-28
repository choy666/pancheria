**Estado:** abierto (revisado y corregido el 2026-10-28 contra el código y
las normas citadas en InfoLeg/Boletín Oficial).

# Brief para revisión legal — página pública de pedidos

Material de trabajo para un profesional del derecho (Argentina). No es un
dictamen: releva qué textos legales muestra hoy la aplicación, qué datos
recolecta y dónde están los puntos que necesitan validación. El objetivo es
que la revisión sea rápida y barata: todo está citado con su ubicación.

## 1. Qué muestra hoy la aplicación (inventario)

### Pie de página público (`src/components/publico/public-footer.tsx`, sección "Legal")

- **"Términos y condiciones"** y **"Política de privacidad"**: enlaces que solo
  aparecen si el dueño carga `terms_url` / `privacy_url` en `/pedido-config`.
  **Hoy producción no tiene ninguno cargado** (verificado 2026-10-28: la tabla
  `brand_settings` está vacía) → no existen esos documentos.
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
| Ubicación exacta de entrega (`orders.delivery_location`: URL canónica de mapa con las coordenadas del pin; **obligatoria en delivery** — la exige la validación del checkout, la columna existe desde la migración 0043) | mapa del checkout | llevar el pedido al punto exacto |
| Notas libres (`orders.notes`) | formulario | indicaciones del cliente |
| Mensajes y adjuntos del chat (imágenes/archivos, `sender_name`, `attachment_name`) | chat del pedido | comunicación con el local |
| IP (`public_order_rate_limits.ip`) | rate limit antiabuso del pedido público | seguridad |
| Usuario intentado en cada login fallido (`login_attempts.username`, se guarda aunque el usuario no exista) | rate limit del panel | seguridad |
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
- **Art. 34 de la Ley 24.240** + **art. 1110 del Código Civil y Comercial**:
  derecho de arrepentimiento (10 días) en contratos celebrados a distancia.
  Excepciones: art. 1116 CCyC (entre ellas, cosas perecederas salvo pacto en
  contrario) a evaluar para comida preparada.
- **Disposición 954/2025** de la Subsecretaría de Defensa del Consumidor y
  Lealtad Comercial (BO 04/09/2025, InfoLeg 417152), norma vigente que
  **derogó las Resoluciones 316/2018 y 424/2020**: exige un link "BOTÓN DE
  ARREPENTIMIENTO" a simple vista, en lugar destacado y **en el primer
  acceso**, sin registración previa ni trámites adicionales (art. 1°); exime
  expresamente la **adquisición de productos perecederos** (art. 3° d) y
  demás supuestos del art. 1116 CCyC (art. 3° a); obliga a informar en 24 h y
  por el mismo medio un código de registración de la petición (art. 5°); y
  regula la atención al consumidor: canal de consultas/reclamos publicado en
  la web y horario de atención no inferior al de operación comercial — 8 h
  diarias de lunes a viernes si es exclusivamente electrónica (art. 6°). El
  art. 4° (botón de baja de servicio) aplica a servicios, no a venta de
  bienes. Plazo de adecuación del art. 8° (60 días) ya vencido.
- **Ley 25.326** (Protección de Datos Personales): consentimiento e información
  al recolectar (art. 5-6), derechos del titular, deber de seguridad (art. 9),
  transferencia internacional (art. 12) y la **Disposición 10/2008 de la
  DNPDP**, que fija los textos modelo para las leyendas de acceso y autoridad
  de control (ver §4.a). La AAIP es hoy el órgano de control (Decreto
  899/2017, art. 1°).
- Régimen fiscal/facturación: la app no emite comprobante fiscal; confirmar que
  el local lo emite por otro canal.

## 4. Puntos concretos a revisar (hallazgos)

**a. Leyendas de protección de datos parafraseadas.** Los textos modelo salen
de la **Disposición 10/2008 de la DNPDP** (arts. 1° y 2°; InfoLeg 144735) y
conviene usarlos **textualmente**. Los actuales (en `src/config/legal.ts`)
están resumidos. Texto literal de la norma a validar:

> "El titular de los datos personales tiene la facultad de ejercer el derecho
> de acceso a los mismos en forma gratuita a intervalos no inferiores a seis
> meses, salvo que se acredite un interés legítimo al efecto conforme lo
> establecido en el artículo 14, inciso 3 de la Ley N° 25.326."
>
> "La DIRECCION NACIONAL DE PROTECCION DE DATOS PERSONALES, Organo de Control
> de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos
> que se interpongan con relación al incumplimiento de las normas sobre
> protección de datos personales."

El órgano de control hoy es la **AAIP** (asumió esas funciones por Decreto
899/2017), por lo que la práctica común sustituye "DIRECCION NACIONAL DE
PROTECCION DE DATOS PERSONALES" por "AGENCIA DE ACCESO A LA INFORMACIÓN
PÚBLICA" en la segunda leyenda. Pregunta para el profesional: ¿texto literal
de la disposición o versión actualizada al organismo vigente?

**b. "Botón de arrepentimiento": ubicación, alcance y acreditación.** Hoy es un
enlace en el pie hacia `/pedido/seguimiento`. La Disposición 954/2025 (vigente,
derogó la 424/2020) exige el link "a simple vista, en lugar destacado y **en el
primer acceso**", sin registración previa. Preguntas:
- ¿El pie de página cumple "primer acceso" o debe estar en el encabezado o en
  la primera pantalla?
- El art. 3° d) exime la adquisición de **productos perecederos**: ¿la comida
  preparada queda cubierta y el botón deja de ser exigible, o conviene
  mantenerlo igual? Si se mantiene, ¿debe aclarar que la cancelación web solo
  cubre pedidos pendientes?
- El art. 5° exige informar en 24 h, por el mismo medio, un **código de
  registración de la petición**. Hoy la cancelación web deja el pedido en
  estado "cancelado" en el seguimiento, sin código de trámite ni notificación:
  ¿alcanza o hay que emitir constancia (número de reclamo, email/pantalla de
  confirmación)?
- El art. 6° exige publicar el canal de atención (el pie ya muestra correo,
  teléfonos y horarios de la sucursal cuando el dueño los carga): ¿se
  requiere además aclarar el horario de atención de consultas/reclamos si es
  solo electrónica (mínimo 8 h hábiles)?

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

1. ¿Los textos de la Disposición 10/2008 deben ir literalmente como el modelo
   (incluido "DIRECCION NACIONAL DE PROTECCION DE DATOS PERSONALES") o con la
   adaptación a "AAIP"? (§4.a)
2. ¿El botón de arrepentimiento cumple la Disposición 954/2025 en el pie, o
   debe ir destacado en el primer acceso? ¿Aplica la exención de perecederos
   (art. 3° d) a comida preparada? ¿Qué constancia exige el art. 5° (código de
   registración en 24 h)?
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
7. Derecho de arrepentimiento (Ley 24.240, art. 34; art. 1110 CCyC; Disp.
   954/2025). [A DEFINIR CON EL PROFESIONAL: si aplica la exención de
   perecederos del art. 3° d) a comida preparada, el procedimiento y la
   constancia del art. 5° (código de registración dentro de las 24 h).]
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
   [EMAIL]. + leyendas del §4.a de este brief (Disp. 10/2008 DNPDP).
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
