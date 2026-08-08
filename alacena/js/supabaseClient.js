// ==========================================================================
// SUPABASE CLIENT — inicialización y funciones CRUD
// ==========================================================================
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TABLE_NAME,
  LOW_STOCK_FUNCTION_NAME,
  ALERT_EMAIL,
} from "./config.js";

const BASE_URL = SUPABASE_URL.replace(/\/+$/, "");
const REST_URL = `${BASE_URL}/rest/v1`;
const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;

function ensureConfig() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("TU-PROYECTO") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("TU-ANON-KEY")) {
    throw new Error("Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js");
  }
}

function buildHeaders(extraHeaders = {}, includeJsonBody = false) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: "application/json",
    ...(includeJsonBody ? { "Content-Type": "application/json" } : {}),
    ...extraHeaders,
  };
}

async function requestJson(path, { method = "GET", body, query = "", headers = {}, preferReturnRepresentation = false } = {}) {
  ensureConfig();

  const url = new URL(`${REST_URL}/${path}`);
  if (query) {
    url.search = query;
  }

  const finalHeaders = buildHeaders(headers, Boolean(body));
  if (preferReturnRepresentation) {
    finalHeaders.Prefer = "return=representation";
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${text || response.statusText}`);
  }

  return text ? JSON.parse(text) : null;
}

export const supabase = {
  functions: {
    invoke: async (functionName, options = {}) => {
      ensureConfig();
      const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }, true),
        body: JSON.stringify(options.body ?? {}),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Supabase function failed (${response.status}): ${text || response.statusText}`);
      }

      return { data: text ? JSON.parse(text) : null, error: null };
    },
  },
};

/**
 * Trae todos los productos ordenados por nombre.
 */
export async function fetchProducts() {
  const data = await requestJson(TABLE_NAME, {
    query: "select=*&order=nombre.asc",
  });

  return Array.isArray(data) ? data : [];
}

/**
 * Crea un producto nuevo. `producto` debe tener:
 * nombre, categoria, cantidad, unidad, stock_minimo, precio, fecha_compra
 */
export async function createProduct(producto) {
  const data = await requestJson(TABLE_NAME, {
    method: "POST",
    body: [producto],
    preferReturnRepresentation: true,
  });

  if (Array.isArray(data)) return data[0];
  return data;
}

/**
 * Actualiza un producto existente por id con los campos parciales `cambios`.
 */
export async function updateProduct(id, cambios) {
  const data = await requestJson(`${TABLE_NAME}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...cambios, updated_at: new Date().toISOString() },
    preferReturnRepresentation: true,
  });

  if (Array.isArray(data)) return data[0];
  return data;
}

/**
 * Ajusta solo la cantidad de stock de un producto (usado por los botones +/-).
 */
export async function adjustStock(id, nuevaCantidad) {
  return updateProduct(id, { cantidad: Math.max(0, nuevaCantidad) });
}

/**
 * Elimina un producto por id.
 */
export async function deleteProduct(id) {
  await requestJson(`${TABLE_NAME}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return true;
}

/**
 * Devuelve true si un producto está en stock bajo (cantidad <= stock_minimo).
 */
export function isLowStock(producto) {
  return Number(producto.cantidad) <= Number(producto.stock_minimo);
}

/**
 * Invoca la Edge Function de Supabase que dispara el correo de alerta
 * de stock bajo. Ver supabase/functions/low-stock-alert/index.ts
 */
export async function triggerLowStockAlert(productosEnAlerta) {
  const result = await supabase.functions.invoke(LOW_STOCK_FUNCTION_NAME, {
    body: {
      to: ALERT_EMAIL,
      productos: productosEnAlerta.map((p) => ({
        nombre: p.nombre,
        cantidad: p.cantidad,
        unidad: p.unidad,
        stock_minimo: p.stock_minimo,
      })),
    },
  });

  return result.data;
}
