export const HELP = {
  ventas: {
    titulo: 'Ventas',
    icon: '👥',
    descripcion: 'Gestión de contactos, oportunidades, cotizaciones y facturación',
    modulos: [
      {
        titulo: '1. Contactos',
        descripcion: 'Registro de personas y empresas con las que te relacionás comercialmente',
        pasos: [
          'Ir a **Contactos** en el menú VENTAS',
          'Click **"+ Nuevo"**',
          'Completar: Nombre (obligatorio), Email, Teléfono',
          'Opcional: RUC/DV/Documento, Dirección, Empresa, Vendedor asignado',
          'Click **"Guardar"**',
        ],
        tips: [
          'Para facturar, el contacto necesita tener RUC, DV y tipo de documento',
          'Un contacto puede tener una organización asociada',
          'Las etiquetas sirven para segmentar clientes',
          'Los contactos se pueden importar desde Excel/CSV con el botón "Importar"',
        ],
        acciones: [
          { label: 'Editar', desc: 'Click en "Editar" en la fila del listado o desde el detalle del contacto' },
          { label: 'Timeline', desc: 'En el detalle del contacto: llamadas, emails, reuniones, cotizaciones y facturas vinculadas' },
          { label: 'Importar', desc: 'Click "Importar" → descargar plantilla → cargar archivo → mapear columnas' },
        ],
      },
      {
        titulo: '2. Oportunidades (Deals)',
        descripcion: 'Pipeline de ventas con tablero Kanban por etapas',
        pasos: [
          'Ir a **Oportunidades** en VENTAS',
          'Click **"+ Nueva"**',
          'Completar: Nombre, Contacto, Pipeline y Etapa',
          'Opcional: Monto estimado, Probabilidad, Fecha de cierre, Vendedor',
          'Click **"Guardar"**',
        ],
        tips: [
          'Las oportunidades se arrastran entre etapas (drag & drop en Kanban)',
          'Al pasar a "Cerrado ganado" se registra automáticamente la fecha de cierre',
          'El pipeline por defecto tiene 6 etapas: Nuevo → Contactado → Propuesta → Negociación → Cerrado ganado → Cerrado perdido',
          'Se puede cambiar entre vista Kanban y tabla con los botones de la cabecera',
        ],
      },
      {
        titulo: '3. Cotizaciones',
        descripcion: 'Presupuestos detallados para enviar a clientes',
        pasos: [
          'Ir a **Cotizaciones** o desde una Oportunidad click **"Cotizar"**',
          'Seleccionar **Contacto** como cliente',
          'Elegir **Moneda** (PYG, USD, ARS, etc.)',
          'Agregar **Items**: buscar producto → cantidad → se copia el precio de venta',
          'Opcional: modificar precios, agregar descuento, condiciones de pago',
          'Click **"Guardar"**',
        ],
        tips: [
          'La cotización debe estar **aprobada** para poder facturarla',
          'Se puede enviar al cliente un enlace público (compartible por WhatsApp)',
          'Los items se copian del catálogo pero el precio se puede modificar',
          'Los impuestos se calculan según la configuración del producto',
        ],
        estados: [
          { nombre: 'borrador', desc: 'En edición, no enviada al cliente' },
          { nombre: 'enviada', desc: 'Enviada al cliente' },
          { nombre: 'aprobada', desc: 'Cliente aceptó — lista para facturar' },
          { nombre: 'rechazada', desc: 'Cliente rechazó' },
          { nombre: 'facturada', desc: 'Se emitió factura desde esta cotización' },
        ],
      },
      {
        titulo: '4. Facturación Electrónica',
        descripcion: 'Emisión de facturas electrónicas SIFEN/e-kuatia (Paraguay)',
        pasos: [
          '**Configurar antes**: Settings → Facturación → completar RUC, DV, Timbrado, Establecimiento, Punto de expedición, Actividad económica',
          'Desde una cotización **aprobada**, click **"Facturar"**',
          'El sistema genera el XML Kude v150 y lo envía al SIFEN',
          'Si es **APROBADO**: la factura queda emitida con CDC',
          'Si es **RECHAZADO**: revisar errores y corregir datos',
        ],
        tips: [
          'Sin datos fiscales configurados no se puede emitir facturas',
          'En desarrollo/pruebas se usa el mock SIFEN (siempre responde APROBADO)',
          'En producción se necesita un timbrado vigente emitido por la DNIT',
          'Las Notas de Crédito/Débito se emiten desde el menú Notas CD',
        ],
        estados: [
          { nombre: 'emitida', desc: 'Creada manualmente (sin SIFEN)' },
          { nombre: 'aprobada', desc: 'Aprobada por SIFEN con CDC asignado' },
          { nombre: 'rechazada', desc: 'Rechazada por SIFEN (ver errores)' },
          { nombre: 'cancelada', desc: 'Anulada' },
          { nombre: 'cobrada', desc: 'Pagada por el cliente' },
        ],
      },
      {
        titulo: '5. Cuentas por Cobrar',
        descripcion: 'Gestión de cobranza y seguimiento de pagos',
        pasos: [
          'Ir a **Cuentas por Cobrar**',
          'Ver el listado de facturas pendientes con sus vencimientos',
          'Click **"Cobrar"** en la factura a cobrar',
          'Registrar: monto cobrado, fecha, forma de pago, referencia',
          'Confirmar → la factura pasa a estado "cobrada"',
        ],
        tips: [
          'Las facturas vencidas se marcan automáticamente',
          'Las alertas de vencimiento se gestionan en Alertas AR',
          'Se puede configurar cobranza automática en Settings → Cobranza',
        ],
      },
    ],
  },
}
