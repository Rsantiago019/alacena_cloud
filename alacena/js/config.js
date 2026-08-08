// ==========================================================================
// CONFIGURACIÓN DE SUPABASE
// Actualizá estos valores con los de tu proyecto en Supabase Dashboard:
// Project Settings -> API
// ==========================================================================

export const SUPABASE_URL = "https://pqngkpgqnmpaapaudiia.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_wKK0Pzuwe-mrKpCuFCw43w_jq-4nGlS";

// Nombre de la tabla de productos (ver supabase/schema.sql)
export const TABLE_NAME = "productos";

// Nombre de la Edge Function que dispara el correo de alerta
// (ver supabase/functions/low-stock-alert/index.ts)
export const LOW_STOCK_FUNCTION_NAME = "low-stock-alert";

// Correo que recibe las alertas de stock bajo (usado por la Edge Function)
export const ALERT_EMAIL = "tu-correo@ejemplo.com";
