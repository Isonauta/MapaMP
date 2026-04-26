// api/licitaciones.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// ══════════════════════════════════════════════════════════
// KB CORDERO ASOCIADOS — contexto para análisis IA
// ══════════════════════════════════════════════════════════
const KB_CORDERO = `
EMPRESA: Cordero Asociados Limitada
CONSULTOR PRINCIPAL: Cristián Cordero Placencia — Sociólogo, ~20 años experiencia, 7.000+ horas docencia, 300+ cursos, 50+ proyectos de consultoría.
EQUIPO: Evelyn Arias (Ing. Prevención de Riesgos), Claudio Jara (Ing. Comercial) + colaboradores puntuales. Máximo 3-4 personas simultáneas.
BASE OPERATIVA: Santiago y Concepción. Cubre todo Chile en modalidad remota. Traslados a otras ciudades con gastos a cargo del cliente.

SERVICIOS CORE (Alta frecuencia, alta competencia):
- Consultoría/Asesoría ISO 9001, 14001, 45001 (individual o SGI combinado)
- Auditoría Interna en normas ISO
- Capacitación/Taller interpretación normas ISO y formación de auditores internos
- Implementación ISO 27001 (SGSI)
- Implementación ISO 37001 (Antisoborno) y ISO 37301 (Compliance)
- Liderazgo, desarrollo organizacional, gestión del tiempo

SERVICIOS SECUNDARIOS (Media frecuencia):
- ISO 22301 (Continuidad de Negocio), ISO 31000 (Gestión Riesgos)
- ISO 22000/FSSC 22000 (Inocuidad Alimentaria)
- Diagnóstico/Análisis de Brecha (GAP Analysis)

SERVICIOS EMERGENTES (Sin historial ejecutado completo — riesgo mayor):
- ISO 42001 (IA), ISO 14064-1 (Huella de Carbono), ISO 22320 (Emergencias)

SECTORES CON EXPERIENCIA DOCUMENTADA:
✅ Industria/manufactura, minería, logística, tecnología/TI, educación superior, RRHH/staffing, energía/petroquímica, servicios ambientales

SECTORES SIN EXPERIENCIA DOCUMENTADA:
❌ Municipalidades, hospitales públicos, SAMU, CESFAM, corporaciones municipales, ministerios (salvo SERCOTEC)

HISTORIAL SECTOR PÚBLICO: Escaso — SERCOTEC (2024-2025), Casa Moneda (histórico), Consejo Transparencia (2018). NO hay historial en municipios ni salud pública.

CLIENTES CLAVE RECURRENTES: ManpowerGroup, IPLACEX, PURATOS, EPIROC, VEOLIA, TAPEL, TURISTIK, PERIlogistics.

CRITERIOS DE EVALUACIÓN:
🟢 POSTULAR: ISO 9001/14001/45001/27001/37001 — auditoría interna — capacitación ISO — liderazgo — industria privada/minería/logística/tecnología/educación superior — Santiago o Concepción (o remoto) — equipo ≤4 personas — monto razonable
🟡 EVALUAR: Servicios emergentes (ISO 42001, huella carbono) — salud privada — turismo — acuicultura — ciudades fuera de base (verificar gastos traslado) — equipo >3 personas acreditadas requerido
🔴 DESCARTAR: TI/software/obras civiles/medicina — municipios/hospitales públicos/CESFAM — requiere ser entidad certificadora — historial contratos públicos >$50M — equipo >6 personas simultáneas permanentes
`;

// ══════════════════════════════════════════════════════════
// SCORING LOCAL (keywords)
// ══════════════════════════════════════════════════════════
const KEYWORDS_ALTA = [
  'consultoría','consultoria','capacitación','capacitacion',
  'iso 9001','iso 14001','iso 45001','iso 27001','iso 37001','iso 22301','iso 31000',
  'sistema de gestión','sistema de gestion','sgc','sgi','sst',
  'auditoría interna','auditoria interna','auditor interno',
  'certificación','certificacion','norma iso',
  'mejora continua','gestión de calidad','gestion de calidad',
  'seguridad ocupacional','prevención de riesgos','prevencion de riesgos',
  'gestión documental','gestion documental',
  'asesoría','asesoria','servicios profesionales',
  'formación','taller','seminario','curso','entrenamiento',
  'compliance','cumplimiento normativo','antisoborno',
  'gestión ambiental','gestion ambiental',
  'liderazgo','desarrollo organizacional','clima laboral'
];

const KEYWORDS_MEDIA = [
  'evaluación','evaluacion','análisis','analisis','diagnóstico','diagnostico',
  'levantamiento','plan estratégico','implementación','implementacion',
  'procedimiento','manual','reglamento','protocolo',
  'bienestar','indicadores','kpi','estudio','informe',
  'procesos','estructura organizacional','recursos humanos','rrhh'
];

const KEYWORDS_DESCARTE = [
  'obras civiles','construcción','pavimento','asfalto',
  'suministro alimentos','casino','arriendo vehículo','arriendo vehiculo',
  'limpieza aseo','mantenimiento infraestructura','equipos médicos','equipos medicos',
  'medicamentos','fármacos','farmacos','hardware','computadores','impresoras',
  'desarrollo de software','programación','programacion','aplicación móvil'
];

const CIUDADES_PREF = ['santiago','concepción','concepcion','talcahuano','biobío','biobio','región metropolitana','metropolitana'];

function scorear(licit) {
  const texto = [licit.Nombre, licit.Descripcion, licit.NombreOrganismo, licit.Ciudad].join(' ').toLowerCase();
  
  for (const kw of KEYWORDS_DESCARTE) {
    if (texto.includes(kw)) return { nivel: 'baja', score: 0, razon: `Descartada: "${kw}"`, matches: [], esCiudadPreferida: false };
  }

  let score = 0;
  const matches = [];
  for (const kw of KEYWORDS_ALTA) { if (texto.includes(kw)) { score += 10; matches.push(kw); } }
  for (const kw of KEYWORDS_MEDIA) { if (texto.includes(kw)) { score += 4; matches.push(kw); } }

  const ciudadTexto = (licit.Ciudad || licit.NombreOrganismo || licit.Region || '').toLowerCase();
  const esCiudadPreferida = CIUDADES_PREF.some(c => ciudadTexto.includes(c));
  if (esCiudadPreferida) score += 5;

  const nivel = score >= 15 ? 'alta' : score >= 6 ? 'media' : 'baja';
  return { nivel, score, matches: matches.slice(0,5), esCiudadPreferida };
}

// ══════════════════════════════════════════════════════════
// ANÁLISIS IA CON KB
// ══════════════════════════════════════════════════════════
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
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Eres un experto en licitaciones públicas de Chile. Analiza esta licitación usando el perfil de la empresa.

${KB_CORDERO}

LICITACIÓN A ANALIZAR:
- Código: ${licit.codigo}
- Nombre: ${licit.nombre}
- Descripción: ${licit.descripcion}
- Organismo: ${licit.organismo}
- Ciudad/Región: ${licit.ciudad} — ${licit.region}
- Monto estimado: ${licit.monto ? '$' + Number(licit.monto).toLocaleString('es-CL') : 'No publicado'}
- Fecha cierre: ${licit.fechaCierre}

Responde SOLO en JSON sin markdown:
{
  "recomendacion": "POSTULAR" | "EVALUAR" | "DESCARTAR",
  "color": "verde" | "amarillo" | "rojo",
  "puntaje": número 1-10,
  "resumen": "1 oración: qué pide esta licitación",
  "justificacion": "2 oraciones: por qué sí o no para Cordero Asociados específicamente",
  "servicio_a_ofrecer": "Qué servicio concreto ofrecería Cristián Cordero",
  "requisitos_clave": "Requisitos que podrían ser desafíos (experiencia, equipo, certificaciones)",
  "alerta_ciudad": true o false
}`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch(e) { return null; }
}

// ══════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════════
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
      return res.status(200).json({ ok: true, licitaciones: [], total: 0 });
    }

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

    // Análisis IA para las de alta relevancia (máx 10)
    if (analizar === 'true') {
      const altas = licitaciones.filter(l => l.score.nivel === 'alta').slice(0, 10);
      for (const l of altas) {
        l.iaAnalisis = await analizarConClaude(l);
        await new Promise(r => setTimeout(r, 500));
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
