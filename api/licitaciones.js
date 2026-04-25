// api/licitaciones.js
// Obtiene licitaciones de Mercado Público y las analiza con Claude

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const PERFIL = {
  keywords_alta: [
    'consultoría','consultoria','capacitación','capacitacion',
    'iso 9001','iso 14001','iso 45001','iso 27001','iso 37001',
    'sistema de gestión','sistema de gestion','sgc','sgi','sst',
    'auditoría','auditoria','certificación','certificacion',
    'mejora continua','gestión de calidad','gestion de calidad',
    'seguridad ocupacional','prevención de riesgos','prevencion de riesgos',
    'gestión documental','gestion documental','norma','normativa',
    'asesoría','asesoria','servicios profesionales','diagnóstico','diagnostico',
    'formación','taller','seminario','curso','entrenamiento',
    'gestión de riesgos','gestion de riesgos','compliance','cumplimiento normativo',
    'gestión ambiental','gestion ambiental','clima laboral','cultura organizacional'
  ],
  keywords_media: [
    'evaluación','evaluacion','análisis','analisis','levantamiento',
    'plan estratégico','plan estrategico','implementación','implementacion',
    'procedimiento','manual','reglamento','política','politica',
    'bienestar','indicadores','kpi','estudio','investigación','informe',
    'procesos','estructura organizacional','recursos humanos'
  ],
  keywords_descarte: [
    'construcción','pavimento','asfalto','materiales construccion',
    'suministro alimentos','alimentación casino','arriendo vehículo',
    'limpieza aseo','mantenimiento infraestructura','equipos médicos',
    'medicamentos','fármacos','hardware','computadores','impresoras',
    'obras civiles','urbanización','alcantarillado'
  ],
  ciudades_preferidas: ['santiago','concepción','concepcion','talcahuano','biobío','biobio','región metropolitana','rm']
};

function scorear(licit) {
  const texto = [licit.Nombre, licit.Descripcion, licit.NombreOrganismo, licit.Ciudad].join(' ').toLowerCase();
  
  for (const kw of PERFIL.keywords_descarte) {
    if (texto.includes(kw)) return { nivel: 'baja', score: 0, razon: `Descartada: "${kw}"` };
  }

  let score = 0;
  const matches = [];
  
  for (const kw of PERFIL.keywords_alta) {
    if (texto.includes(kw)) { score += 10; matches.push(kw); }
  }
  for (const kw of PERFIL.keywords_media) {
    if (texto.includes(kw)) { score += 4; matches.push(kw); }
  }

  // Bonus ciudad preferida
  const ciudadTexto = (licit.Ciudad || licit.NombreOrganismo || '').toLowerCase();
  const esCiudadPreferida = PERFIL.ciudades_preferidas.some(c => ciudadTexto.includes(c));
  if (esCiudadPreferida) score += 5;

  let nivel = score >= 15 ? 'alta' : score >= 6 ? 'media' : 'baja';
  return { nivel, score, matches: matches.slice(0,4), esCiudadPreferida };
}

async function analizarConClaude(licit) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Eres un experto en licitaciones públicas de Chile. Analiza esta licitación para "Cordero Asociados", empresa con 11 años de experiencia en consultoría organizacional, sistemas de gestión ISO (9001, 14001, 45001, 37001, 27001), capacitación, auditorías internas, prevención de riesgos y mejora continua. Base en Talcahuano/Concepción, opera también en Santiago.

LICITACIÓN:
- Código: ${licit.CodigoExterno || '—'}
- Nombre: ${licit.Nombre || '—'}
- Descripción: ${licit.Descripcion || '—'}
- Organismo: ${licit.NombreOrganismo || '—'}
- Ciudad/Región: ${licit.Ciudad || licit.Region || '—'}
- Monto estimado: ${licit.MontoEstimado ? '$' + Number(licit.MontoEstimado).toLocaleString('es-CL') : 'No especificado'}
- Fecha cierre: ${licit.FechaCierre || '—'}

Responde SOLO en JSON sin markdown:
{
  "recomendacion": "POSTULAR" | "EVALUAR" | "DESCARTAR",
  "puntaje": número 1-10,
  "justificacion": "2 oraciones concretas explicando por qué",
  "servicio_a_ofrecer": "Qué servicio específico ofrecería Cordero Asociados",
  "alerta_ciudad": true o false (si está fuera de Santiago/Concepción),
  "monto_justifica_traslado": true o false
}`
        }]
      })
    });
    
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ticket = process.env.MP_TICKET || 'F8537A18-6766-4DEF-9E59-426B4FEE2844';
  const { fecha, estado = 'activas', analizar } = req.query;

  try {
    let url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?ticket=${ticket}`;
    if (fecha) url += `&fecha=${fecha}`;
    else url += `&estado=${estado}`;

    const mpRes = await fetch(url, { timeout: 15000 });
    const mpData = await mpRes.json();

    if (!mpData?.Listado) {
      return res.status(200).json({ ok: true, licitaciones: [], total: 0, fuente: 'mp' });
    }

    // Filtrar y scorear
    let licitaciones = mpData.Listado.map((l, i) => ({
      id: i,
      codigo: l.CodigoExterno || l.Codigo || '—',
      nombre: l.Nombre || 'Sin nombre',
      descripcion: l.Descripcion || '',
      organismo: l.NombreOrganismo || '—',
      ciudad: l.Ciudad || l.DireccionOrganismo || '—',
      region: l.Region || '—',
      monto: l.MontoEstimado || null,
      fechaCierre: l.FechaCierre || l.FechaCreacion || null,
      estado: l.CodigoEstado,
      url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${l.CodigoExterno}`,
      score: scorear(l),
      iaAnalisis: null
    }));

    // Solo análisis IA para las de alta relevancia (máx 10 para no gastar API)
    if (analizar === 'true') {
      const altas = licitaciones.filter(l => l.score.nivel === 'alta').slice(0, 10);
      for (const l of altas) {
        l.iaAnalisis = await analizarConClaude(l);
        await new Promise(r => setTimeout(r, 500)); // Rate limit gentil
      }
    }

    // Ordenar: alta ciudad preferida > alta > media > baja
    licitaciones.sort((a, b) => {
      const order = { alta: 0, media: 1, baja: 2 };
      if (order[a.score.nivel] !== order[b.score.nivel]) return order[a.score.nivel] - order[b.score.nivel];
      if (a.score.esCiudadPreferida && !b.score.esCiudadPreferida) return -1;
      if (!a.score.esCiudadPreferida && b.score.esCiudadPreferida) return 1;
      return b.score.score - a.score.score;
    });

    res.status(200).json({
      ok: true,
      licitaciones,
      total: licitaciones.length,
      alta: licitaciones.filter(l => l.score.nivel === 'alta').length,
      media: licitaciones.filter(l => l.score.nivel === 'media').length,
      baja: licitaciones.filter(l => l.score.nivel === 'baja').length,
      actualizadoEn: new Date().toISOString()
    });

  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
