# Radar MP — Cordero Asociados

Dashboard para monitoreo de licitaciones en Mercado Público con IA.

## Deploy en Vercel

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "Radar MP inicial"
git remote add origin https://github.com/TU_USUARIO/radar-mp.git
git push -u origin main
```

### 2. Conectar con Vercel
- Ir a vercel.com → New Project → importar el repositorio
- En "Environment Variables" agregar:
  - `ANTHROPIC_API_KEY` = tu API key de Anthropic
  - `RESEND_API_KEY` = re_YxNrtRsN_Dt4zcQ2fWE3EF4ndGZvQwnwe
  - `MP_TICKET` = tu ticket de Mercado Público
  - `DASHBOARD_URL` = https://radar-mp.vercel.app (la URL que te dé Vercel)

### 3. Deploy
Vercel despliega automáticamente al hacer push a main.

## Estructura
```
radar-mp/
  api/
    licitaciones.js    — Obtiene y filtra licitaciones de MP
    postular.js        — Envía emails al postular
    resumen-semanal.js — Resumen automático lunes 8am
  public/
    index.html         — Dashboard principal
  vercel.json          — Config Vercel + cron
  package.json
```

## Clave de acceso
`RadarMP2026`

## Emails configurados
- Cristián: cristian@cristiancordero.cl
- Colaborador: corderomercado6@gmail.com
