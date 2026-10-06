// Marcas «Ya tuvo reporte» compartidas entre todos los dispositivos (Netlify Functions + Netlify Blobs).
//   GET  /api/marcas  -> {"marcadas":[6,12,...]}            filas del Excel que tienen la marca
//   POST /api/marcas  -> cuerpo {"f":12,"v":true|false}      marca o desmarca la sede de esa fila
//                        cuerpo {"borrarTodas":true}         quita todas las marcas
// Cada marca es un registro del almacén «marcas-reporte» cuya clave es el número de fila del Excel (6 a 39).
// Un registro por sede evita que dos personas que marcan a la vez se pisen entre sí.
import { getStore } from "@netlify/blobs";

const FILA_MIN = 6, FILA_MAX = 39;                       // hoja «Datos por sede»: 34 sedes en las filas 6 a 39
const filaValida = f => Number.isInteger(f) && f >= FILA_MIN && f <= FILA_MAX;

const CORS = { "Access-Control-Allow-Origin": "*" };      // la página también se abre desde GitHub Pages o desde el computador
const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), {
  status,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

async function listar(store) {
  const { blobs } = await store.list();
  return blobs.map(b => Number(b.key)).filter(filaValida).sort((a, b) => a - b);
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
  }
  try {
    const store = getStore({ name: "marcas-reporte", consistency: "strong" });
    if (req.method === "GET") return json({ marcadas: await listar(store) });

    if (req.method === "POST") {
      const texto = await req.text();
      if (texto.length > 200) return json({ error: "Solicitud demasiado grande" }, 413);
      let d;
      try { d = JSON.parse(texto); } catch { return json({ error: "JSON no válido" }, 400); }
      if (d && d.borrarTodas === true) {
        for (const f of await listar(store)) await store.delete(String(f));
      } else if (d && filaValida(d.f) && typeof d.v === "boolean") {
        if (d.v) await store.set(String(d.f), JSON.stringify({ t: Date.now() }));
        else await store.delete(String(d.f));
      } else {
        return json({ error: "Datos no válidos" }, 400);
      }
      return json({ ok: true, marcadas: await listar(store) });
    }
    return json({ error: "Método no permitido" }, 405);
  } catch (e) {
    console.error("marcas:", e);
    return json({ error: "Error del servidor" }, 500);
  }
};

export const config = { path: "/api/marcas" };
