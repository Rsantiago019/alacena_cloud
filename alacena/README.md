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
│   └── schema.sql                      # Tabla "productos" + RLS + vista de stock bajo
└── README.md

supabase/functions/low-stock-alert/index.ts  # Edge Function en la raíz del repositorio
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
```

Para esta función usá la clave pública **anon legacy** en formato JWT
(empieza con `eyJ`), disponible en **Project Settings → API Keys → Legacy
anon, service_role API keys**. La clave `sb_publishable_...` no es un JWT y
no funciona con la verificación JWT predeterminada de la Edge Function.
Nunca uses la clave `service_role` en el frontend.

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

## 4. Desplegar la Edge Function de alertas por Telegram

Creá un bot con [BotFather](https://t.me/BotFather), iniciá una conversación
con él y obtené el ID del chat. Si el token del bot fue expuesto, revocalo
con BotFather y generá uno nuevo. No guardes el token en el código ni lo
compartas.

Desde PowerShell, ubicándote en la **raíz del repositorio** (la carpeta que
contiene `alacena` y `supabase`), usá la CLI de Supabase:

```powershell
supabase login
supabase link --project-ref TU-PROJECT-REF

# Ingresá los valores reales sin incluirlos en el código fuente.
$token = Read-Host "Token nuevo del bot de Telegram"
$chatId = Read-Host "ID del chat de Telegram"
supabase secrets set "TELEGRAM_BOT_TOKEN=$token" "TELEGRAM_CHAT_ID=$chatId"
Remove-Variable token, chatId

# --use-api permite desplegar sin Docker.
supabase functions deploy low-stock-alert --use-api
```

Una vez desplegada, el botón **"Enviar alerta por Telegram"** envía la lista
de productos en stock bajo al chat configurado. Si falla, revisá la consola
del navegador y los logs de la Edge Function en Supabase.

La app no tiene inicio de sesión y usa una clave pública: cualquiera que
pueda acceder a ella puede invocar la función y enviar alertas al chat
configurado. Para exponerla públicamente, agregá autenticación y limitación
de solicitudes.

## Funcionalidades incluidas

- **CRUD completo** de productos (nombre, categoría, cantidad, unidad,
  stock mínimo, precio, fecha de compra) contra Supabase.
- **Detección de stock bajo** (`cantidad <= stock_minimo`) con panel de
  alertas dedicado y envío por Telegram vía Edge Function.
- **Resumen del inventario** con cantidad de productos y artículos para
  reponer, búsqueda, filtros y opción para limpiar filtros sin resultados.
- **Filtro de reposición** para encontrar rápidamente productos con stock
  bajo; la búsqueda también funciona sin escribir tildes.
- **Recuperación de conexión** con opción para reintentar la carga.
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
