# Beta Testing Guide — SaaS Empresarial

## Acceso al Staging

**URL:** (pendiente de deploy en Netlify)
**Registro:** Crear cuenta → Crear empresa → Completar setup inicial

---

## Orden recomendado de prueba

Probar los módulos en este orden para minimizar dependencias:

### 1. ⚙️ Configuración inicial
- [ ] Crear empresa y usuario
- [ ] **Plan de Cuentas** → Ejecutar seed PY (Configuración > Plan de Cuentas > Seed PY)
- [ ] **Conceptos de nómina** → Ejecutar seed PY (Nómina > Configuración > 📥 Cargar PY)
- [ ] Asignar **cuentas contables** a los conceptos (SALARIO → `5.1.1`, IPS → `2.1.6`, etc.)
- [ ] Configurar **N° Patronal IPS** (Nómina > Configuración > N° Patronal)
- [ ] Configurar **impuestos** (IVA 5%, IVA 10%) si aplica

### 2. 👤 CRM — Ventas
- [ ] Crear **organizaciones / empresas**
- [ ] Crear **contactos** con teléfono y email
- [ ] Crear **oportunidades (deals)** en pipeline
- [ ] Avanzar etapas → cerrar ganado/perdido
- [ ] Crear **cotizaciones** con productos → descargar PDF
- [ ] Facturar desde cotización
- [ ] Revisar Dashboard con KPIs

### 3. 🏭 SRM — Compras
- [ ] Registrar **proveedores**
- [ ] Crear **órdenes de compra**
- [ ] Recibir parcialmente una OC
- [ ] Ingresar **factura de proveedor** (coincidiendo con OC)
- [ ] Ver **scorecard** del proveedor

### 4. 📦 Inventario
- [ ] Crear **almacenes** (depósito, tienda, etc.)
- [ ] Cargar **productos** con stock inicial
- [ ] Hacer **transferencia** entre almacenes
- [ ] Realizar un **conteo físico** → ajuste automático
- [ ] Ver **kardex** de un producto

### 5. 💰 Facturación
- [ ] Crear **factura de cliente** (desde cotización o directa)
- [ ] Descargar XML / PDF
- [ ] Crear **nota de crédito / débito**
- [ ] **Anular** factura

### 6. 📒 Contabilidad
- [ ] Ver **asientos automáticos** generados (facturas, nómina, inventario)
- [ ] Crear **asiento manual**
- [ ] Ver reportes: **Balance General**, **PyG**, **Libro Diario**
- [ ] Probar **conciliación bancaria** (importar CSV)

### 7. 👥 RRHH
- [ ] Cargar **empleados** con datos personales + contrato
- [ ] Cargar **asistencia** (marcaciones manuales)
- [ ] Solicitar y aprobar **ausencias / vacaciones**
- [ ] Generar **control horario**
- [ ] Ver **organigrama**

### 8. 💵 Nómina
- [ ] Crear período **ordinario** → Calcular → Revisar recibo
- [ ] Verificar: SALARIO, HE (si hay), AUSENCIA, VACACIONES, IPS
- [ ] Crear **adelanto** → Calcular → Aprobar
- [ ] Crear ordinario → calcular → debe descontar el adelanto
- [ ] ✅ **Aprobar** (revisar preview del asiento contable)
- [ ] 💰 **Pagar** (genera asiento de pago vs banco)
- [ ] Descargar: **Recibo PDF**, **Exportar recibos masivos**
- [ ] Ir a **Libro de Sueldos** → seleccionar período → exportar PDF/CSV/IPS
- [ ] Probar **complementario** y **extraordinario**

---

## Notas importantes

### WhatsApp (Twilio)
Las credenciales de Twilio actuales son de **prueba** y expiran periódicamente.
Si al enviar un mensaje ves un error, avisá para renovar las credenciales.

### Facturación Electrónica (SIFEN)
Actualmente el sistema genera XML con estructura correcta pero **sin firma digital real**.
Para producción se necesita:
1. Certificado digital .p12 del cliente
2. Configuración de ambiente SIFEN

### Mock SIFEN
El servidor mock está en `scripts/mock-sifen.js`. Levantarlo con:
```bash
node scripts/mock-sifen.js
```

---

## Cómo reportar un bug

Incluir en el reporte:

```
Módulo: (CRM / SRM / Inventario / Facturación / Contabilidad / RRHH / Nómina)
Ruta: (ej: /nomina/periodos)
Qué hiciste: (pasos para reproducir)
Qué esperabas: (comportamiento esperado)
Qué pasó: (comportamiento actual, errores, captura de pantalla)
```

**Enviar a:** (definir canal — WhatsApp / GitHub Issues / email)
