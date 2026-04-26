// api/postular.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const EMAIL_CRISTIAN = 'cristian@cristiancordero.cl';
const EMAIL_COLABORADOR = 'corderomercado6@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_YxNrtRsN_Dt4zcQ2fWE3EF4ndGZvQwnwe';
const FROM = 'Radar MP <onboarding@resend.dev>';

const KB_CORDERO = `
EMPRESA: Cordero Asociados Limitada
CONSULTOR PRINCIPAL: Cristián Cordero Placencia — Sociólogo, ~20 años experiencia, 7.000+ horas docencia, 300+ cursos, 50+ proyectos.
EQUIPO: Evelyn Arias (Ing. Prevención de Riesgos), Claudio Jara (Ing. Comercial) + colaboradores puntuales.
LEMA: "El Poder de la Simplicidad en la gestión organizacional"
METODOLOGÍA: CULTURA + SISTEMAS + PERSONAS. Esquema 5 etapas: Diagnóstico → Desarrollo Documental → Auditoría Interna → Revisión Gerencial → Acompañamiento Certificación.

SERVICIOS CORE: Consultoría ISO 9001/14001/45001/27001/37001, auditoría interna, capacitación ISO, liderazgo organizacional, SGI.
CLIENTES CLAVE: ManpowerGroup, IPLACEX, PURATOS, EPIROC, VEOLIA, TAPEL, TURISTIK, PERIlogistics, Casa Moneda, ENAP.
SECTORES: Industria, minería, logística, tecnología, educación superior, RRHH/staffing, energía, servicios ambientales.
BASE: Santiago y Concepción. Modalidad presencial, remota o mixta.

DIFERENCIADORES: Experiencia acreditada como facilitador SGS Academy, Bureau Veritas, TÜV Rheinland, AENOR. Proyectos certificados con 0 no conformidades (Transportes Bolívar). Cliente ManpowerGroup activo en Chile y Perú desde 2022.
`;

function formatMonto(m) {
  if (!m) return 'No especificado';
  return '$' + Number(m).toLocaleString('es-CL');
}

function formatFecha(f) {
  if (!f) return '—';
  try { return new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return f; }
}

async function generarEstructuraOferta(licit) {
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
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `Eres consultor experto en licitaciones públicas chilenas. Genera una estructura de oferta técnica para Cordero Asociados usando su perfil real.

${KB_CORDERO}

LICITACIÓN:
- Nombre: ${licit.nombre}
- Descripción: ${licit.descripcion}
- Organismo: ${licit.organismo}
- Ciudad: ${licit.ciudad}
- Monto estimado: ${formatMonto(licit.monto)}
- Cierre: ${formatFecha(licit.fechaCierre)}

Genera la estructura en HTML simple (solo h3, p, ul, li, strong — sin CSS ni clases).

Incluye estos 6 bloques, siendo MUY específico al servicio de esta licitación y usando la experiencia real de Cordero Asociados:

1. RESUMEN EJECUTIVO (2 párrafos — quién es Cordero Asociados y por qué es la opción ideal para ESTE organismo)
2. COMPRENSIÓN DEL REQUERIMIENTO (qué entiende Cordero Asociados que necesita este organismo)
3. METODOLOGÍA PROPUESTA (5-6 etapas específicas al tipo de servicio solicitado)
4. EQUIPO Y EXPERIENCIA RELEVANTE (menciona clientes reales similares al organismo licitante)
5. PROPUESTA DE VALOR DIFERENCIADORA (3 puntos concretos que distinguen a Cordero Asociados)
6. CRONOGRAMA TENTATIVO (3-4 fases con duración estimada en semanas/meses)

Sé específico, no genérico. Usa los datos reales de la empresa.`
        }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch(e) { return null; }
}

async function enviarEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html })
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { licit, accion, marcadoPor } = req.body;
  if (!licit || !accion) return res.status(400).json({ error: 'Datos incompletos' });

  const ahora = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const comision = licit.monto ? Math.round(licit.monto * 0.07) : null;

  if (accion === 'POSTULAR') {
    const estructuraOferta = await generarEstructuraOferta(licit);

    const htmlCristian = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
body{font-family:Georgia,serif;background:#f8f8f6;margin:0;padding:0}
.wrap{max-width:640px;margin:0 auto;background:#fff}
.hdr{background:#1a3a6b;padding:28px 32px}
.hdr h1{color:#fff;font-size:20px;margin:0;letter-spacing:1px}
.hdr p{color:rgba(255,255,255,0.55);font-size:12px;margin:4px 0 0;font-family:monospace}
.body{padding:32px}
.badge{display:inline-block;background:#e8f5ee;color:#1a6b3a;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:bold;margin-bottom:18px}
.alerta{background:#fff8e8;border:1px solid #f0c060;border-radius:6px;padding:12px 16px;font-size:13px;color:#7a5500;margin-bottom:16px}
.ficha{background:#f0f4fa;border-left:4px solid #1a3a6b;padding:20px 24px;border-radius:0 6px 6px 0;margin-bottom:24px}
.ficha table{width:100%;border-collapse:collapse}
.ficha td{padding:7px 0;font-size:14px;vertical-align:top}
.ficha td:first-child{color:#666;width:150px;font-family:monospace;font-size:12px}
.ficha td:last-child{color:#1a1a18;font-weight:600}
.btn{display:inline-block;background:#1a3a6b;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;margin-top:8px}
.ia-box{background:#f4f8ff;border:1px solid #c0d0e8;border-radius:6px;padding:20px 24px;font-size:14px;line-height:1.8;margin-top:20px}
.ia-title{font-family:monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#2a5a9a;margin-bottom:12px}
.sec{font-size:16px;color:#1a3a6b;border-bottom:2px solid #e0e8f4;padding-bottom:8px;margin:28px 0 16px}
.foot{background:#f0f0ed;padding:20px 32px;font-size:11px;color:#aaa;font-family:monospace}
</style></head><body>
<div class="wrap">
<div class="hdr"><h1>⚡ Licitación marcada para postular</h1><p>Radar MP · Cordero Asociados · ${ahora}</p></div>
<div class="body">
<span class="badge">✓ POSTULAR — marcado por ${marcadoPor || 'Dashboard'}</span>
${licit.score?.esCiudadPreferida === false ? '<div class="alerta">⚠ Licitación fuera de Santiago/Concepción — confirmar si el organismo cubre gastos de traslado.</div>' : ''}
<div class="ficha"><table>
<tr><td>Código</td><td>${licit.codigo}</td></tr>
<tr><td>Nombre</td><td>${licit.nombre}</td></tr>
<tr><td>Organismo</td><td>${licit.organismo}</td></tr>
<tr><td>Ciudad / Región</td><td>${licit.ciudad} — ${licit.region}</td></tr>
<tr><td>Monto estimado</td><td>${formatMonto(licit.monto)}</td></tr>
<tr><td>Fecha cierre</td><td>${formatFecha(licit.fechaCierre)}</td></tr>
<tr><td>Comisión colaborador</td><td>${comision ? '$' + comision.toLocaleString('es-CL') + ' (7%)' : 'Por definir según monto adjudicado'}</td></tr>
</table></div>
<a href="${licit.url}" class="btn">Ver licitación completa en Mercado Público →</a>
${licit.iaAnalisis ? `
<div class="ia-box">
<div class="ia-title">✦ Análisis IA — Evaluación previa</div>
<p><strong>Recomendación:</strong> ${licit.iaAnalisis.recomendacion} (${licit.iaAnalisis.puntaje}/10)</p>
<p><strong>Resumen:</strong> ${licit.iaAnalisis.resumen}</p>
<p><strong>Justificación:</strong> ${licit.iaAnalisis.justificacion}</p>
<p><strong>Servicio a ofrecer:</strong> ${licit.iaAnalisis.servicio_a_ofrecer}</p>
${licit.iaAnalisis.requisitos_clave ? `<p><strong>Requisitos a revisar:</strong> ${licit.iaAnalisis.requisitos_clave}</p>` : ''}
</div>` : ''}
<h2 class="sec">📋 Tu tarea: Oferta Técnica y Económica</h2>
<div class="ia-box">
<div class="ia-title">✦ Estructura generada por IA — basada en tu perfil real</div>
${estructuraOferta || `
<h3>1. Resumen Ejecutivo</h3><p>Cordero Asociados Limitada, con ~20 años de experiencia en consultoría ISO...</p>
<h3>2. Comprensión del Requerimiento</h3><p>Descripción del análisis del organismo...</p>
<h3>3. Metodología Propuesta</h3><ul><li>Etapa 1: Diagnóstico</li><li>Etapa 2: Implementación</li><li>Etapa 3: Auditoría Interna</li><li>Etapa 4: Revisión Gerencial</li><li>Etapa 5: Acompañamiento</li></ul>
<h3>4. Equipo y Experiencia</h3><p>Cristián Cordero Placencia + Evelyn Arias (SST)</p>
<h3>5. Propuesta de Valor</h3><ul><li>Experiencia acreditada en SGS Academy y Bureau Veritas</li><li>Metodología CULTURA + SISTEMAS + PERSONAS</li><li>Clientes recurrentes en sectores similares</li></ul>
<h3>6. Cronograma</h3><ul><li>Fase 1 (2 semanas): Diagnóstico</li><li>Fase 2 (6 semanas): Implementación</li><li>Fase 3 (2 semanas): Auditoría y cierre</li></ul>`}
</div>
</div>
<div class="foot">Radar MP · Sistema automático Cordero Asociados · No responder este correo</div>
</div></body></html>`;

    const htmlColaborador = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
body{font-family:Georgia,serif;background:#f8f8f6;margin:0;padding:0}
.wrap{max-width:640px;margin:0 auto;background:#fff}
.hdr{background:#2a5a8a;padding:28px 32px}
.hdr h1{color:#fff;font-size:20px;margin:0;letter-spacing:1px}
.hdr p{color:rgba(255,255,255,0.55);font-size:12px;margin:4px 0 0;font-family:monospace}
.body{padding:32px}
.ficha{background:#f0f4fa;border-left:4px solid #2a5a8a;padding:20px 24px;border-radius:0 6px 6px 0;margin-bottom:24px}
.ficha table{width:100%;border-collapse:collapse}
.ficha td{padding:7px 0;font-size:14px;vertical-align:top}
.ficha td:first-child{color:#666;width:150px;font-family:monospace;font-size:12px}
.ficha td:last-child{color:#1a1a18;font-weight:600}
.btn{display:inline-block;background:#2a5a8a;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;margin:8px 0}
.sec{font-size:16px;color:#2a5a8a;border-bottom:2px solid #d0dff0;padding-bottom:8px;margin:28px 0 16px}
.check{background:#f4f8ff;border:1px solid #c0d4f0;border-radius:6px;padding:20px 24px}
.check ul{list-style:none;padding:0;margin:0}
.check li{padding:10px 0;border-bottom:1px solid #dce8f8;font-size:14px;color:#333}
.check li:last-child{border-bottom:none}
.check li::before{content:"☐  ";color:#2a5a8a;font-size:16px}
.comision{background:#e8f0fa;border-radius:8px;padding:20px;margin-top:24px;text-align:center}
.comision .monto{font-size:32px;font-weight:bold;color:#1a3a6b;display:block}
.comision .lbl{font-size:12px;color:#666;font-family:monospace;margin-top:4px;display:block}
.foot{background:#f0f0ed;padding:20px 32px;font-size:11px;color:#aaa;font-family:monospace}
</style></head><body>
<div class="wrap">
<div class="hdr"><h1>📂 Nueva postulación — Tu gestión</h1><p>Radar MP · Cordero Asociados · ${ahora}</p></div>
<div class="body">
<p style="font-size:14px;color:#555;margin-bottom:20px">Cristián ha marcado esta licitación para postular. Tu responsabilidad es gestionar toda la documentación y subida a Mercado Público.</p>
<div class="ficha"><table>
<tr><td>Código</td><td>${licit.codigo}</td></tr>
<tr><td>Nombre</td><td>${licit.nombre}</td></tr>
<tr><td>Organismo</td><td>${licit.organismo}</td></tr>
<tr><td>Ciudad / Región</td><td>${licit.ciudad} — ${licit.region}</td></tr>
<tr><td>Monto estimado</td><td>${formatMonto(licit.monto)}</td></tr>
<tr><td>Fecha cierre</td><td><strong style="color:#c04000">${formatFecha(licit.fechaCierre)}</strong></td></tr>
</table></div>
<a href="${licit.url}" class="btn">Ver licitación en Mercado Público →</a>
<h2 class="sec">📋 Tu checklist</h2>
<div class="check"><ul>
<li>Descargar y leer las bases de licitación completas</li>
<li>Identificar todos los documentos habilitantes requeridos</li>
<li>Verificar que Cordero Asociados esté inscrita como proveedor en ChileCompra</li>
<li>Coordinar con Cristián la oferta técnica y económica</li>
<li>Preparar y subir todos los documentos a Mercado Público antes del cierre</li>
<li>Confirmar número de postulación y enviar comprobante a Cristián</li>
<li>Hacer seguimiento del estado en el dashboard</li>
<li>Notificar resultado (adjudicada / no adjudicada) y actualizar dashboard</li>
</ul></div>
${comision ? `<div class="comision"><span class="monto">${'$' + comision.toLocaleString('es-CL')}</span><span class="lbl">Tu comisión estimada si adjudicamos (7% del monto total)</span></div>` : ''}
</div>
<div class="foot">Radar MP · Sistema automático Cordero Asociados · No responder este correo</div>
</div></body></html>`;

    const [r1, r2] = await Promise.all([
      enviarEmail(EMAIL_CRISTIAN, `⚡ Postular: ${licit.nombre.substring(0, 60)}`, htmlCristian),
      enviarEmail(EMAIL_COLABORADOR, `📂 Documentación requerida: ${licit.nombre.substring(0, 50)}`, htmlColaborador)
    ]);

    return res.status(200).json({ ok: true, emails: { cristian: r1, colaborador: r2 } });
  }

  return res.status(200).json({ ok: true, mensaje: 'Acción registrada' });
}
