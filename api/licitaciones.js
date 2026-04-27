// api/licitaciones.js
// Lee desde Mac Mini local via ngrok cuando está disponible
// Si no, intenta API de Mercado Público directamente

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const localUrl = process.env.LOCAL_DATA_URL;

  // Opción 1: Leer desde Mac Mini (preferida)
  if (localUrl) {
    try {
      console.log(`Intentando URL local: ${localUrl}`);
      const r = await fetch(localUrl, { 
        timeout: 8000,
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (r.ok) {
        const data = await r.json();
        console.log(`✓ Datos desde Mac Mini: ${data.total} licitaciones`);
        return res.status(200).json(data);
      }
    } catch(e) {
      console.log(`Mac Mini no disponible: ${e.message} — intentando API directa`);
    }
  }

  // Opción 2: API directa de Mercado Público
  const ticket = process.env.MP_TICKET || 'F027B50A-6FBE-4106-BF32-B03472D66727';
  const { fecha, estado = 'activas' } = req.query;

  try {
    let url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?ticket=${ticket}`;
    if (fecha) url += `&fecha=${fecha}`;
    else url += `&estado=${estado}`;

    const mpRes = await fetch(url, { timeout: 15000 });
    const mpData = await mpRes.json();

    if (!mpData?.Listado) {
      return res.status(200).json({ ok: false, error: 'Sin datos de MP', licitaciones: [] });
    }

    const licitaciones = mpData.Listado.map((l, i) => ({
      id: i,
      codigo: l.CodigoExterno || '—',
      nombre: l.Nombre || 'Sin nombre',
      descripcion: l.Descripcion || '',
      organismo: l.NombreOrganismo || '—',
      ciudad: l.Ciudad || '—',
      region: l.Region || '—',
      monto: l.MontoEstimado || null,
      fechaCierre: l.FechaCierre || null,
      estado: l.CodigoEstado,
      url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${l.CodigoExterno}`,
      score: { nivel: 'media', score: 5, matches: [], esCiudadPreferida: false },
      iaAnalisis: null
    }));

    return res.status(200).json({
      ok: true,
      licitaciones,
      total: licitaciones.length,
      actualizadoEn: new Date().toISOString(),
      fuente: 'api-directa'
    });

  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message, licitaciones: [] });
  }
}
