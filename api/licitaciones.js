// api/licitaciones.js
import fetch from 'node-fetch';

const KEYWORDS_ALTA = [
  'consultoría','consultoria','capacitación','capacitacion',
  'iso 9001','iso 14001','iso 45001','iso 27001','iso 37001','iso 22301',
  'sistema de gestión','sistema de gestion','sgc','sgi','sst',
  'auditoría interna','auditoria interna','auditor interno',
  'certificación','certificacion','norma iso',
  'mejora continua','gestión de calidad','gestion de calidad',
  'seguridad ocupacional','prevención de riesgos','prevencion de riesgos',
  'asesoría','asesoria','servicios profesionales',
  'compliance','cumplimiento normativo','antisoborno',
  'gestión ambiental','gestion ambiental',
  'liderazgo organizacional','desarrollo organizacional','clima laboral',
  'gestión de riesgos','gestion de riesgos'
];

const KEYWORDS_MEDIA = [
  'evaluación','evaluacion','diagnóstico','diagnostico',
  'levantamiento','implementación','implementacion',
  'procedimiento','manual','reglamento','protocolo',
  'bienestar','indicadores','kpi','procesos',
  'recursos humanos','rrhh','capacitación','capacitacion',
  'taller','curso','formación','formacion'
];

const KEYWORDS_DESCARTE = [
  'obras civiles','construcción de','pavimento','asfalto',
  'suministro de alimentos','casino de alimentación',
  'arriendo de vehículo','limpieza y aseo',
  'equipos médicos','medicamentos','fármacos',
  'desarrollo de software','programación web',
  'compra de computadores','impresoras','licencias adobe',
  'tala de árboles','mezcla asfáltica','alcantarillado',
  'reparacion de calderas','pasajes aéreos'
];

const CIUDADES_PREF = [
  'santiago','concepción','concepcion','talcahuano',
  'biobío','biobio','región metropolitana','metropolitana'
];

function scorear(licit) {
  const texto = [licit.Nombre,licit.Descripcion,licit.NombreOrganismo,licit.Ciudad,licit.Region]
    .filter(Boolean).join(' ').toLowerCase();

  for (const kw of KEYWORDS_DESCARTE) {
    if (texto.includes(kw.toLowerCase()))
      return { nivel:'baja', score:0, matches:[], esCiudadPreferida:false };
  }

  let score = 0;
  const matches = [];
  for (const kw of KEYWORDS_ALTA) { if (texto.includes(kw.toLowerCase())) { score+=10; matches.push(kw); } }
  for (const kw of KEYWORDS_MEDIA) { if (texto.includes(kw.toLowerCase())) { score+=4; matches.push(kw); } }

  const ciudadTexto = [licit.Ciudad,licit.NombreOrganismo,licit.Region].filter(Boolean).join(' ').toLowerCase();
  const esCiudadPreferida = CIUDADES_PREF.some(c => ciudadTexto.includes(c));
  if (esCiudadPreferida) score += 5;

  const nivel = score >= 15 ? 'alta' : score >= 6 ? 'media' : 'baja';
  return { nivel, score, matches: matches.slice(0,5), esCiudadPreferida };
}

function ordenar(lista) {
  const ord = {alta:0,media:1,baja:2};
  return lista.sort((a,b) => {
    if (ord[a.score.nivel] !== ord[b.score.nivel]) return ord[a.score.nivel]-ord[b.score.nivel];
    if (a.score.esCiudadPreferida && !b.score.esCiudadPreferida) return -1;
    if (!a.score.esCiudadPreferida && b.score.esCiudadPreferida) return 1;
    return b.score.score - a.score.score;
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Opción 1: Mac Mini via ngrok
  const localUrl = process.env.LOCAL_DATA_URL;
  if (localUrl) {
    try {
      const r = await fetch(localUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (r.ok) {
        const data = await r.json();
        console.log(`Mac Mini OK: ${data.total} licitaciones`);
        return res.status(200).json(data);
      }
    } catch(e) { console.log(`Mac Mini no disponible: ${e.message}`); }
  }

  // Opción 2: API directa MP con scoring completo
  const ticket = process.env.MP_TICKET || 'F027B50A-6FBE-4106-BF32-B03472D66727';
  const { fecha, estado = 'activas' } = req.query;

  try {
    let url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?ticket=${ticket}`;
    if (fecha) url += `&fecha=${fecha}`;
    else url += `&estado=${estado}`;

    const mpRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const mpData = await mpRes.json();

    if (!mpData?.Listado) return res.status(200).json({ ok:false, error:'Sin datos', licitaciones:[] });

    let licitaciones = ordenar(mpData.Listado.map((l,i) => ({
      id: i,
      codigo: l.CodigoExterno || '—',
      nombre: l.Nombre || 'Sin nombre',
      descripcion: l.Descripcion || '',
      organismo: l.NombreOrganismo || '—',
      ciudad: l.Ciudad || l.DireccionOrganismo || '—',
      region: l.Region || '—',
      monto: l.MontoEstimado || null,
      fechaCierre: l.FechaCierre || null,
      estado: l.CodigoEstado,
      url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${l.CodigoExterno}`,
      score: scorear(l),
      iaAnalisis: null
    })));

    const alta = licitaciones.filter(l=>l.score.nivel==='alta').length;
    const media = licitaciones.filter(l=>l.score.nivel==='media').length;
    const baja = licitaciones.filter(l=>l.score.nivel==='baja').length;

    return res.status(200).json({
      ok:true, licitaciones, total:licitaciones.length,
      alta, media, baja,
      actualizadoEn: new Date().toISOString(),
      fuente:'api-directa'
    });

  } catch(e) {
    return res.status(500).json({ ok:false, error:e.message, licitaciones:[] });
  }
}
