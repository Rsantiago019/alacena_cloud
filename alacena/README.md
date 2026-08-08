# Alacena — Inventario de despensa del hogar

App minimalista para llevar el stock de tu despensa: productos, cantidades,
precios y alertas de stock bajo. HTML + CSS + JavaScript vainilla, animada
con GSAP y conectada a Supabase.

## Estructura del proyecto

```
alacena/
├── index.html                          # Markup base + carga de GSAP y del módulo main.js
├── css/
│   └── style.css                       # Tokens de diseño, layout, componentes, temas claro/oscuro
├── js/
│   ├── config.js                       # URL y anon key de Supabase
│   ├── supabaseClient.js               # Cliente Supabase + funciones CRUD
│   ├── animations.js                   # Todas las animaciones GSAP (stagger, modales, micro-interacciones)
│   └── main.js                         # Estado de la app, render de UI, orquestación de eventos
├── supabase/
│   ├── schema.sql                      # Tabla "productos" + RLS + vista de stock bajo
│   └── functions/
│       └── low-stock-alert/
│           └── index.ts                # Edge Function que envía el correo de alerta (Resend)
└── README.md
```

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo.
2. Andá a **SQL Editor** y ejecutá el contenido de `supabase/schema.sql`.
   Esto crea la tabla `productos`, las políticas de RLS y una vista
   `productos_stock_bajo`.
3. Andá a **Project Settings → API** y copiá:
   - `Project URL`
   - `anon public key`

## 2. Configurar el frontend

Editá `js/config.js` con tus credenciales:

```js
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "TU-ANON-KEY";
export const ALERT_EMAIL = "tu-correo@ejemplo.com";
```

## 3. Correr la app localmente

Como `main.js` usa ES Modules, necesitás servirla vía HTTP (no `file://`).
Cualquiera de estas opciones funciona:

```bash
# opción 1: extensión "Live Server" de VS Code
# opción 2: servidor simple de Python
python3 -m http.server 5500

# opción 3: paquete npx
npx serve .
```

Abrí `http://localhost:5500` (o el puerto que corresponda).

## 4. Desplegar la Edge Function de alertas por correo

La función usa [Resend](https://resend.com) para enviar el correo (tiene un
plan gratuito). También podés adaptarla a SendGrid o Postmark cambiando el
`fetch` dentro de `index.ts`.

```bash
# instalar la CLI de Supabase si no la tenés
npm install -g supabase

# login y link al proyecto
supabase login
supabase link --project-ref TU-PROJECT-REF

# configurar el secreto con tu API key de Resend
supabase secrets set RESEND_API_KEY=tu_api_key_de_resend

# desplegar
supabase functions deploy low-stock-alert
```

Una vez desplegada, el botón **"Enviar alerta por correo"** del panel de
alertas invoca esta función con la lista de productos en stock bajo.

## Funcionalidades incluidas

- **CRUD completo** de productos (nombre, categoría, cantidad, unidad,
  stock mínimo, precio, fecha de compra) contra Supabase.
- **Detección de stock bajo** (`cantidad <= stock_minimo`) con panel de
  alertas dedicado y envío de correo vía Edge Function.
- **Modo claro / oscuro** con variables CSS y persistencia en `localStorage`.
- **Animaciones GSAP**:
  - Entrada en *stagger* de las tarjetas al cargar o filtrar.
  - Apertura/cierre de modales con *fade* + escala.
  - Micro-interacciones al sumar/restar stock (anillo de progreso, pulso de color).
  - Animación de salida al eliminar un producto.
  - *Shake* de validación en el formulario.
  - Toasts de confirmación.
- **Responsive** mobile-first con Grid/Flexbox, hasta desktop.

## Notas de seguridad

Las políticas de RLS en `schema.sql` habilitan acceso completo con la clave
`anon`, pensado para un uso personal (un solo hogar, sin login). Si vas a
exponer la app públicamente o multiusuario, agregá autenticación con
Supabase Auth y cambiá las políticas para filtrar por `auth.uid()`.
