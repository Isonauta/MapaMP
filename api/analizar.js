// api/analizar.js — Análisis individual de licitación con Claude
import fetch from 'node-fetch';

const KB_CORDERO = `
EMPRESA: Cordero Asociados Limitada
CONSULTOR PRINCIPAL: Cristián Cordero Placencia — Sociólogo, ~20 años experiencia, 7.000+ horas docencia, 300+ cursos, 50+ proyectos.
EQUIPO: Evelyn Arias (Ing. Prevención de Riesgos), Claudio Jara (Ing. Comercial) + colaboradores puntuales. Máximo 3-4 personas.
BASE: Santiago y Concepción. Opera en todo Chile remoto o presencial.

SERVICIOS CORE (alta competencia):
- Consultoría ISO 9001, 14001, 45001, 27001, 37001 (individual o SGI)
- Auditoría Interna en normas ISO
- Capacitación/Taller normas ISO y formación auditores internos
- Liderazgo, desarrollo organizacional, gestión del cambio

SECTORES CON EXPERIENCIA: Industria, minería, logística, tecnología, educación superior, RRHH/staffing, energía.
CLIENTES CLAVE: ManpowerGroup, IPLACEX, PURATOS, EPIROC, VEOLIA, TAPEL, TURISTIK, PERIlogistics, ENAP.
HISTORIAL PÚBLICO: Escaso — SERCOTEC (2024-2025), Casa Moneda. NO hay historial en municipios ni hospitales públicos.

CRITERIOS:
✅ POSTULAR: ISO core, sector privado/semipúblico, Santiago o Concepción, equipo ≤4 personas
⚠️ EVALUAR: Sector nuevo, ciudad fuera de base, servicios emergentes (ISO 42001, huella carbono)
❌ DESCARTAR: TI/software/obras civiles, municipios/hospitales públicos, requiere ser certificadora, equipo >6 personas
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { licit } = req.body;
  if (!licit) return res.status(400).json({ error: 'Sin datos de licitación' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Sin API key de Anthropic' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
          content: `Eres un experto en licitaciones públicas de Chile. Analiza esta licitación para Cordero Asociados.

${KB_CORDERO}

LICITACIÓN:
- Código: ${licit.codigo}
- Nombre: ${licit.nombre}
- Descripción: ${licit.descripcion || 'NO DISPONIBLE — solo hay nombre de la licitación'}
- Organismo: ${licit.organismo || 'NO DISPONIBLE'}
- Ciudad/Región: ${licit.ciudad} — ${licit.region}
- Monto: ${licit.monto ? '$' + Number(licit.monto).toLocaleString('es-CL') : 'No publicado'}
- Cierre: ${licit.fechaCierre || '—'}

REGLAS CRÍTICAS:
1. Si la descripción dice "NO DISPONIBLE", NO asumas el contenido temático. El nombre solo no es suficiente.
2. Si el organismo es desconocido, no puedes saber si es municipio u hospital público — eso es crítico para el descarte.
3. Sin información suficiente, la recomendación SIEMPRE debe ser "EVALUAR" con color "amarillo".
4. En "servicio_a_ofrecer": solo escribe el servicio si la descripción lo confirma. Si no hay descripción escribe "Verificar bases en MP antes de proponer servicio".
5. En "resumen": si no hay descripción di "Sin descripción disponible — revisar bases en Mercado Público".
6. NUNCA inventes el contenido temático de una capacitación o consultoría si no está descrito.

Responde SOLO en JSON sin markdown:
{
  "recomendacion": "POSTULAR" | "EVALUAR" | "DESCARTAR",
  "color": "verde" | "amarillo" | "rojo",
  "puntaje": número 1-10,
  "resumen": "qué pide según información disponible, o aviso de sin descripción",
  "justificacion": "2 oraciones honestas: por qué sí, no, o por qué no se puede determinar sin más info",
  "servicio_a_ofrecer": "servicio concreto si descripción lo confirma, o indicación de verificar bases",
  "requisitos_clave": "requisitos identificados o indicación de revisar bases",
  "alerta_ciudad": true o false
}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const analisis = JSON.parse(clean);

    return res.status(200).json({ ok: true, analisis });

  } catch(e) {
    console.log('Error análisis:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
