# Prompt: Aplicar estilo minimalista futurista oscuro al proyecto Panchería

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja para una panchería.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline`)
- shadcn/ui v4 (componentes en `src/components/ui/*` basados en `@base-ui/react`)
- Fuentes: Geist Sans y Geist Mono cargadas desde `next/font/google` en `src/app/layout.tsx`
- Variables CSS actuales en `src/app/globals.css`

## Objetivo

Aplicar un estilo visual **minimalista, futurista y oscuro** que funcione correctamente en todos los dispositivos, con especial atención a **mobile**. El estilo debe ser coherente en toda la aplicación: login, panel de control, terminal de ventas, stock, productos, recetas y cierre.

## Requisitos de diseño

### 1. Paleta de colores: oscuro futurista

- Fondo base muy oscuro (negro azabache o gris casi negro).
- Superficies elevadas (`card`, `popover`, `dialog`) en gris oscuro con bordes sutiles.
- Acento principal en un color frío tecnológico: azul cian o violeta neón suave (evita colores saturados excesivos; busca elegancia, no distracción).
- Texto principal en blanco o gris muy claro con alto contraste.
- Estados secundarios y deshabilitados en grises medio-oscuros.
- Color destructivo en rojo coral suave; advertencias en ámbar o naranja cálido.
- Usa transparencias moderadas para bordes y separadores (`border-white/10`, `border-white/5`).

### 2. Tipografía legible y moderna

- Mantener Geist Sans para la interfaz general.
- Usar Geist Mono para etiquetas, precios, códigos y datos numéricos.
- Tamaños de fuente escalables y accesibles:
  - Base: `16px` (evita texto por debajo de `14px` en mobile).
  - Encabezados: proporción clara (`text-lg`, `text-xl`, `text-2xl`) sin exagerar.
  - En mobile, prioriza `text-base` para inputs y botones para mejor legibilidad y toque.
- Alto interlineado (`leading-relaxed`) para descripciones y alertas.

### 3. Componentes clave a estilar

- **`src/app/globals.css`**: convertir `:root` al tema oscuro por defecto; redefinir `--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--muted`, `--border`, `--ring` con la paleta futurista oscura.
- **`src/app/layout.tsx`**: forzar modo oscuro en `<html>` (`className="dark"` o `suppressHydrationWarning` si se usa theme toggle) y mantener fuentes.
- **`src/app/(auth)/login/login-form.tsx`**: formulario centrado con tarjeta oscura, inputs con fondo sutil, botón primario con acento tecnológico, espaciado mobile cómodo.
- **`src/app/(panel)/layout.tsx`**: convertir el header en una barra superior oscura; en mobile debe colapsar a un menú inferior o un menú hamburguesa; asegurar que los botones de navegación sean tocables (altura mínima `44px`, espaciado amplio).
- **`src/app/(panel)/page.tsx`**: dashboard con tarjetas de resumen en grid responsivo, iconografía o tipografía clara,CTAs prominentes.
- **`src/components/ventas/sales-terminal.tsx`**: productos como tarjetas grandes y táctiles, tipografía clara de precios, carrito legible, botones de cantidad fáciles de tocar en pantallas pequeñas.
- **`src/components/stock/stock-list.tsx`**: tabla con scroll horizontal en mobile, badges con colores de estado, diálogos que ocupen bien la pantalla en móvil.
- **`src/components/productos/product-form.tsx`**: formulario en una sola columna en mobile, grid de 2 columnas en tablet/desktop, inputs con estados de foco visibles.
- **Componentes UI base** (`button`, `card`, `input`, `label`, `table`, `dialog`, `badge`, `select`, `textarea`): ajustar bordes, radios, fondos, sombras sutiles y estados de foco con el acento futurista.

### 4. Principios de responsividad (mobile-first)

- Diseñar primero para mobile, luego escalar a tablet y desktop.
- Usar contenedores fluidos (`w-full`, `max-w-*`) y grids responsivos (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4`).
- Evitar el uso de tablas fijas en pantallas pequeñas: envolver en `overflow-x-auto` o transformar a tarjetas/listas cuando sea posible.
- Botones y elementos interactivos deben tener área de toque mínima de `44x44px`.
- En `sales-terminal`, los productos deben mostrarse como tarjetas grandes de 1 columna en mobile, 2 en tablet, 3 o más en desktop.
- En `stock-list`, ocultar columnas secundarias en mobile si es necesario o mostrar una fila como tarjeta.
- Diálogos y modales deben adaptarse al viewport, con padding y anchos máximos (`w-[calc(100%-2rem)]` o `max-w-sm`).
- Ajustar paddings globales: `p-4` en mobile, `p-6` o `p-8` en desktop.

### 5. Estética minimalista futurista

- Reducir decoración innecesaria: sin sombras grandes, sin gradientes excesivos.
- Usar bordes finos y transparencias para definir jerarquía.
- Foco visible con anillo de color acento (`ring-accent/50`).
- Radios moderados (`rounded-xl`, `rounded-2xl`) en tarjetas y diálogos.
- Animaciones sutiles: transiciones de color, elevación suave en hover (`hover:bg-accent/10` en lugar de sombras).
- Si se agrega toggle de tema oscuro/claro, mantener la paleta oscura por defecto y que el toggle sea accesible.

### 6. Accesibilidad

- Contraste mínimo WCAG AA entre texto y fondo.
- Estados de foco visibles en todos los controles.
- Etiquetas y `aria-label` correctos en botones de icono.
- Texto de error siempre legible, con fondo sutil y color destructivo claro.

### 7. Archivos a modificar (lista no exhaustiva)

```
src/app/globals.css
src/app/layout.tsx
src/app/(auth)/login/login-form.tsx
src/app/(panel)/layout.tsx
src/app/(panel)/page.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/input.tsx
src/components/ui/label.tsx
src/components/ui/table.tsx
src/components/ui/dialog.tsx
src/components/ui/badge.tsx
src/components/ui/select.tsx
src/components/ui/textarea.tsx
src/components/ventas/sales-terminal.tsx
src/components/stock/stock-list.tsx
src/components/productos/product-form.tsx
src/components/productos/product-actions.tsx
src/components/productos/recipe-editor.tsx
src/components/ventas/sales-history.tsx
src/components/cierre/closure-panel.tsx
src/components/cierre/closure-history.tsx
```

### 8. Validación

- Ejecutar `npm run build` y corregir errores de lint/type.
- Ejecutar `npm run dev` y probar en dimensiones mobile (375px, 390px, 414px), tablet (768px) y desktop.
- Verificar que no haya texto cortado, elementos que se salgan de la pantalla ni zonas de toque pequeñas.
- Probar flujo completo: login → dashboard → ventas → productos → stock → cierre.

### 9. Restricciones del proyecto

- No hardcodear credenciales, URLs ni valores sensibles.
- Mantener el idioma español en todo texto visible.
- No eliminar funcionalidad existente; solo cambiar estilos y responsividad.
- Respetar la configuración de Tailwind v4: usa `@theme inline` y variables CSS, evita `tailwind.config.js`.

## Resultado esperado

Una aplicación coherente, oscura y moderna que se sienta profesional y futurista, con lectura clara en cualquier dispositivo y una experiencia táctil óptima en mobile.
