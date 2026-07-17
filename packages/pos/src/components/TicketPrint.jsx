export function imprimirTicket(venta, empresa) {
  const win = window.open('', '_blank')
  if (!win) return

  win.document.write(`
<html><head><meta charset="utf-8">
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
  h2 { text-align: center; margin: 0 0 4px; font-size: 14px; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; }
  .right { text-align: right; }
  .total { font-weight: bold; font-size: 14px; }
  .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #666; }
</style></head><body>
<h2>${empresa || 'Ticket'}</h2>
<p class="center">Venta N° ${venta.numero}</p>
<p class="center">${new Date(venta.created_at).toLocaleString('es-PY')}</p>
<div class="line"></div>
<table>
  ${venta.items.map(i => `
    <tr><td>${i.nombre}</td><td class="right">x${i.cantidad}</td></tr>
    <tr><td style="padding-left:8px;color:#666">${(i.precio).toLocaleString()} c/u</td><td class="right">${(i.cantidad * i.precio).toLocaleString()}</td></tr>
  `).join('')}
</table>
<div class="line"></div>
<table>
  <tr><td>Subtotal</td><td class="right">${venta.subtotal.toLocaleString()}</td></tr>
  ${venta.descuento > 0 ? `<tr><td>Descuento</td><td class="right">-${venta.descuento.toLocaleString()}</td></tr>` : ''}
  <tr class="total"><td>TOTAL</td><td class="right">${venta.total.toLocaleString()} Gs.</td></tr>
</table>
<div class="line"></div>
<p>Forma de pago: ${venta.forma_pago}</p>
${venta.monto_efectivo > 0 ? `<p>Efectivo: ${venta.monto_efectivo.toLocaleString()}</p>` : ''}
${venta.monto_tarjeta > 0 ? `<p>Tarjeta: ${venta.monto_tarjeta.toLocaleString()}</p>` : ''}
${venta.monto_transferencia > 0 ? `<p>Transferencia: ${venta.monto_transferencia.toLocaleString()}</p>` : ''}
${venta.monto_cambio > 0 ? `<p>Vuelto: ${venta.monto_cambio.toLocaleString()}</p>` : ''}
<br/>
<p class="footer">Gracias por su compra</p>
<p class="footer">${new Date().toLocaleString('es-PY')}</p>
<script>window.print()</script>
</body></html>`)

  win.document.close()
}
