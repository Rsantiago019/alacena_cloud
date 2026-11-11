// ==========================================================================
// CONFIGURACIÓN DE SUPABASE
// Actualizá estos valores con los de tu proyecto en Supabase Dashboard:
// Project Settings -> API
// ==========================================================================

export const SUPABASE_URL = "https://pqngkpgqnmpaapaudiia.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmdrcGdxbm1wYWFwYXVkaWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODk5NjMsImV4cCI6MjEwMTc2NTk2M30.0wrImZTMUCtIaPNxhC6ldNESxMDawdtNRmjSdZhBxgA";

// Nombre de la tabla de productos (ver supabase/schema.sql)
export const TABLE_NAME = "productos";

// Nombre de la Edge Function que envía la alerta por Telegram
// (ver ../supabase/functions/low-stock-alert/index.ts)
export const LOW_STOCK_FUNCTION_NAME = "low-stock-alert";
