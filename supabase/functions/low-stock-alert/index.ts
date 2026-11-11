const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) {
    console.error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID");
    return jsonResponse({ error: "Falta configurar Telegram en la Edge Function" }, 500);
  }

  let productos: unknown;
  try {
    ({ productos } = await req.json());
  } catch {
    return jsonResponse({ error: "El cuerpo de la solicitud no es JSON válido" }, 400);
  }

  if (!Array.isArray(productos) || productos.length === 0 ||
      !productos.every((p) => p && typeof p.nombre === "string" &&
        (typeof p.cantidad === "number" || typeof p.cantidad === "string") &&
        (typeof p.stock_minimo === "number" || typeof p.stock_minimo === "string") &&
        (p.unidad == null || typeof p.unidad === "string"))) {
    return jsonResponse({ error: "La lista de productos no es válida o está vacía" }, 400);
  }

  const lista = productos
    .map((p) => `• ${p.nombre}: ${p.cantidad} ${p.unidad || ""} (Mín: ${p.stock_minimo})`)
    .join("\n");
  const mensaje = `⚠️ ¡Faltan Productos en casa!\n\n Hay que comprar 💸 :\n\n${lista}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensaje }),
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) {
      console.error("Telegram rechazó el envío", response.status, data.description);
      return jsonResponse({ error: "Telegram rechazó la alerta; revisá el bot y el chat" }, 502);
    }
    return jsonResponse({ success: true });
  } catch {
    console.error("No se pudo contactar a Telegram o su respuesta no es válida");
    return jsonResponse({ error: "No se pudo contactar a Telegram" }, 502);
  }
});
