# CRM — Pendientes

## 1. 🔴 Factura real SIFEN (e-kuatia)
Conectar con producción. Incluye:
- Firma digital XML con certificado .p12
- Cliente SOAP para WS de SIFEN
- Cálculo de hash QR con CSC
- CDC con formato oficial de 44 caracteres

## 2. 🟡 API REST pública
Endpoints para que apps externas integren con el CRM:
- `GET /api/contacts`, `POST /api/contacts`
- `GET /api/deals`, `POST /api/deals`
- `POST /api/leads` (alternativa al form-webhook)
- API Key management

## 3. 🟢 Exportar XML Kude
Botón en la factura para descargar el XML generado.

## 4. ⚪ Verificar códigos de actividad económica
Reemplazar los códigos del seed actual con los códigos oficiales del MIC/SET.

## 5. 🔵 Sincronización Email / Calendario
Sincronización bidireccional con Gmail/Outlook para que correos y eventos
aparezcan automáticamente en el historial del CRM.

**Esfuerzo:** 🔴 Muy alto (OAuth 2.0, APIs, webhooks, tokens por usuario)
**Impacto:** 🟡 Medio
**Prioridad:** Baja — diferido hasta completar features de mayor impacto para LATAM.

