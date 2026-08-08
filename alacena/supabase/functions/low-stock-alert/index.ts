// ==========================================================================
// Edge Function: low-stock-alert
// Recibe la lista de productos en stock bajo y dispara un correo con Resend.
//
// Deploy:
//   supabase functions deploy low-stock-alert
//   supabase secrets set RESEND_API_KEY=tu_api_key_de_resend
//
// Invocación desde el cliente: supabase.functions.invoke('low-stock-alert', ...)
// ==========================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("ALERT_FROM_EMAIL") ?? "Alacena <alertas@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductoAlerta {
  nombre: string;
  cantidad: number;
  unidad: string;
  stock_minimo: number;
}

interface RequestBody {
  to: string;
  productos: ProductoAlerta[];
}

function buildEmailHtml(productos: ProductoAlerta[]): string {
  const filas = productos
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${p.nombre}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${p.cantidad} ${p.unidad}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${p.stock_minimo} ${p.unidad}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="color:#2f4a3c;">Stock bajo en tu alacena</h2>
      <p>Los siguientes productos llegaron a su nivel mínimo de stock:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;background:#f3efe6;">
            <th style="padding:8px 12px;">Producto</th>
            <th style="padding:8px 12px;">Stock actual</th>
            <th style="padding:8px 12px;">Mínimo</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="margin-top:16px;color:#5c6353;font-size:12px;">Enviado automáticamente por Alacena.</p>
    </div>
  `;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Falta configurar el secreto RESEND_API_KEY en el proyecto de Supabase.");
    }

    const { to, productos }: RequestBody = await req.json();

    if (!to || !Array.isArray(productos) || productos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Se requiere 'to' y una lista de 'productos'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `Alacena: ${productos.length} producto(s) con stock bajo`,
        html: buildEmailHtml(productos),
      }),
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text();
      throw new Error(`Resend respondió con error: ${detail}`);
    }

    const data = await emailRes.json();

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
