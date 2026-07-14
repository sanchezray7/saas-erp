# SaaS Empresarial — CRM LATAM

ERP modular con CRM, SRM (proveedores), facturación electrónica (e-kuatia/SIFEN),
WhatsApp Business, catálogo de productos, contabilidad, inventario, RRHH,
metas de ventas y multi-localización para PYMEs latinoamericanas.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Vite 6, Tailwind 4 |
| Backend | Supabase (Auth, DB, Edge Functions, RLS) |
| Mensajería | Twilio WhatsApp API |
| AI | OpenAI / Groq / Together / Anthropic / Ollama |
| PWA | Service Worker + Web Push API |
| Monorepo | npm workspaces |

## Estructura

```
saas-empresarial/
├── apps/erp/                   ← App final
│   ├── src/                    ← Router + CSS
│   ├── public/                 ← Manifest, SW, iconos PWA
│   ├── supabase/               ← Edge Functions + config
│   │   └── functions/
│   │       ├── company-signup/       ← Registro público
│   │       ├── get-user-permissions/ ← Permisos
│   │       ├── crear-usuario/       ← Invitar miembros
│   │       ├── form-webhook/        ← Captura de leads
│   │       ├── summarize-contact/   ← IA resumen
│   │       ├── draft-email/         ← IA correos
│   │       ├── send-whatsapp/       ← Enviar WhatsApp
│   │       ├── whatsapp-webhook/    ← Recibir WhatsApp
│   │       ├── cobranza-auto/       ← Cobranza automática
│   │       ├── send-push/           ← Push notifications
│   │       ├── consultar-ruc/       ← RUC lookup
│   │       └── _shared/             ← Helpers compartidos
│   └── docs/                   ← Migraciones SQL (36 archivos)
├── packages/
│   ├── core/    (@saas/core)   ← Auth, UI, i18n, layouts
│   ├── crm/     (@saas/crm)    ← CRM pages + data
│   ├── srm/     (@saas/srm)    ← SRM: proveedores, OC, facturas, scorecard
│   ├── facturacion/ (@saas/facturacion) ← Facturación electrónica
│   ├── productos/ (@saas/productos) ← Catálogo de productos
│   ├── accounting/ (@saas/accounting) ← Contabilidad: impuestos, plan de cuentas, asientos, reportes
│   ├── inventario/ (@saas/inventario) ← Inventario: stock, picking, conteos, remitos, valuación
│   ├── rrhh/       (@saas/rrhh)       ← RRHH: empleados, asistencia, ausencias, vacaciones, biométrico
│   └── whatsapp/ (@saas/whatsapp) ← Módulo WhatsApp independiente
└── scripts/
    ├── mock-sifen.js           ← Mock SIFEN local
    └── deploy-edge-functions.ps1 ← Deploy de EFs
```

## Instalación

### Requisitos

- Node.js 18+
- npm 9+
- Cuenta Supabase
- Cuenta Twilio (para WhatsApp)

### Pasos

```bash
# 1. Clonar
git clone <repo>
cd saas-empresarial

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con:
#   VITE_SUPABASE_URL=https://<ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon-key>
#   VITE_RUC_API_KEY=<key> (opcional, para lookup de RUC Paraguay)
#   VITE_VAPID_PUBLIC_KEY=<key> (opcional, para push notifications)

# 4. Iniciar desarrollo
npm run dev
```

### Base de datos

Ejecutar los SQL en orden desde `apps/erp/docs/` en el SQL Editor de Supabase.
Ver `AGENTS.md` para la lista completa con el orden recomendado.

## Configuración de servicios externos

### Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. En Settings → API: copiar `Project URL` y `anon public key` a `.env.local`
3. En SQL Editor: ejecutar migraciones de `apps/erp/docs/` en orden
4. En Edge Functions: link del proyecto:
   ```bash
   cd apps/erp
   npx supabase login
   npx supabase link --project-ref <ref>
   ```
5. Setear secrets:
   ```bash
   npx supabase secrets set SERVICE_ROLE_KEY=<key>
   npx supabase secrets set TWILIO_ACCOUNT_SID=<sid>
   npx supabase secrets set TWILIO_AUTH_TOKEN=<token>
   npx supabase secrets set TWILIO_WHATSAPP_FROM=<numero>
   npx supabase secrets set AI_PROVIDER=groq
   npx supabase secrets set GROQ_API_KEY=<key>
   npx supabase secrets set COBRANZA_SECRET_KEY=<clave>
   npx supabase secrets set VAPID_PUBLIC_KEY=<key>
   npx supabase secrets set VAPID_PRIVATE_KEY=<key>
   ```

### Twilio (WhatsApp)

1. Crear cuenta en [twilio.com](https://twilio.com)
2. Ir a WhatsApp → Sandbox
3. Copiar el número asignado (ej: `+14155238886`)
4. Configurar el webhook entrante:
   - **When a message comes in:** `https://<ref>.supabase.co/functions/v1/whatsapp-webhook`
   - **Method:** HTTP Post
5. Setear secrets en Supabase (ver arriba)
6. Los clientes deben enviar `join <sandbox-name>` al número de Twilio para opt-in

### VAPID Keys (Push Notifications)

```bash
# Opcional: generar usando npx
npx web-push generate-vapid-keys
# O usar https://vapidkeys.com

# Setear en Supabase
supabase secrets set VAPID_PUBLIC_KEY=<key>
supabase secrets set VAPID_PRIVATE_KEY=<key>

# Agregar a .env.local
VITE_VAPID_PUBLIC_KEY=<key>
```

### Cron (Cobranza automática)

La cobranza automática necesita un cron job diario.

#### Opción 1: cron-job.org (recomendado, gratis)

1. Crear cuenta en [cron-job.org](https://cron-job.org)
2. Crear nuevo cron job:
   - **Title:** `Cobranza CRM`
   - **URL:** `https://<ref>.supabase.co/functions/v1/cobranza-auto?key=TU_SECRET`
   - **Method:** GET
   - **Cron Expression:** `0 8 * * *` (diario a las 08:00)
   - **Time zone:** `America/Asuncion`
   - Habilitar y guardar

#### Opción 2: GitHub Actions

Crear `.github/workflows/cobranza.yml`:
```yaml
name: Cobranza automática
on:
  schedule:
    - cron: '0 11 * * *'
jobs:
  cobranza:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS "https://<ref>.supabase.co/functions/v1/cobranza-auto?key=${{ secrets.COBRANZA_SECRET }}"
```

### Formulario público de leads

Settings → Webhook → copiar el "Link público" → compartir en redes sociales, WhatsApp, email.

## Mock SIFEN (facturación electrónica)

```bash
node scripts/mock-sifen.js

# Endpoints en http://localhost:3001:
#   POST /sifen/recepcion   → { estado, cdc }
#   GET  /sifen/consulta/:cdc
#   GET  /sifen/estado

# Configurar app:
#   VITE_SIFEN_URL=http://localhost:3001/sifen
```

## Edge Functions — Deploy

```bash
cd apps/erp

# Deploy individual
supabase functions deploy send-whatsapp

# Deploy todas
..\scripts\deploy-edge-functions.ps1 -ProjectRef <ref>
```

## Licencias

- SaaS Empresarial: código privado
- Librerías externas: sus respectivas licencias
