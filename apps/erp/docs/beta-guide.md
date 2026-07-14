# Guía de Configuración para Beta Testers

**App:** https://saas-erp-staging.netlify.app  
**Rama:** `staging` • **Repo:** github.com/sanchezray7/saas-erp

---

## Primeros pasos

1. **Crear cuenta** en la URL de arriba (Registrarse). El email se auto-confirma.
2. **Completar perfil de empresa**: Settings → Perfil de empresa — nombre fiscal, RUC/RIF/CUIT, país, dirección, teléfono.
3. **Invitar miembros**: Settings → Miembros — agregar usuarios con rol Admin/Vendedor/Supervisor/Viewer.
4. **Verificar roles**: Cada miembro tiene permisos según su rol definidos en `role_permissions`.

---

## Catálogo de Productos

La base de todo el sistema. Sin productos no se puede facturar, comprar ni controlar stock.

**Seed precargado:** 25 unidades de medida (KG, UNI, CAJ, HR, etc.).

**Pasos:**
1. Ir a **Productos** (sidebar).
2. Click en **"+ Nuevo producto"**.
3. Completar: nombre, código (se autogenera), unidad, precio, costo.
4. Opcional: asociar impuestos, cuentas contables, proveedores.
5. Repetir para cada producto/servicio que maneje.

> Consejo: puede importar productos desde CSV usando el botón de importación.

---

## CRM (Clientes)

**Seed precargado:**
- Pipeline por defecto con 6 etapas.
- 18 industrias (Tecnología, Salud, Educación, etc.).

**Pasos:**
1. **Crear contactos**: Contactos → "+ Nuevo" — nombre, email, teléfono, empresa.
2. **Crear organizaciones** (opcional): Organizaciones → "+ Nueva".
3. **Crear oportunidades**: Oportunidades → "+ Nueva" — asociar contacto, pipeline, etapa, monto.
4. **Configurar actividades**: Log de llamadas, emails, reuniones desde el timeline del contacto.
5. **Dashboard**: KPIs automáticos de ventas, embudo, metas.

> Acciones rápidas: desde el detalle del contacto puede llamar, enviar email o WhatsApp, crear cotización.

---

## Facturación

**Seed precargado:** 40 actividades económicas (códigos SIFEN).

**Pasos:**
1. **Settings → Facturación**: configurar datos fiscales (RUC facturación, timbrado, establecimiento 001, punto de expedición 001, CSC + ID CSC, actividad económica).
2. **Crear cotización**: Oportunidades → abrir una → "Cotizar" o ir a Cotizaciones → "+ Nueva".
3. **Aprobar cotización**: Cambiar estado a "Aprobada".
4. **Facturar**: Desde la cotización aprobada, click en "Facturar".
5. **Cobrar**: Registrar pago desde la factura emitida.
6. **Notas de Crédito/Débito**: Desde una factura emitida, crear NC/ND.

> Para probar sin conexión a DNIT/SIFEN, necesita el mock SIFEN local (preguntar al equipo técnico).

---

## SRM (Proveedores)

Sin seed precargado.

**Pasos:**
1. **Crear proveedores**: Proveedores → "+ Nuevo" — datos fiscales, contacto, condiciones de pago.
2. **Asociar productos**: En el detalle del proveedor, agregar productos que suministra con precio y plazo.
3. **Órdenes de compra**: Órdenes de Compra → "+ Nueva" — seleccionar proveedor, items, confirmar.
4. **Recibir mercadería**: OC confirmada → "Recibir" (actualiza inventario automáticamente).
5. **Facturas de proveedor**: Facturas Proveedor → "+ Nueva" — registrar factura recibida.
6. **Scorecards**: KPIs automáticos (entrega, precio, cantidad) se calculan solos.
7. **Cuentas por pagar**: Calendario de pagos, alertas de vencimiento.

> Para usar Sugerencias de Compra: productos deben tener `stock_minimo > 0` y al menos un proveedor asociado.

---

## Inventario

Sin seed precargado.

**Pasos:**
1. **Centros logísticos**: Inventario → Centros → "+ Nuevo" (ej: "Centro Principal").
2. **Almacenes**: Dentro del centro, crear almacenes (General, Refrigerado, etc.).
3. **Ubicaciones**: Dentro del almacén, crear ubicaciones (pasillo/estante/posición).
4. **Stock inicial**: Ajustar stock manualmente desde Stock Actual o mediante transferencia de entrada.
5. **Transferencias**: Entre almacenes o centros.
6. **Conteos cíclicos**: Crear conteo, registrar ajustes.
7. **Picking y Remitos**: Para preparación y despacho de pedidos.

> El stock se actualiza automáticamente al recibir OC (Compras) y al facturar (Ventas).

---

## Contabilidad

**Seed precargado:** Ninguno. Debe cargar el plan de cuentas manualmente.

**Pasos:**
1. **Plan de Cuentas** → click en **"Cargar plantilla PY"** — crea 29 cuentas base de Paraguay (activo, pasivo, patrimonio, ingresos, gastos).
2. **Impuestos**: Crear grupos (Débito Fiscal, Crédito Fiscal, Retención) y tasas (IVA 5%, IVA 10%, etc.).
3. **Asignar cuentas a impuestos**: cada impuesto necesita una cuenta contable.
4. **Asignar cuentas a productos**: cuenta de compra y venta por producto.
5. **Asientos**: Se generan automáticamente al facturar (cliente), conciliar factura (proveedor), pagar, ajustar inventario.
6. **Reportes**: Balance General, Resultados, IVA, Mayor, Flujo de Efectivo.

> Sin plan de cuentas y sin impuestos configurados, los asientos automáticos fallarán.

---

## RRHH

**Seed precargado:**
- 5 tipos de ausencia (Enfermedad, Personal, Estudio, Licencia, Otro).
- 3 reglas de vacaciones (0-5 años → 12 días, 6-10 → 18, 11+ → 30).
- 3 turnos (Mañana 06-14, Tarde 14-22, Noche 22-06).
- 10 feriados Paraguay 2026.

**Pasos:**
1. **Departamentos y puestos**: se crean inline desde el formulario de empleado.
2. **Crear empleados**: Empleados → "+ Nuevo" — datos personales, laborales, bancarios, contrato, salario.
3. **Asistencia**: Registrar marcaciones manualmente o importar CSV biométrico.
4. **Vacaciones**: Los empleados solicitan → aprobación según reglas configuradas.
5. **Ausencias**: Solicitudes con tipo, fechas, justificación.
6. **Control horario**: Cálculo de horas extras (HE) según legislación PY.
7. **Organigrama**: Vista jerárquica con conectores SVG.
8. **Turnos rotativos**: Crear patrones y asignar a empleados.

> Completar RRHH antes de pasar a Nómina — los empleados deben existir con contratos activos y salarios definidos.

---

## Nómina

**Seed precargado:**
- 16 conceptos PY (SALARIO, HE50, HE100, HE130, NOCTURNIDAD, VACACIONES, AGUINALDO, AUSENCIA, BASE_IPS, BASE_IRP, IPS, IPS_PATRONAL, PRORRATEO_AGUINALDO, ADELANTO_QUINCENAL, ADELANTO_PAGADO, DESCUENTO_ADELANTO).
- Orden de cálculo secuencial (1 a 50).
- Fórmulas entre conceptos (ej: BASE_IPS calculado en base a SALARIO + HE + NOCTURNIDAD).

**Pasos:**
1. **Configurar nómina**: Settings → Nómina — frecuencia (mensual/semanal/quincenal), día de cierre, día de pago, número patronal IPS.
2. **Revisar conceptos**: Verificar que los 16 conceptos seed se hayan creado. Ajustar fórmulas si es necesario.
3. **Asignar cuentas contables** a cada concepto (para asientos automáticos).
4. **Crear período**: Nómina → Períodos → "+ Nuevo" — tipo (ordinario/adelanto/aguinaldo/complementario), fechas.
5. **Calcular**: Click en "Calcular" — el sistema evalúa todos los conceptos en orden para cada empleado.
6. **Revisar**: Ver recibos por empleado. Ajustar novedades si es necesario.
7. **Aprobar**: Cambiar estado a "Aprobado".
8. **Pagar**: Registrar pago → genera asiento contable automático.

**Tipos de período:**
- **Ordinario**: liquidación mensual estándar.
- **Adelanto**: pago adelantado (se descuenta en el ordinario).
- **Aguinaldo**: cálculo del aguinaldo (con PRORRATEO_AGUINALDO mensual).
- **Complementario**: ajuste post-liquidación ordinaria.
- **Extraordinario**: conceptos manuales fuera de período regular.

**Exportaciones:**
- Recibo individual PDF.
- Exportación masiva PDF (todos los empleados del período).
- Libro de Sueldos Digital (PDF, CSV, IPS TXT).
- Asientos contables (previsualización antes de confirmar).

---

## WhatsApp (opcional)

Requiere cuenta de Twilio.

**Pasos:**
1. Crear cuenta en Twilio, obtener SID + Auth Token + número WhatsApp.
2. Configurar secrets en Supabase Dashboard:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM` (formato `+14155238886`)
3. **Settings → Plantillas**: crear plantillas WhatsApp para cobranza, cotizaciones, etc.
4. Los teléfonos deben estar en formato internacional (`+595981234567`).

---

## Resumen de seed data

| Módulo | Precargado automático | Acción manual requerida |
|--------|----------------------|------------------------|
| Catálogo | Unidades de medida (25) | Crear productos |
| CRM | Pipeline + etapas, industrias (18) | Crear contactos |
| Facturación | Actividades económicas (40) | Configurar datos fiscales |
| SRM | — | Crear proveedores |
| Inventario | — | Crear centros, almacenes |
| Contabilidad | — | Cargar plantilla PY (botón) |
| RRHH | Ausencias (5), vacaciones (3 reglas), turnos (3), feriados PY | Crear empleados |
| Nómina | Conceptos PY (16), orden cálculo | Configurar, crear períodos |
| WhatsApp | — | Twilio + secrets |

---

## Orden recomendado

```
Fase 1: Perfil empresa → Miembros
Fase 2: Productos
Fase 3: CRM (contactos, oportunidades)
Fase 4: Facturación (config fiscal → cotizar → facturar)
Fase 5: SRM (proveedores → OC → facturas proveedor)
Fase 6: Inventario (centros → almacenes → stock)
Fase 7: Contabilidad (plan cuentas → impuestos → asientos)
Fase 8: RRHH (empleados → asistencia → vacaciones)
Fase 9: Nómina (config → conceptos → períodos → liquidar)
```

---

## Enlaces útiles

| Recurso | URL |
|---------|-----|
| App staging | https://saas-erp-staging.netlify.app |
| Supabase Dashboard | https://supabase.com/dashboard/project/hbvcprxuveagzalyogeu |
| Repositorio | https://github.com/sanchezray7/saas-erp |
| Documentación técnica | `docs/` en el repo |
