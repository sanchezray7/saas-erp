import JsBarcode from 'jsbarcode'
import { jsPDF } from 'jspdf'

const TAMANOS = {
  chico: { label: 'Chico (38×21mm)', ancho: 38, alto: 21, cols: 6, rows: 4 },
  mediano: { label: 'Mediano (63×30mm)', ancho: 63, alto: 30, cols: 4, rows: 3 },
  grande: { label: 'Grande (70×36mm)', ancho: 70, alto: 36, cols: 4, rows: 2 },
}

const MARGEN_X = 10
const MARGEN_Y = 10

function generarBarrasDataUrl(code) {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, code, {
    format: code.length === 13 ? 'EAN13' : 'CODE128',
    width: 1.5,
    height: 30,
    displayValue: true,
    fontSize: 10,
    margin: 2,
    background: '#ffffff',
  })
  return canvas.toDataURL('image/png')
}

export function generarStickers(producto, cantidad = 1, tamano = 'mediano') {
  const cfg = TAMANOS[tamano] || TAMANOS.mediano
  const mmAPt = (mm) => mm * 2.8346 // 1mm ≈ 2.83pt
  const anchoPt = mmAPt(cfg.ancho)
  const altoPt = mmAPt(cfg.alto)
  const stepX = anchoPt + mmAPt(2) // +2mm gap
  const stepY = altoPt + mmAPt(2)

  const codigoBarras = producto.codigo_barras || producto.codigo || '000000'
  const barcodeDataUrl = generarBarrasDataUrl(codigoBarras)
  const nombre = producto.nombre || ''
  const precio = `${Number(producto.precio_venta).toLocaleString()} ${producto.moneda || 'PYG'}`

  // Calcular páginas
  const stickersPorHoja = cfg.cols * cfg.rows
  const paginas = Math.ceil(cantidad / stickersPorHoja)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  let stickerCount = 0

  for (let pagina = 0; pagina < paginas; pagina++) {
    if (pagina > 0) doc.addPage()

    for (let row = 0; row < cfg.rows; row++) {
      for (let col = 0; col < cfg.cols; col++) {
        if (stickerCount >= cantidad) break

        const x = MARGEN_X + col * stepX
        const y = MARGEN_Y + row * stepY

        // Borde del sticker
        doc.setDrawColor(200)
        doc.setLineWidth(0.5)
        doc.rect(x, y, anchoPt, altoPt)

        // Código de barras
        doc.addImage(barcodeDataUrl, 'PNG', x + 4, y + 4, anchoPt - 8, 32)

        // Nombre
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        const nombreLines = doc.splitTextToSize(nombre, anchoPt - 8)
        let textY = y + 40
        for (const line of nombreLines) {
          if (textY + 10 > y + altoPt - 16) break
          doc.text(line, x + 4, textY)
          textY += 9
        }

        // Precio
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text(precio, x + 4, y + altoPt - 6)

        stickerCount++
      }
      if (stickerCount >= cantidad) break
    }
  }

  doc.autoPrint()
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  window.open(url)
}

export { TAMANOS }
