// api/resumen-semanal.js
// Envía resumen los lunes a las 8am (activar via Vercel Cron)

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const EMAIL_CRISTIAN = 'cristian@cristiancordero.cl';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_YxNrtRsN_Dt4zcQ2fWE3EF4ndGZvQwnwe';
const FROM = 'Radar MP <onboarding@resend.dev>';

function formatMonto(m) {
  if (!m) return '—';
  return '$' + Number(m).toLocaleString('es-CL');
}

function formatFecha(f) {
  if (!f) return '—';
  try { return new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }); }
  catch { return f; }
}

function diasRestantes(f) {
  if (!f) return null;
  const diff = new Date(f) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default async function handler(req, res) {
  // Solo GET para cron, o POST para test manual
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Obtener estado del dashboard (licitaciones guardadas)
  // En producción esto vendría de una base de datos; aquí usamos la API de licitaciones activas
  let postulaciones = [];
  let licitacionesActivas = [];

  try {
    const ticket = process.env.MP_TICKET || 'F8537A18-6766-4DEF-9E59-426B4FEE2844';
    const mpRes = await fetch(
      `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=activas&ticket=${ticket}`,
      { timeout: 10000 }
    );
    const mpData = await mpRes.json();
    licitacionesActivas = mpData?.Listado || [];
  } catch(e) {
    licitacionesActivas = [];
  }

  // Contar por relevancia (scoring básico)
  const keywords = ['consultoría','iso','capacitación','auditoría','gestión','prevención'];
  const relevantes = licitacionesActivas.filter(l => {
    const txt = (l.Nombre + ' ' + l.Descripcion).toLowerCase();
    return keywords.some(k => txt.includes(k));
  });

  // Próximas a vencer (en los próximos 7 días)
  const porVencer = relevantes.filter(l => {
    const dias = diasRestantes(l.FechaCierre);
    return dias !== null && dias >= 0 && dias <= 7;
  });

  const ahora = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
body{font-family:Georgia,serif;background:#f8f8f6;margin:0;padding:0}
.wrap{max-width:640px;margin:0 auto;background:#fff}
.hdr{background:#1a3a6b;padding:32px}
.hdr h1{color:#fff;font-size:22px;margin:0}
.hdr p{color:rgba(255,255,255,0.55);font-size:12px;margin:8px 0 0;font-family:monospace}
.body{padding:32px}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:32px}
.stat{background:#f4f7ff;border-radius:8px;padding:20px;text-align:center;border:1px solid #dde8f8}
.stat .n{font-size:36px;font-weight:bold;color:#1a3a6b}
.stat .l{font-size:11px;color:#666;font-family:monospace;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
.sec{font-size:16px;color:#1a3a6b;border-bottom:2px solid #dde8f8;padding-bottom:8px;margin:24px 0 16px}
.alerta{background:#fff0f0;border-left:4px solid #c0392b;padding:12px 16px;margin-bottom:12px;border-radius:0 6px 6px 0}
.alerta .nombre{font-size:14px;font-weight:bold;color:#333}
.alerta .meta{font-size:12px;color:#888;font-family:monospace;margin-top:4px}
.dias-badge{display:inline-block;background:#fdeaea;color:#c0392b;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold}
.licit-row{padding:12px 0;border-bottom:1px solid #eee}
.licit-row .nombre{font-size:14px;font-weight:600;color:#222}
.licit-row .meta{font-size:12px;color:#888;font-family:monospace;margin-top:3px}
.btn{display:inline-block;background:#1a3a6b;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold}
.foot{background:#f0f0ed;padding:20px 32px;font-size:11px;color:#aaa;font-family:monospace}
.empty{color:#aaa;font-size:14px;font-style:italic}
</style></head><body>
<div class="wrap">
<div class="hdr">
  <h1>📊 Resumen semanal — Radar MP</h1>
  <p>Cordero Asociados · ${ahora}</p>
</div>
<div class="body">

<div class="grid">
  <div class="stat"><div class="n">${licitacionesActivas.length}</div><div class="l">Activas en MP</div></div>
  <div class="stat"><div class="n" style="color:#1a6b3a">${relevantes.length}</div><div class="l">Relevantes</div></div>
  <div class="stat"><div class="n" style="color:#b03020">${porVencer.length}</div><div class="l">Vencen esta semana</div></div>
</div>

${porVencer.length > 0 ? `
<h2 class="sec">⚠ Vencen en los próximos 7 días</h2>
${porVencer.slice(0,5).map(l => {
  const dias = diasRestantes(l.FechaCierre);
  return `<div class="alerta">
    <div class="nombre">${l.Nombre || 'Sin nombre'}</div>
    <div class="meta">${l.NombreOrganismo || '—'} · Cierre: ${formatFecha(l.FechaCierre)} <span class="dias-badge">${dias} día${dias !== 1 ? 's' : ''}</span></div>
  </div>`;
}).join('')}` : ''}

<h2 class="sec">🎯 Licitaciones relevantes esta semana</h2>
${relevantes.length > 0 ? relevantes.slice(0,8).map(l => `
<div class="licit-row">
  <div class="nombre">${l.Nombre || 'Sin nombre'}</div>
  <div class="meta">${l.NombreOrganismo || '—'} · Cierre: ${formatFecha(l.FechaCierre)} · ${l.MontoEstimado ? formatMonto(l.MontoEstimado) : 'Monto no publicado'}</div>
</div>`).join('') : '<p class="empty">No hay licitaciones relevantes activas esta semana.</p>'}

<br><br>
<a href="${process.env.DASHBOARD_URL || 'https://radar-mp.vercel.app'}" class="btn">Abrir Dashboard →</a>

</div>
<div class="foot">Radar MP · Resumen automático cada lunes 8:00 AM · Cordero Asociados</div>
</div></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [EMAIL_CRISTIAN],
      subject: `📊 Resumen semana ${ahora} — ${relevantes.length} licitaciones relevantes`,
      html
    })
  });

  res.status(200).json({ ok: true, enviado: true, relevantes: relevantes.length, porVencer: porVencer.length });
}
