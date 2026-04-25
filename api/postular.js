// api/postular.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const EMAIL_CRISTIAN = 'cristian@cristiancordero.cl';
const EMAIL_COLABORADOR = 'corderomercado6@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_YxNrtRsN_Dt4zcQ2fWE3EF4ndGZvQwnwe';
const FROM = 'Radar MP <onboarding@resend.dev>';

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: `Eres consultor experto en licitaciones públicas chilenas. Para "Cordero Asociados" (consultoría ISO 9001/14001/45001/37001, capacitación, auditorías, 11 años experiencia, base Talcahuano) genera estructura de oferta técnica en HTML simple (solo h3, p, ul, li, strong).

LICITACIÓN: ${licit.nombre} | ${licit.organismo} | Monto: ${formatMonto(licit.monto)}
Descripción: ${licit.descripcion}

Incluye: 1.Resumen ejecutivo, 2.Metodología (5 puntos), 3.Equipo y experiencia, 4.Propuesta de valor, 5.Cronograma por fases. Sé específico al tipo de servicio.` }]
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
.sec{font-size:16px;color:#1a3a6b;border-bottom:2px solid #e0e8f4;padding-bottom:8px;margin:28px 0 16px}
.box{background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;padding:20px 24px;font-size:14px;line-height:1.8}
.foot{background:#f0f0ed;padding:20px 32px;font-size:11px;color:#aaa;font-family:monospace}
</style></head><body>
<div class="wrap">
<div class="hdr"><h1>⚡ Licitación para postular</h1><p>Radar MP · Cordero Asociados · ${ahora}</p></div>
<div class="body">
<span class="badge">✓ POSTULAR — marcado por ${marcadoPor || 'Dashboard'}</span>
${licit.score?.esCiudadPreferida === false ? '<div class="alerta">⚠ Licitación fuera de Santiago/Concepción — verificar si el monto justifica traslado.</div>' : ''}
<div class="ficha"><table>
<tr><td>Código</td><td>${licit.codigo}</td></tr>
<tr><td>Nombre</td><td>${licit.nombre}</td></tr>
<tr><td>Organismo</td><td>${licit.organismo}</td></tr>
<tr><td>Ciudad / Región</td><td>${licit.ciudad} — ${licit.region}</td></tr>
<tr><td>Monto estimado</td><td>${formatMonto(licit.monto)}</td></tr>
<tr><td>Fecha cierre</td><td>${formatFecha(licit.fechaCierre)}</td></tr>
<tr><td>Comisión colaborador</td><td>${comision ? '$' + comision.toLocaleString('es-CL') + ' (7%)' : 'Por definir'}</td></tr>
</table></div>
<a href="${licit.url}" class="btn">Ver licitación en Mercado Público →</a>
<h2 class="sec">📋 Tu tarea: Oferta Técnica y Económica</h2>
<div class="box">${estructuraOferta || '<p><strong>1. Resumen ejecutivo</strong></p><p><strong>2. Metodología propuesta</strong></p><p><strong>3. Equipo y experiencia</strong></p><p><strong>4. Propuesta de valor</strong></p><p><strong>5. Cronograma</strong></p><p><strong>6. Oferta económica</strong></p>'}</div>
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
<div class="hdr"><h1>📂 Nueva postulación — Documentación</h1><p>Radar MP · Cordero Asociados · ${ahora}</p></div>
<div class="body">
<p style="font-size:14px;color:#555;margin-bottom:20px">Cristián ha marcado esta licitación para postular. Tu tarea es gestionar toda la documentación y subida a Mercado Público.</p>
<div class="ficha"><table>
<tr><td>Código</td><td>${licit.codigo}</td></tr>
<tr><td>Nombre</td><td>${licit.nombre}</td></tr>
<tr><td>Organismo</td><td>${licit.organismo}</td></tr>
<tr><td>Ciudad / Región</td><td>${licit.ciudad} — ${licit.region}</td></tr>
<tr><td>Monto estimado</td><td>${formatMonto(licit.monto)}</td></tr>
<tr><td>Fecha cierre</td><td>${formatFecha(licit.fechaCierre)}</td></tr>
</table></div>
<a href="${licit.url}" class="btn">Ver licitación en Mercado Público →</a>
<h2 class="sec">📋 Tu checklist de documentación</h2>
<div class="check"><ul>
<li>Descargar y revisar bases de licitación completas</li>
<li>Verificar documentos habilitantes requeridos (RUT, escrituras, certificados)</li>
<li>Coordinar con Cristián la oferta técnica y económica</li>
<li>Preparar y subir todos los documentos a Mercado Público</li>
<li>Confirmar recepción y número de postulación</li>
<li>Hacer seguimiento del estado en el dashboard</li>
<li>Notificar resultado (adjudicada / no adjudicada)</li>
</ul></div>
${comision ? `<div class="comision"><span class="monto">${'$' + comision.toLocaleString('es-CL')}</span><span class="lbl">Tu comisión estimada si adjudicamos (7% del monto)</span></div>` : ''}
</div>
<div class="foot">Radar MP · Sistema automático Cordero Asociados · No responder este correo</div>
</div></body></html>`;

    const [r1, r2] = await Promise.all([
      enviarEmail(EMAIL_CRISTIAN, `⚡ Postular: ${licit.nombre.substring(0, 60)}`, htmlCristian),
      enviarEmail(EMAIL_COLABORADOR, `📂 Documentación requerida: ${licit.nombre.substring(0, 50)}`, htmlColaborador)
    ]);

    return res.status(200).json({ ok: true, emails: { cristian: r1, colaborador: r2 } });
  }

  return res.status(200).json({ ok: true, mensaje: 'Acción registrada sin email' });
}
