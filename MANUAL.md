# Manual de Procesos — SaaS Empresarial

---

## 1. Introducción

### 1.1 ¿Qué es SaaS Empresarial?

SaaS Empresarial es un CRM diseñado para PYMEs latinoamericanas. Permite gestionar contactos, ventas, cotizaciones, facturación electrónica (e-kuatia/SIFEN) y comunicación con clientes vía WhatsApp, todo integrado en una sola plataforma.

### 1.2 Roles del sistema

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso completo. Puede configurar, facturar, invitar miembros, crear sucursales. |
| **Vendedor** | Gestión de contactos, oportunidades, cotizaciones, WhatsApp. No puede configurar la empresa ni ver reportes administrativos. |
| **Supervisor** | Puede ver reportes y el panel de su equipo. |
| **Viewer** | Solo lectura. No puede crear ni modificar nada. |

---

## 2. Primeros pasos

### 2.1 Registro de cuenta + empresa

1. Ingresar a la URL de la aplicación
2. Hacer clic en **"Registrarse"**
3. Completar:
   - **Nombre de la empresa**
   - **País** — seleccionar el país donde opera la empresa (Paraguay, Argentina, Chile, etc.)
   - **RUC / CUIT / RUT** — según el país seleccionado, el label cambia automáticamente
   - **Email** del administrador
   - **Contraseña**
4. Hacer clic en **"Crear cuenta"**
5. Revisar el email y hacer clic en el enlace de verificación

### 2.2 Perfil de empresa

Una vez dentro del sistema:

1. Ir a **Configuración → Perfil de empresa**
2. Completar los datos fiscales:
   - Nombre fiscal
   - RUC / RIF / CUIT
   - País
   - Dirección
   - Teléfono
   - Email de la empresa
3. Hacer clic en **Guardar**

### 2.3 Invitar miembros

1. Ir a **Configuración → Miembros**
2. Completar:
   - Email del nuevo usuario
   - Contraseña temporal
   - Nombre completo
   - Teléfono
   - Rol (Admin / Vendedor / Supervisor / Solo vista)
3. Hacer clic en **Invitar**
4. El usuario recibe un email con las credenciales

---

## 3. Gestión comercial

### 3.1 Contactos

#### Crear contacto

1. Ir a **Contactos → Nuevo contacto**
2. Completar:
   - Nombre (requerido)
   - Email
   - Teléfono (formato internacional: `+595981234567`)
   - **Documentación fiscal:**
     - RUC + DV (si tiene RUC)
     - O Tipo documento + N° documento (si no tiene RUC: Cédula, Pasaporte, etc.)
   - País
   - Dirección
   - Cargo, Empresa, Origen
   - Asignar a vendedor (opcional)
3. Hacer clic en **Guardar**

#### Ver contacto

Al abrir un contacto se muestra:
- Información general
- **Timeline** — historial de actividades, WhatsApp, llamadas, correos
- **Oportunidades vinculadas**
- **Lead Score** — puntuación de probabilidad de conversión (0-100)
- **Resumen con IA** — resumen automático de las interacciones

#### Etiquetas (Tags)

En el formulario de contacto, sección **🏷️ Etiquetas**:
- Escribir el nombre de la etiqueta y presionar Enter
- Si la etiqueta no existe, se crea automáticamente con un color
- Las etiquetas se ven como chips de colores en el detalle del contacto
- En la lista de contactos, se muestran hasta 3 etiquetas por fila

### 3.2 Empresas

1. Ir a **Empresas → Nueva empresa**
2. Completar nombre, RUC, email, teléfono, industria
3. Para buscar el RUC automáticamente: escribir el RUC y hacer clic en **Buscar** (Paraguay)

### 3.3 Pipeline de ventas (Oportunidades)

#### Crear oportunidad

1. Ir a **Oportunidades → Nueva oportunidad**
2. Completar:
   - Título
   - Valor
   - Contacto (cliente)
   - Empresa (opcional)
   - Pipeline y etapa
   - Fecha de cierre estimada
   - Probabilidad
   - Notas
3. Hacer clic en **Guardar**

#### Vista Kanban

Arrastrar oportunidades entre etapas para cambiar su estado:
```
Nuevo → Contactado → Propuesta → Negociación → Cerrado ganado
                                                       → Cerrado perdido
```

#### Vista tabla

Alternar entre Kanban y tabla usando los botones **📋 Kanban / 📊 Lista**.

### 3.4 Cotizaciones / Proformas

#### Crear cotización

1. Ir a **Cotizaciones → Nueva cotización**
2. Completar:
   - Cliente (contacto)
   - Items: descripción, cantidad, precio unitario
   - Estado (borrador por defecto)
   - Notas (condiciones de pago, validez, etc.)
3. Hacer clic en **Guardar**

#### Enviar cotización por WhatsApp

1. Abrir la cotización
2. Hacer clic en **📤 WhatsApp**
3. Seleccionar una plantilla (si existe)
4. Editar el mensaje si es necesario
5. Enviar
   - El cliente recibe: *"📄 Cotización COT-2026-000001... Podés ver los detalles acá: https://..."*
   - El link es público (no requiere login)

#### Descargar PDF

1. Abrir la cotización
2. Hacer clic en **📥 Descargar PDF**
3. En el diálogo de impresión, seleccionar "Guardar como PDF"
4. Elegir A4, márgenes predeterminados

#### Cambiar estado de cotización

Usar el selector de estado:
```
[borrador ▼] → enviada → aceptada → rechazada → facturada
```

Los estados `aceptada`, `rechazada` y `facturada` son irreversibles. No se puede editar ni re-facturar.

### 3.5 Catálogo de productos/servicios

1. Ir a **📦 Catálogo**
2. Para crear un producto:
   - Hacer clic en **+ Nuevo producto**
   - Seleccionar tipo: **Producto** (📦) o **Servicio** (🔧)
   - El código se autogenera: `PRO-0001` / `SER-0001`
   - Completar nombre, precio, moneda, unidad de medida
3. Para usar productos en una cotización:
   - Al crear/editar una cotización, hacer clic en **📦 Del catálogo**
   - Seleccionar el producto → se agrega automáticamente con descripción y precio
4. Importar/exportar: botones en la cabecera del catálogo (formato CSV)

---

## 4. Gestión de proveedores (SRM)

### 4.1 Proveedores

#### Crear proveedor

1. Ir a **Compras → Proveedores → Nuevo proveedor**
2. Completar:
   - Nombre (requerido)
   - RUC
   - Email, Teléfono (formato internacional: `+595981234567`)
   - Categoría
   - Dirección
3. Hacer clic en **Guardar**

#### Ver proveedor

Al abrir un proveedor se muestra:
- Información general
- **📋 Órdenes de compra** vinculadas
- **📊 Scorecard** — KPIs automáticos (entrega, cantidad, precio) + manuales (calidad, comunicación)
- **📄 Documentos** — control de vencimientos (RUC, seguros, contratos)
- **📦 Productos que provee** con alternativas y badge "Más barato"
- **💬 WhatsApp** — historial de mensajes enviados/recibidos

### 4.2 Órdenes de compra (OC)

#### Crear OC

1. Ir a **Compras → Órdenes de compra → Nueva**
2. Seleccionar proveedor, ingresar items (producto, cantidad, precio)
3. Guardar (estado inicial: `borrador`)

#### Enviar OC por WhatsApp

1. Abrir la OC → **📤 WhatsApp**
2. Confirma el envío → se arma mensaje automático con items y total
3. El proveedor recibe el mensaje, la OC pasa a estado `enviada`

#### Recibir mercadería (parcial o total)

1. OC en estado `confirmada` → **📦 Recibir mercadería**
2. Modal muestra cada item con su cantidad pendiente
3. Ingresar la cantidad a recibir (puede ser parcial)
4. Confirmar:
   - Se registra en `recepciones` + `recepcion_items`
   - Si todos los items están completos → estado `recibida`
   - Si no → la OC sigue `confirmada` para recibir el resto después

#### Estados de OC

```
borrador → enviada → confirmada → recibida
                              → cancelada
```

Usar el selector de estado en el detalle de la OC.

### 4.3 Calendario de pagos

1. Ir a **Compras → Calendario de pagos**
2. Muestra resumen de cuentas por pagar:
   - 🔴 Vencidas
   - 🟡 Próximos 7 días
   - 🔵 8 a 15 días
   - 🟢 16 a 30 días
3. Tabla con detalle de órdenes pendientes, link a cada OC

### 4.4 Facturas de proveedor

#### Registrar factura

1. Ir a **Compras → Facturas proveedor → Nueva**
2. Seleccionar proveedor y OC vinculada (opcional)
3. Ingresar items, fechas, impuesto
4. Guardar (estado inicial: `pendiente`)

#### Cotejo 3 vías (Match)

1. Abrir la factura → **🔍 Cotejar**
2. El sistema compara:
   - **Cantidades:** Pedido vs Recibido vs Facturado
   - **Precios:** Precio OC vs Precio Factura
3. Cada fila muestra ✅/❌/— según coincida
4. Si todo coincide → cambiar estado a `conciliada`
5. Si hay diferencias → `discrepancia`

### 4.5 Scorecard de proveedores

1. Ir a **Compras → Scorecard**
2. Muestra todos los proveedores con puntaje general (1-5 estrellas)
3. KPIs automáticos:
   - **⏱ Entrega a tiempo** — % de OCs recibidas antes de la fecha estimada
   - **📦 Precisión cantidad** — % de items con cantidad recibida ≥ pedida
   - **💰 Precisión precio** — % de facturas con precio igual al de la OC
4. KPIs manuales (editables): **Calidad**, **Comunicación**
5. Botón **🔄 Recalcular** para actualizar con datos nuevos
6. En el detalle del proveedor se ve el scorecard completo

### 4.6 Alertas de vencimiento

1. Ir a **Compras → Alertas vencimiento**
2. Se listan documentos próximos a vencer o vencidos:
   - 🔴 Vencidos
   - 🟡 Por vencer (según días configurados)
3. Botón **📤 Verificar y notificar todo** — envía WhatsApp automático al proveedor
4. En el detalle del proveedor, sección **📄 Documentos**, se pueden registrar:
   - RUC, Constancia fiscal, Seguro, Habilitación, Contrato, Otro
   - Fecha de emisión y vencimiento
   - Días de alerta personalizados

### 4.7 Historial de precios

1. Ir a **Compras → Historial precios**
2. Seleccionar un producto del catálogo
3. Muestra:
   - Precio actual, último precio de OC, total de compras
   - **Gráfico** de evolución del precio (recharts LineChart)
   - **Tabla** de detalle con fecha, OC, proveedor, cantidad, precio, subtotal

### 4.8 Alternativas de proveedores

En el detalle del proveedor, sección **📦 Productos que provee**:
- Lista los productos que ofrece
- Para cada producto, muestra otros proveedores activos que también lo venden
- Badge **🟢 Más barato** si la alternativa tiene mejor precio
- Links directos a los perfiles de los proveedores alternativos

### 4.9 Sugerencias de compra

Generación automática de órdenes de compra cuando el stock baja del mínimo:

1. Ir a **Compras → 🤖 Sugerencias de compra**
2. Muestra todos los productos con `stock ≤ stock_minimo`
3. Cada producto tiene preseleccionado el proveedor más barato (de `proveedor_productos`)
4. Se puede cambiar el proveedor por producto y ajustar la cantidad sugerida
5. Los productos se **agrupan por proveedor**
6. Botón **📋 Crear N OC(s)** → genera una OC en estado `borrador` por cada proveedor

**Requisito:** Los productos deben tener `stock_minimo > 0` y al menos un proveedor asociado.

---

## 5. Contabilidad (@saas/accounting)

### 5.1 Impuestos

#### Grupos de impuestos

1. Ir a **Contabilidad → Impuestos**
2. Cada impuesto pertenece a un grupo:
   - **Débito Fiscal** — IVA ventas
   - **Crédito Fiscal** — IVA compras
   - **Retención Compra** — retenciones que te hacen al comprar
   - **Retención Venta** — retenciones que hacés al vender
3. Crear impuestos con nombre, porcentaje y cuenta contable asociada

#### IVA por item (cotizaciones/facturas)

Al crear items en una cotización o factura:
- Seleccionar un IVA (ej: IVA 10%) por cada item
- El sistema calcula automáticamente el monto de IVA
- Las retenciones se aplican a nivel de factura (no por item)

### 5.2 Plan de Cuentas

1. Ir a **Contabilidad → Plan de Cuentas**
2. Vista de árbol expandible (desktop) o cards por tipo (mobile)
3. Cada cuenta tiene: código, nombre, tipo (activo/pasivo/patrimonio/ingreso/costo/gasto)
4. Botón **🌱 Seed PY** — crea las 29 cuentas contables base para Paraguay (incluye 1.1.5 Inventario y 6.4 Ajuste de Inventario)
5. Las cuentas se asignan a:
   - **Impuestos** — para el IVA crédito/débito
   - **Productos** — cuenta de compra y cuenta de venta
   - **Proveedores** — cuenta contable del proveedor
   - **Contactos** — cuenta contable del cliente

### 5.3 Asientos Contables

#### Asientos manuales

1. Ir a **Contabilidad → Asientos → Nuevo asiento**
2. Completar: fecha, descripción, líneas (cuenta, débito, crédito)
3. El sistema valida que débitos = créditos
4. Guardar como **borrador** o **contabilizar** directamente

#### Asientos automáticos

El sistema genera asientos automáticamente en estos casos:

| Evento | Asiento generado |
|--------|-----------------|
| Factura de proveedor conciliada | Gasto (débito) + IVA (débito) → Proveedor (crédito) |
| Factura de cliente cobrada | Banco/Caja (débito) → Cliente (crédito) + Ingresos (crédito) |
| Pago a proveedor | Proveedor (débito) → Banco (crédito) |
| Ajuste de conteo de inventario | Inventario (débito) ↔ Ajuste Inventario (crédito) según sobra/falta |

#### Ver asientos

1. Ir a **Contabilidad → Asientos**
2. Lista de asientos con número, fecha, descripción, estado
3. Al abrir, se ven las líneas con cuenta, débito, crédito
4. Acciones: **Contabilizar** (si está en borrador), **Anular** (no se edita, se anula)

### 5.4 Reportes Contables

1. Ir a **Contabilidad → Reportes Contables**
2. Cuatro pestañas:

**Balance General:**
- Activo, Pasivo, Patrimonio con sus cuentas hijas en árbol
- Verificación de cuadratura: Activo − Pasivo = Patrimonio
- Totales calculados automáticamente desde los asientos

**Estado de Resultados:**
- Ingresos, Costos, Gastos
- Resultado Neto (Ingresos − Costos − Gastos)
- Gráfico de barras (recharts) por tipo

**Reporte IVA:**
- Débito Fiscal (IVA ventas) vs Crédito Fiscal (IVA compras)
- IVA a Pagar = Débito − Crédito
- Detalle por tasa de IVA

**Mayor Contable:**
- Seleccionar una cuenta
- Muestra todos los movimientos (asientos) que la afectan
- Saldo corrido después de cada movimiento
- Filtro por tipo de asiento

---

## 6. Inventario (@saas/inventario)

### 6.1 Centros logísticos y Almacenes

#### Crear centro logístico

1. Ir a **Inventario → Centros logísticos → Nuevo centro**
2. Nombre y dirección (ej: "Centro de Distribución Principal")
3. Guardar

#### Crear almacén

1. Ir a **Inventario → Almacenes → Nuevo almacén**
2. Seleccionar centro logístico
3. Nombre y tipo:
   - **General** — stock común
   - **Refrigerado** — productos que requieren frío
   - **Congelado** — productos congelados
   - **Peligroso** — materiales peligrosos
   - **Cuarentena** — productos en revisión
4. Guardar

#### Ubicaciones dentro del almacén

1. Ir a **Inventario → Ubicaciones → Nueva ubicación**
2. Seleccionar almacén
3. Completar: nombre, pasillo, estante, posición (ej: "A-01-03")
4. Se muestran en el stock y en el picking para facilitar la preparación

### 6.2 Stock actual

1. Ir a **Inventario → Stock actual**
2. Muestra todos los productos con stock > 0, agrupados por almacén
3. Columnas: producto, almacén, cantidad, costo promedio
4. Colores: 🟢 stock ≥ mínimo, 🟡 stock ≥ 50% del mínimo, 🔴 stock bajo el mínimo
5. Botón **Ajustar stock** para correcciones manuales

### 6.3 Movimientos de stock

1. Ir a **Inventario → Movimientos**
2. Lista de todas las entradas y salidas con: fecha, producto, almacén, tipo, cantidad, motivo
3. Filtros por producto, rango de fechas

Los movimientos se generan automáticamente al:
- Recibir mercadería de una OC
- Facturar una venta (descuenta del stock)
- Transferir entre almacenes
- Ajustar por conteo cíclico

### 6.4 Transferencias entre almacenes

1. Ir a **Inventario → Transferencias → Nueva transferencia**
2. Seleccionar origen, destino, producto y cantidad
3. El sistema verifica stock suficiente en origen
4. Crea salida (origen) + entrada (destino) automáticamente

### 6.5 Recepción de mercadería (desde OC)

1. OC en estado `confirmada` → click **📦 Recibir mercadería**
2. En el modal:
   - Seleccionar **Almacén de destino**
   - Ingresar **Lote** (opcional)
   - Ingresar **Fecha de vencimiento** (opcional)
   - Por cada item: cantidad a recibir
3. Confirmar → se crean movimientos de entrada y se actualiza el stock

### 6.6 Kardex por lote

1. Ir a **Inventario → Kardex por lote**
2. Seleccionar un producto
3. Muestra todos los lotes con:
   - Movimientos del lote (entradas/salidas)
   - Saldo corrido después de cada movimiento
   - Costo unitario

### 6.7 Conteos cíclicos

#### Crear conteo

1. Ir a **Inventario → Conteos → Nuevo conteo**
2. Seleccionar almacén
3. Seleccionar productos a contar (uno o varios)
4. El sistema precarga la cantidad del sistema
5. Guardar → estado `contando`

#### Cargar resultados

1. Abrir el conteo
2. Para cada producto, ingresar la cantidad contada (campo editable inline)
3. Al escribir, se calcula automáticamente:
   - **Diferencia** = contado − sistema
   - Color: 🟢 Ok (0), 🟡 Sobra (+), 🔴 Falta (−)
4. Estado badge: ✅ Ok / 🟡 Sobra / 🔴 Falta

#### Ajustar diferencias

1. Cuando todas las cantidades están cargadas → **✅ Ajustar diferencias**
2. El sistema:
   - Crea movimientos de entrada (sobra) o salida (falta) por cada diferencia
   - Cierra el conteo (estado `cerrado`)
   - Genera **asiento contable automático** (si las cuentas 1.1.5 y 6.4 existen)
3. Aparece link `📒 Ver asiento contable` en la página del conteo

### 6.8 Valuación de inventario

1. Ir a **Inventario → 💰 Valuación**
2. KPIs: Valor total del stock, cantidad de productos, cantidad de almacenes
3. **Gráfico de barras** (recharts): valor por almacén
4. Lista de almacenes expandibles:
   - Click en un almacén → muestra detalle de productos
   - Cada fila: producto, cantidad, costo promedio, valor total
   - Ordenado por valor descendente

### 6.9 Picking / Preparación de pedidos

#### Crear orden de picking

1. Al facturar una cotización (factura aprobada):
   - Si los items tienen `producto_id` → aparece **📋 Generar orden de picking**
2. También se puede crear desde cero y vincular a una factura

#### Preparar pedido

1. Ir a **Inventario → Picking**
2. Abrir la orden de picking
3. Para cada item, ingresar la **cantidad preparada**
4. Estados: `pendiente` → **▶ Iniciar preparación** → `preparando` → `preparado`

#### Despachar

1. Cuando todos los items están preparados → **📦 Despachar**
2. En el modal:
   - **Almacén de salida** (obligatorio)
   - **Transportista** (obligatorio, desde el CRUD de transportistas)
   - Chofer, patente, destino (opcional)
3. Confirmar → se genera:
   - **Remito** automáticamente (vista imprimible)
   - **Movimientos de salida** del stock
   - Estado del picking → `despachado`

### 6.10 Remitos

1. Ir a **Inventario → Remitos**
2. Lista de remitos generados al despachar
3. Abrir un remito → vista imprimible con:
   - Datos del transportista
   - Productos, cantidades, lote
   - Espacio para firma
   - Botón **🖨 Imprimir**

### 6.11 Transportistas

1. Ir a **Inventario → Transportistas → Nuevo transportista**
2. Nombre, RUC, teléfono, contacto
3. Se usan al despachar pedidos

---

## 7. Comunicación con clientes

### 7.1 WhatsApp

#### Enviar mensaje a contacto

1. Abrir un contacto del CRM
2. Hacer clic en **📱 WhatsApp**
3. Seleccionar una plantilla (si existe) o escribir manualmente
4. El mensaje se envía vía Twilio y aparece en el timeline como 💬

#### Enviar mensaje a proveedor

1. Abrir un proveedor
2. Hacer clic en **📱 WhatsApp** (header) o **📤 Enviar** (sección WhatsApp)
3. Seleccionar una plantilla (si existe)
4. El mensaje se registra en el historial de WhatsApp del proveedor

#### Historial de WhatsApp (proveedores)

En el detalle del proveedor, sección **💬 WhatsApp**:
- 🔵 mensajes enviados
- 🟢 mensajes recibidos (webhook entrante)
- Fecha y hora de cada mensaje
- Botón **📤 Enviar** para enviar un nuevo mensaje

#### Plantillas WhatsApp

1. Ir a **Configuración → Plantillas de correo**
2. Crear nueva plantilla con contexto **"WhatsApp"**
3. Usar variables como `{{contacto.nombre}}`, `{{cotizacion.numero}}`, `{{cotizacion.total}}`
4. Guardar
5. Al enviar WhatsApp desde un contacto, la plantilla aparece en el selector

#### Webhook entrante (recibir respuestas)

Cuando un cliente responde un mensaje de WhatsApp, la respuesta se registra automáticamente en el timeline del contacto.

**No requiere acción del usuario.** Solo configurar una vez en Twilio:
- URL: `https://<ref>.supabase.co/functions/v1/whatsapp-webhook`
- Method: HTTP Post

### 7.2 Correos electrónicos

#### Plantillas

1. Ir a **Configuración → Plantillas de correo**
2. Crear plantilla con contexto:
   - **Contacto** — para emails comerciales
   - **Oportunidad** — para seguimiento de deals
   - **Lead** — para leads entrantes
3. Usar variables como `{{contacto.nombre}}`, `{{deal.valor}}`
4. Previsualizar con datos de ejemplo

#### Redacción con IA

1. Al crear/editar una plantilla
2. Escribir instrucciones opcionales (ej: "tono formal, breve")
3. Hacer clic en **🤖 Redactar con IA**
4. La IA genera asunto + cuerpo automáticamente

### 7.3 Leads

#### Formulario público

1. Ir a **Configuración → Webhook**
2. Copiar el **Link público**
3. Compartir en redes sociales, WhatsApp, email
4. El lead completa nombre + email + teléfono → se crea como contacto automáticamente
5. Aparece en **📩 Leads** para ser asignado a un vendedor

#### Acciones sobre leads

Desde la lista de Leads:
- **✓ Convertir** → pasa a contacto normal
- **👤 Asignar** → asigna a un vendedor
- **🗑 Eliminar** → borra el lead

---

## 8. Facturación electrónica

### 8.1 Configuración fiscal

1. Ir a **Configuración → Facturación electrónica**
2. Completar los datos según el país:

**Paraguay (SIFEN / e-kuatia):**
| Campo | Descripción | Ejemplo |
|-------|------------|---------|
| RUC facturación | RUC del emisor | `80012345` |
| DV | Dígito verificador | `6` |
| Timbrado | N° asignado por DNIT | `12345678` |
| Establecimiento | Código del local | `001` |
| Punto expedición | Punto de venta | `001` |
| CSC | Código de Seguridad | `ABCD0000...` |
| Id CSC | Identificador del CSC | `0001` |
| Código actividad | Actividad económica | `46510` |
| Descripción actividad | — | `Comercio al por mayor...` |

3. Hacer clic en **Guardar**

### 8.2 Emitir factura

1. Crear una cotización con items
2. Abrir la cotización → hacer clic en **💵 Facturar**
3. Verificar los datos:
   - Cliente con RUC o documento
   - Timbrado, establecimiento, punto de expedición
   - Vencimiento de la factura (default 30 días)
4. Hacer clic en **💵 Emitir factura electrónica**
5. El sistema genera el XML Kude v150 y lo envía al SIFEN (o al mock local)
6. Si es aprobada:
   - La cotización pasa a estado `facturada`
   - Se genera un CDC único
   - La factura queda registrada en el sistema

### 8.3 Números de factura

- Formato: `001-001-0000001`
- `001` = Establecimiento
- `001` = Punto de expedición
- `0000001` = Secuencial independiente por cada combinación est + pto

### 8.4 Mock SIFEN (desarrollo)

Para pruebas sin conexión a DNIT:

```bash
node scripts/mock-sifen.js
```

El mock corre en `http://localhost:3001` y simula las respuestas del SIFEN:
- Si el XML contiene "ERROR" → devuelve RECHAZADO
- Si el XML contiene "RUC_INVALIDO" → devuelve error de RUC
- Caso normal → devuelve APROBADO con CDC simulado

---

## 9. Cobranza

### 9.1 Configurar cobranza automática

1. Ir a **Configuración → Cobranza automática**
2. Activar la opción
3. Configurar plazos:

| Parámetro | Qué hace | Recomendado |
|-----------|----------|-------------|
| Días ANTES del vencimiento | Primer aviso | 3 días |
| Días DESPUÉS del vencimiento | Segundo aviso | 1 día |
| Re-enviar cada (días) | Recordatorios siguientes | 3 días |

4. Seleccionar plantilla WhatsApp (opcional)
5. Guardar

### 9.2 Programar el cron

La cobranza necesita ejecutarse una vez al día vía cron job:

1. Crear cuenta en [cron-job.org](https://cron-job.org)
2. Configurar:
   - **URL:** `https://<ref>.supabase.co/functions/v1/cobranza-auto?key=TU_CLAVE`
   - **Frecuencia:** diario a las 08:00
   - **Zona horaria:** `America/Asuncion`

El bot:
- Revisa todas las facturas aprobadas con vencimiento próximo o vencido
- Envía WhatsApp automáticos según la configuración de cada empresa
- Registra cada envío en el timeline del contacto
- No re-envía si ya se envió el mismo día

---

## 10. Reportes y métricas

### 10.1 Dashboard

Indicadores principales:
- Oportunidades abiertas
- Ganadas este mes
- Valor total del pipeline
- Pronóstico ponderado
- Contactos totales

Gráficos:
- Embudo de ventas (oportunidades por etapa)
- Ganadas vs mes anterior
- Proyección de flujo de caja
- Widget stock bajo (productos con cantidad ≤ stock_minimo)
- Widget progreso de metas del equipo

### 10.2 Reportes

| Reporte | Qué mide |
|---------|----------|
| **Velocidad de ventas** | Días promedio para ganar, perder y activos |
| **Tasa de conversión** | % de avance entre etapas consecutivas |
| **Ventas por etapa** | Cantidad y valor por etapa |
| **Ingresos mensuales** | Histórico de últimos 12 meses |
| **Actividades por tipo** | Distribución de llamadas, emails, reuniones |
| **Top vendedores** | Rankings por cantidad y valor de deals |

### 10.3 Metas de ventas

#### Configurar metas

1. Ir a **Configuración → Metas de ventas**
2. Seleccionar año y mes
3. Para cada vendedor, hacer clic en **Asignar** o **Editar**
4. Ingresar el monto objetivo del mes
5. Guardar

#### Widget en Dashboard

En el dashboard aparece **Progreso del equipo** con:
- Barra de progreso individual por vendedor
- Color verde (≥100%), amarillo (≥50%), rojo (<50%)
- Monto alcanzado vs objetivo

El cálculo se basa en los deals cerrados como ganados en el período.

---

## 11. Administración del sistema

### 11.1 Miembros y permisos

1. Ir a **Configuración → Miembros**
2. Para agregar: completar email + contraseña + nombre + rol
3. Para eliminar: no se puede eliminar al único administrador

### 11.2 Crear sucursales

Si la empresa tiene varios locales:

1. Ir a **Configuración → Perfil de empresa**
2. Sección **Agregar sucursal**
3. Ingresar nombre (ej: "Mi Empresa — Suc. Centro")
4. Hacer clic en **Crear sucursal**
5. La nueva sucursal:
   - Tiene el mismo RUC
   - El admin queda como miembro
   - Aparece en el selector de empresas
   - Se configura con su propio timbrado/CSC/establecimiento

### 11.3 Pipeline y etapas

1. Ir a **Configuración → Pipelines**
2. Crear pipeline, agregar/quitar etapas
3. Reordenar con ▲/▼
4. Las etapas tienen: nombre, probabilidad (%), color

### 11.4 Webhook para leads

1. Ir a **Configuración → Webhook**
2. Copiar el token o el snippet HTML
3. Pegar el snippet en el sitio web del cliente
4. Los formularios completados generan contactos automáticamente

### 11.5 PWA (App instalable)

El CRM se puede instalar como app en el celular sin pasar por Google Play:

1. Abrir la URL desde **Chrome para Android**
2. Aparecerá un badge en la esquina superior derecha: **📲 Instalar app**
3. Hacer clic en **Instalar**
4. La app se agrega al escritorio con un icono y se abre en pantalla completa

**Notificaciones push:** La primera vez que se abre la app, aparece un banner pidiendo activar notificaciones. Al aceptar, el vendedor recibirá notificaciones incluso con el celular cerrado.

---

## 12. Resolución de problemas

### 12.1 El perfil de empresa no guarda

**Causa:** Falta la política de actualización en la base de datos.

**Solución:** Ejecutar en SQL Editor de Supabase:
```sql
drop policy if exists "companies_update" on companies;
create policy "companies_update" on companies
  for update using (public.is_admin_of(id));
```

### 12.2 WhatsApp no envía

**Causa común 1:** El teléfono del contacto no está en formato internacional.
**Solución:** Usar formato `+595981234567` (con código de país y sin espacios).

**Causa común 2:** El número de destino no está conectado al Sandbox.
**Solución:** El cliente debe enviar `join <sandbox-name>` al número de Twilio.

**Causa común 3:** Faltan variables de Twilio en Supabase.
**Solución:** Verificar que los secrets estén configurados:
```bash
supabase secrets set TWILIO_ACCOUNT_SID=...
supabase secrets set TWILIO_AUTH_TOKEN=...
supabase secrets set TWILIO_WHATSAPP_FROM=...
```

### 12.3 Error "column does not exist" al facturar

**Causa:** No se ejecutó la migración SQL correspondiente.

**Solución:** Ejecutar el archivo SQL necesario desde `apps/erp/docs/`.

### 12.4 La cotización no cambia de estado después de facturar

**Causa:** La función `actualizar_empresa` RPC no existe o falla.

**Solución:** Ejecutar:
```sql
-- docs/empresa-rpc-setup.sql
create or replace function actualizar_empresa(p_company_id uuid, p_data jsonb)
returns jsonb ...
```

### 12.5 El lead público no funciona

**Causa:** No se ejecutó el RPC `obtener_empresa_por_token`.

**Solución:** Ejecutar el RPC desde `docs/public-lead-form-setup.sql`.

---

## 13. Apéndice: Configuración de servicios

### 13.1 Secrets de Supabase

```bash
# Esenciales
SERVICE_ROLE_KEY=<key>

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_WHATSAPP_FROM=<+14155238886>

# Inteligencia Artificial
AI_PROVIDER=groq
GROQ_API_KEY=<key>

# Cobranza automática
COBRANZA_SECRET_KEY=<clave>

# Notificaciones Push (PWA)
VAPID_PUBLIC_KEY=<key>
VAPID_PRIVATE_KEY=<key>
```

### 13.2 Variables de entorno (.env.local)

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_RUC_API_KEY=<key>
VITE_SIFEN_URL=http://localhost:3001/sifen
```

### 13.3 Mock SIFEN

```bash
# Terminal 1: mock
node scripts/mock-sifen.js

# Terminal 2: app
npm run dev
```

El mock escucha en `http://localhost:3001` y acepta:
- `POST /sifen/recepcion` con `{ xml: "..." }`
- Responde con APROBADO o RECHAZADO según el contenido del XML

---

## 14. Módulo de RRHH

### 14.1 Empleados

Gestión completa de empleados con histórico de cambios (datos personales, laborales, bancarios, fiscales y documentos).

**Acceso:** `RRHH → Empleados`

#### Ficha del empleado

| Sección | Datos |
|---------|-------|
| 👤 Personales | Nombre, apellido, email, teléfono, dirección, código biométrico |
| 💼 Laboral | Departamento, puesto, tipo de contrato, salario |
| 🏦 Bancario | Banco, tipo de cuenta, número |
| 📄 Fiscal | IPS/INSS |
| 🪪 Documentos | CI, RUC, Pasaporte, Licencia (múltiples por empleado con vigencia) |

Cada sección se guarda independientemente. Al modificar datos laborales, bancarios o fiscales se genera un registro histórico automáticamente.

### 14.2 Asistencia

**Acceso:** `RRHH → Asistencia`

- Calendario mensual por empleado
- Click en un día para marcar entrada/salida o ausente
- Importación desde dispositivos biométricos vía CSV

**Importación biométrica (RRHH → Importar marcaciones):**
- Formato CSV: `codigo,fecha,hora`
- Inferencia inteligente: detecta jornadas por umbral de brecha (default 3h)
- Pre-entradas < 30 min se descartan automáticamente
- Cruce de medianoche detectado automáticamente
- Preview antes de importar

### 14.3 Ausencias

**Acceso:** `RRHH → Ausencias`

- Solicitudes de permiso/ausencia con tipos configurables
- Flujo de aprobación (pendiente → aprobado/rechazado)

### 14.4 Vacaciones

**Acceso:** `RRHH → Vacaciones`

- Saldo automático según antigüedad + reglas configurables
- Cálculo: `dias_asignados = dias_por_reglas + dias_adicionales`
- Solicitud y aprobación de vacaciones
- Reglas configurables en **Configuración → Reglas de vacaciones**

---

## 15. Conciliación bancaria

**Acceso:** `Finanzas → Conciliación bancaria`

Permite conciliar los movimientos del extracto bancario contra los asientos contables del sistema.

**Flujo:**
1. Crear conciliación: seleccionar cuenta, período, saldos del extracto
2. Cargar extracto: pegar líneas del banco (CSV: fecha, concepto, monto, referencia)
3. Marcar movimientos como conciliados manualmente
4. Ver KPIs de diferencia
5. Cerrar conciliación cuando esté lista

---

## 16. Consolidación

**Acceso:** `🏢 Consolidación` (visible solo en la casa matriz)

### Modo sucursales

Consolida empresas vinculadas (mismo RUC, distintas sucursales).

### Modo holding

Agrupa empresas independientes (distinto RUC) en grupos económicos:
1. Crear grupo en Consolidación → modo Holding
2. Agregar empresas con **⚙️ Gestionar miembros**
3. Ver Balance, Resultados y Resumen consolidados

### Eliminaciones inter-compañía

Al activar el toggle, las cuentas marcadas como `is_intercompany` en el Plan de Cuentas se excluyen de los totales consolidados.

### Asientos de consolidación

Ajustes manuales que solo afectan al consolidado (no a los libros de cada empresa).

### Calendario de cierre

Permite marcar qué empresas cerraron su mes contable. Verificar antes de consolidar.

---

## 17. Notas de Crédito / Débito

**Acceso:** `Finanzas → Notas C/D`

Emitir Notas de Crédito (reducir valor) y Notas de Débito (aumentar valor) vinculadas a una factura ya emitida.

**Flujo:**
1. Seleccionar tipo, factura origen, motivo obligatorio
2. Items precargados desde la factura original
3. Guardar borrador → emitir a SIFEN
4. Al aprobarse: genera CDC, asiento contable, actualiza saldo pendiente

---

## 18. Cuentas por Pagar / Cuentas por Cobrar

**Acceso:** `Finanzas → Cuentas por Pagar` / `Cuentas por Cobrar`

### Pagos a proveedores
- Desde el detalle de factura de proveedor: **+ Registrar pago**
- Pagos parciales con medio de pago, cuenta bancaria, referencia
- Saldo pendiente se actualiza automáticamente

### Cobros a clientes
- Desde cotización en estado `facturada`: **💰 Cobrar** o **+ Registrar cobro**
- Pagos parciales y seguimiento de saldo

### Antigüedad de saldos
**Finanzas → Antigüedad de saldos** con buckets por rango de días y gráfico.

---

