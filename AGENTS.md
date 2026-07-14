# AGENTS.md — SaaS Empresarial

Monorepo ERP con arquitectura modular. Vite + React 19 (JSX plano, sin TypeScript).
Auth con Supabase y autorización RBAC (roles + permisos). Routing con React Router v7.
i18n con 3 idiomas (ES/EN/PT-BR).

## Estructura

```
saas-empresarial/
├── package.json              ← npm workspaces: ["packages/*", "apps/*"]
├── packages/
│   ├── core/         (@saas/core)     ← Auth, theme, componentes base, i18n, layouts, lib, routes
│   ├── crm/          (@saas/crm)      ← Módulo CRM: páginas, data layer, navItems
│   ├── srm/          (@saas/srm)      ← Módulo SRM: proveedores, OC, facturas, scorecard
│   ├── facturacion/  (@saas/facturacion) ← Facturación electrónica e-kuatia/SIFEN
│   ├── productos/    (@saas/productos) ← Catálogo de productos/servicios
│   ├── accounting/   (@saas/accounting) ← Contabilidad: impuestos, plan de cuentas, asientos, reportes
│   ├── inventario/   (@saas/inventario) ← Inventario: stock, almacenes, picking, remitos, valuación
│   ├── whatsapp/     (@saas/whatsapp) ← Módulo WhatsApp independiente (Twilio)
│   └── rrhh/         (@saas/rrhh)    ← RRHH: empleados, contratos, asistencia, ausencias, vacaciones
└── apps/
    └── erp/                    ← App final que ensambla core + módulos
```

## Comandos (npm desde raíz)

- `npm run dev` — servidor Vite (HMR) para apps/erp
- `npm run build` — build producción
- `npm run preview` — sirve dist/
- `npm run lint` — ESLint en todos los paquetes
- `node scripts/mock-sifen.js` — Mock SIFEN local (puerto 3001)

## Edge Functions

| Función | verify_jwt | Propósito |
|---------|-----------|-----------|
| `company-signup` | false | Registro público + creación de empresa |
| `get-user-permissions` | true | Permisos resueltos por empresa |
| `crear-usuario` | true | Crear usuario + asignar a empresa |
| `form-webhook` | false | Recibir leads desde formularios externos |
| `summarize-contact` | true | Resumen IA de interacciones |
| `draft-email` | true | Redacción de correos con IA |
| `send-whatsapp` | true | Envío de WhatsApp vía Twilio |
| `whatsapp-webhook` | false | Recibir mensajes entrantes de WhatsApp (busca en contacts + proveedores) |
| `cobranza-auto` | false | Cobranza automática por WhatsApp (cron) |
| `send-push` | true | Notificaciones push (PWA) |
| `consultar-ruc` | true | Consulta RUC Paraguay |
| `score-contact` | true | Lead scoring con IA |
| `summarize-contact` | true | Resumen IA de contacto |

Deploy: `cd apps/erp && supabase functions deploy <nombre>`

## Funcionalidades implementadas

### CRM
- Dashboard con KPIs + embudo + proyección + widget metas
- Contactos (con RUC, DV, tipo documento, país, dirección, tags)
- Empresas (con RUC lookup)
- Pipeline de ventas (Kanban + tabla)
- Cotizaciones/Proformas con items + WhatsApp + PDF
- Leads (desde webhook + formulario público)
- Actividades + Timeline
- Reportes (velocidad de ventas + tasa de conversión)
- Tags por contacto (creación inline, colores, filtro visual)

### Catálogo de productos (@saas/productos)
- Package independiente, no depende del CRM
- Productos y servicios con código auto-generado (PRO-0001 / SER-0001)
- Tipo de unidad de medida desde DB (UNI, HR, KG, etc.)
- Moneda por producto (PYG, USD, ARS, BRL, etc.)
- Importar/exportar CSV
- Selector de productos en cotizaciones

### Comunicaciones
- Envío de WhatsApp (Twilio)
- Plantillas WhatsApp reutilizables
- Webhook entrante de WhatsApp
- Redacción de correos con IA

### Facturación electrónica
- Package `@saas/facturacion` independiente (no depende de CRM)
- Generación XML Kude v150 completo (según schema SIFEN)
- CDC de 44 caracteres con dígito verificador
- Firma digital placeholder + QR
- Receptor condicional (con RUC o con documento alternativo)
- Mock SIFEN local para desarrollo
- Config por país (PY, AR, CL, CO, PE, BR, etc.)
- Cobranza automática por WhatsApp (cron)

### PWA + Notificaciones Push
- Manifest + Service Worker
- Instalación en Android/Chrome
- Push notifications (VAPID keys)
- Banner de activación de notificaciones
- EF `send-push` para enviar desde cualquier evento

### Metas de ventas
- Configuración por vendedor + mes + año
- Widget en Dashboard con barra de progreso
- Cálculo automático basado en deals ganados
- Colores: verde >= 100%, amarillo >= 50%, rojo < 50%

### Multi-local
- Sucursales: misma empresa, mismo RUC, distinto establecimiento
- Contadores de factura independientes por sucursal
- Selector de empresas en dropdown

### SRM (Supply Relationship Management) — @saas/srm
- Proveedores: CRUD con RUC, contacto, categoría, estado
- Órdenes de compra: CRUD con items, PDF, WhatsApp directo con cambio de estado automático
- Recepción parcial de mercadería (modal con inputs por item, recepcion_items)
- Calendario de pagos: vista consolidada de cuentas por pagar a 7/15/30 días
- Match de facturas (Cotejo 3 vías): OC ↔ Recepción ↔ Factura del proveedor con indicadores ✅/❌
- Scorecard de proveedores: KPIs automáticos (entrega, cantidad, precio) + manuales (calidad, comunicación) con gráfico de estrellas
- Alertas de vencimiento de documentos: registro de documentos por proveedor + envío automático de WhatsApp al detectar vencimientos
- Historial de precios: evolución de precios por producto con gráfico recharts LineChart
- Alternativas: directorio de proveedores alternativos por producto con badge "Más barato"
- WhatsApp en perfil: historial de mensajes enviados/recibidos + botón de envío directo
- **Sugerencias de compra**: página `/sugerencias-oc` que detecta stock bajo y genera OC agrupadas por proveedor con el mejor precio

### Contabilidad — @saas/accounting
- Package independiente, no depende de CRM/SRM
- **Impuestos**: grupos (débito fiscal, crédito fiscal, retención compra/venta) con selector multi-impuesto `TaxSelector`
- **Plan de Cuentas**: árbol jerárquico (parent/child) con seed PY (29 cuentas), CRUD desde `/plan-contable`
- **Asientos Contables**: manuales y automáticos (facturas cliente/proveedor, pagos, ajuste de inventario)
  - Anulación (estado `anulado`) y contabilización (`borrador` → `contabilizado`)
  - Source types: `factura_proveedor`, `factura_cliente`, `pago_proveedor`, `pago_cliente`, `ajuste_inventario`, `nota_credito_cliente`, `nota_debito_cliente`, `manual`
- **Reportes Contables**: Balance General, Estado de Resultados (con barChart recharts), Reporte IVA (débito/crédito/a pagar), Mayor Contable (saldo corrido por cuenta)
  - Comparación inter-período (toggle 📊 Comparar con período anterior)
  - Exportación CSV (📥 botón en cada tab)
- **💵 Flujo de Efectivo**: método indirecto simplificado, tab en Reportes Contables
- **🏦 Conciliación Bancaria**: página `/conciliacion` con carga de extracto por CSV, match manual, KPIs
- **📊 Antigüedad de saldos (AP/AR)**: página `/aging` con buckets + gráfico barChart + tabla por entidad
- Integración con catálogo: cuentas de compra/venta por producto
- Cuentas semilla Paraguay: 1.1.5 Inventario, 6.4 Ajuste de Inventario
- **Tipos de cambio**: tabla `tipos_cambio` configurable desde Settings

### Consolidación — 🏢 sección separada
- **Sucursales**: consolida empresas del mismo grupo (`parent_company_id`)
- **Holding**: agrupa empresas independientes (`grupos_holding` + `holding_miembros`)
- **Balance y Resultados consolidados** con toggle 🔗 Eliminar transacciones inter-compañía
- **📒 Asientos de consolidación**: ajustes manuales que solo aplican al consolidado
- **🗓 Calendario de cierre**: marca qué empresas cerraron su mes contable
- **🏢 Por empresa**: tabla con activo/pasivo/resultado de cada entidad del grupo
- **Reportes Contables**: toggle 🏢 Consolidar sucursales en ReportsPage

### Cuentas por Pagar / Cuentas por Cobrar
- **Pagos parciales**: tabla `pagos_proveedor` y `cobros_cliente` con monto, fecha, medio de pago, referencia
- **Medios de pago**: Efectivo, Cheque, Transferencia, Tarjeta (configurable desde DB)
- **Saldo pendiente** automático: se actualiza al registrar cada pago/cobro
- **Antigüedad (AP/AR)**: buckets por rango de días + agrupado por proveedor/cliente
- **Dashboard widgets**: total AP/AR, vencido, por vencer
- **Calendario de Pagos**: migrado de OC a facturas de proveedor
- **Página Cuentas por Cobrar** (`/cuentas-cobrar`) y **Cuentas por Pagar** (`/cuentas-pagar`)
- **Términos de pago configurables**: `payment_terms_days` en perfil de empresa

### Notas de Crédito/Débito — @saas/facturacion
- Soporte para tipoDE 5 (NC) y 6 (ND) del schema SIFEN
- CDC independiente + XML con referencia a factura original
- Asiento contable automático (reversión para NC, adicional para ND)
- Actualización de `saldo_pendiente` en la factura original
- Página `/notas-cd` con lista, formulario y detalle
- Mock SIFEN reconoce NC/ND por `<iDTE>05</iDTE>`/`<iDTE>06</iDTE>`

### RRHH — @saas/rrhh
- **Fase 1 — Datos maestros**: empleados con histórico (vigencia_desde/vigencia_hasta)
  - Departamentos, puestos, contratos (histórico)
  - Datos bancarios y fiscales con histórico
  - Documentos múltiples (CI, RUC, Pasaporte, Licencia) con vigencia
  - Cada tab del formulario guarda independientemente
- **Fase 2 — Asistencia**:
  - Calendario mensual con marcación entrada/salida por día
  - Modal para marcar presente/ausente
  - Ausencias con solicitud y aprobación (✅/❌)
  - Vacaciones con saldo anual, solicitud y aprobación
  - **Cálculo automático**: días según antigüedad + `dias_adicionales` ajustable por admin
  - **Reglas configurables**: desde Settings (rangos de años → días)
- **Importación biométrica**:
  - Carga de CSV con código, fecha, hora
  - **Inferencia inteligente**: detecta jornadas por umbral de brecha (default 3h)
  - **Pre-entradas**: jornadas < mínimo (default 30 min) se marcan como pre-entrada y se ignoran
  - Cruce de medianoche detectado automáticamente
  - Preview antes de importar + vinculación por `codigo_biometrico`
  - Dispositivos configurables con parámetros por dispositivo

### Inventario — @saas/inventario
- Package independiente, no depende de CRM/SRM/Accounting
- **Centros logísticos** + **Almacenes** (general/refrigerado/congelado/peligroso/cuarentena)
- **Stock actual** con cantidad y costo promedio ponderado
- **Movimientos de stock** (entrada/salida) con costo promedio automático
- **Transferencias** entre almacenes
- **Kardex por lote** con saldo corrido
- **Conteos cíclicos** con carga de resultados, diferencias (🟢/🟡/🔴), ajuste automático de stock
  - Al ajustar → genera **asiento contable automático** (1.1.5 Inventario ↔ 6.4 Ajuste de Inventario)
- **Picking / Preparación**: orden desde factura, preparación por items, despacho con transportista
- **Remitos**: generación al despachar, vista imprimible
- **Transportistas**: CRUD
- **Ubicaciones**: pasillo/estante/posición por almacén
- **Valuación de inventario**: página `/valuacion` con valor total del stock (cantidad × costo promedio) por almacén + gráfico barChart
- Integración con FacturarModal: descuenta stock + genera picking automático
- Dashboard widget: productos con stock bajo el mínimo

### Sidebar

```
👥 Ventas
  Empresas, Contactos, Leads, Oportunidades, Calendario, Actividades, Reportes, Cotizaciones

💰 Finanzas
  Cuentas por Cobrar, Alertas venc. clientes, Notas C/D, Calendario de Pagos, Cuentas por Pagar,
  Impuestos, Plan de Cuentas, Asientos, Reportes Contables, Antigüedad de saldos, Conciliación bancaria

🏢 Consolidación (solo casa matriz)
  Consolidación

📦 Compras
  Proveedores, Órdenes de compra, Facturas proveedor, Scorecard, Alertas vencimiento,
  Historial precios, Sugerencias de compra

👥 RRHH
  Empleados, Asistencia, Importar marcaciones, Ausencias, Vacaciones

📦 Inventario
  Catálogo, Stock actual, Movimientos, Transferencias, Kardex, Conteos, Ubicaciones,
  Picking, Remitos, Valuación, Transportistas, Centros, Almacenes

⚙️ Administración
  Settings
```
- Selector de país en registro
- RUC/CUIT/RUT/NIT/CNPJ según país
- Moneda local (PYG, ARS, CLP, COP, PEN, UYU, BOB, MXN, BRL)
- Auto-locale i18n (BR → pt-BR, resto → es)
- Formato de número regional
- Tooltips informativos en configuración de facturación

### Localización LATAM
- Selector de país en registro
- RUC/CUIT/RUT/NIT/CNPJ según país
- Moneda local (PYG, ARS, CLP, COP, PEN, UYU, BOB, MXN, BRL)
- Auto-locale i18n (BR → pt-BR, resto → es)
- Formato de número regional
- Tooltips informativos en configuración de facturación

### Mobile
- Tablas responsive con data-label
- Kanban apilado vertical
- Items de cotización como tarjetas
- Header sticky con hamburger menu
- Sidebar con overlay

## Inteligencia Artificial

Provider abstraction en `supabase/functions/_shared/ai-provider.js`:
- OpenAI, Together, Groq, Anthropic, Ollama
- `AI_PROVIDER` env var (default `openai`)
- `callAI(messages, options)` → `{ content, model, usage }`

Features:
- Resumen IA de contacto
- Lead Scoring
- Redacción de correos

## DB (apps/erp/docs/)

Ejecutar en orden:
1. `crm-setup.sql` — tablas base
2. `leads-setup.sql` — webhook tokens
3. `email-templates-setup.sql` — plantillas
4. `reports-setup.sql` — RPCs de reportes
5. `cold-leads-setup.sql` — last_activity_at
6. `agenda-setup.sql` — assigned_to en activities
7. `industries-setup.sql` — industrias
8. `timeline-setup.sql` — triggers
9. `ruc-setup.sql` — RUC en organizations
10. `notificaciones-setup.sql` — notificaciones
11. `round-robin-setup.sql` — asignación de leads
12. `dashboard-kpi-setup.sql` — columna closed_at
13. `ai-setup.sql` — columnas IA
14. `localizacion-setup.sql` — columna pais en companies
15. `paises-setup.sql` — tabla paises
16. `actividades-setup.sql` — actividades económicas
17. `cotizaciones-setup.sql` — cotizaciones
18. `perfil-empresa-setup.sql` — dirección, teléfono, facturación
19. `empresa-rpc-setup.sql` — RPC actualizar_empresa
20. `facturacion-setup.sql` — tabla facturas + contadores
21. `contacts-setup.sql` — campos fiscales en contacts
22. `sucursales-setup.sql` — drop índice único RUC + RPC crear_sucursal
23. `cobranza-setup.sql` — tabla cobranza_config
24. `catalogo-setup.sql` — tabla catalogo_productos
25. `unidades-setup.sql` — tabla unidades_medida
26. `metas-setup.sql` — tabla metas_ventas
27. `tags-setup.sql` — tabla tags + contact_tags + deal_tags
28. `push-setup.sql` — tabla push_subscriptions
29. `srm-setup.sql` — SRM: proveedores, OC, recepciones, evaluaciones
30. `pagos-setup.sql` — RPC calendario de pagos
31. `facturas-proveedor-setup.sql` — facturas de proveedor + RPC cotejar_factura
32. `scorecard-setup.sql` — scorecard proveedores + RPCs
33. `alertas-vencimiento-setup.sql` — documentos de proveedor + RPC alertas
34. `historial-precios-setup.sql` — RPCs historial de precios
35. `alternativas-setup.sql` — RPC productos con alternativas
36. `whatsapp-setup.sql` — tabla notificaciones_whatsapp + proveedor_id
37. `inventario-setup.sql` — inventario: producto_stock, movimientos, conteos, picking, remitos, centros, almacenes
38. `accounting-setup.sql` — contabilidad: impuestos, plan de cuentas, asientos, reportes
39. `sugerencias-oc-setup.sql` — RPC `productos_stock_bajo_con_proveedores`
40. `ajuste-inventario-setup.sql` — RPC `generar_asiento_ajuste_inventario` + columna `asiento_id` en conteos
41. `cuentas-pagar-cobrar-setup.sql` — medios_pago, pagos_proveedor, cobros_cliente + aging RPCs
42. `notas-credito-debito-setup.sql` — NC/ND, contadores, asiento contable
43. `anular-factura-setup.sql` — RPC `anular_factura_cliente`
44. `consolidacion-setup.sql` — parent_company_id + RPCs consolidación
45. `consolidacion-avanzada-setup.sql` — is_intercompany, consolidacion_asientos
46. `holding-setup.sql` — grupos_holding, holding_miembros
47. `reportes-consolidados-setup.sql` — RPCs consolidados para reportes
48. `conciliacion-setup.sql` — extractos_bancarios, conciliaciones
49. `calendario-cierre-setup.sql` — cierres_contables
50. `tipos-cambio-setup.sql` — tipos_cambio
51. `flujo-efectivo-setup.sql` — RPC reporte_flujo_efectivo
52. `rrhh-setup.sql` — RRHH: empleados, contratos, bancario, fiscal, documentos (histórico)
53. `rrhh-asistencia-setup.sql` — asistencia, ausencias, vacaciones, reglas
54. `rrhh-biometrico-setup.sql` — dispositivos_biometricos, marcaciones_biometricas

## Pendiente (post-PY)

### 🌍 Configuración laboral multi-país
- Tabla `configuracion_laboral` con franja nocturna, % HE, jornada legal por país
- RPC `calcular_control_horario` leer valores de la tabla (no hardcode)
- Seed de feriados por país parametrizable
- UI en Settings: selector de país laboral para la empresa
- Archivo: `docs/rrhh-multipais-setup.sql` (nuevo)
