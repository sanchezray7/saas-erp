// Generador XML para Notas de Crédito (tipoDE=5) y Débito (tipoDE=6)
// Basado en el schema Kude v150 de SIFEN Paraguay

function escapeXml(str) {
  if (str == null) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function generarNotaXml({
  tipo, // 'credito' | 'debito'
  // Emisor
  rucEmisor, dvEmisor, nombreEmisor, dirEmisor,
  cDepEmi = 1, desDepEmi = 'CAPITAL', cCiuEmi = 1, desCiuEmi = 'ASUNCION (DISTRITO)',
  telEmisor, emailEmisor, cActEco = '00000', desActEco = 'COMERCIO GENERAL',

  // Receptor (from factura original)
  rucReceptor, dvReceptor, nombreReceptor, dirReceptor,
  cDepRec = 1, desDepRec = 'CAPITAL', cCiuRec = 1, desCiuRec = 'ASUNCION (DISTRITO)',
  telReceptor, emailReceptor, tipoDocReceptor, numDocReceptor, paisReceptor = 'PRY',

  // Documento actual
  timbrado, establecimiento = '001', puntoExp = '001', numeroDoc = 1, cdc,
  fechaEmision, motivo,

  // Factura original referenciada
  cdcOriginal, numeroOriginal, fechaOriginal,

  codigoSeguridad = '000000001',

  moneda = 'PYG',
  items = [],

  subtotal, impuesto, total,
}) {
  const tipoDE = tipo === 'credito' ? 5 : 6
  const tipoLabel = tipo === 'credito' ? 'Nota de Crédito' : 'Nota de Débito'

  const itemsXml = items.map((item, i) => {
    const nro = i + 1
    return `        <dDetalle>
          <dCDetalle nro="${nro}">
            <codInterno>${escapeXml(item.codigoInterno || '')}</codInterno>
            <descItem>${escapeXml(item.descripcion)}</descItem>
            <cantidad>${Number(item.cantidad).toFixed(4)}</cantidad>
            <precioUnitario>${Number(item.precioUnitario).toFixed(2)}</precioUnitario>
            <montoTotal>${Number(item.montoTotal || item.cantidad * item.precioUnitario).toFixed(2)}</montoTotal>
            <tasaIVA>${Number(item.tasaIVA || 10).toFixed(2)}</tasaIVA>
            <montoIVA>${Number(item.montoIVA || 0).toFixed(2)}</montoIVA>
            ${item.exento ? '<exento>Si</exento>' : '<exento>No</exento>'}
            ${item.exonerado ? '<exonerado>Si</exonerado>' : '<exonerado>No</exonerado>'}
            <codUnidadMedida>${item.codUnidadMedida || 77}</codUnidadMedida>
            <unidadMedida>${escapeXml(item.unidadMedida || 'UNIDAD')}</unidadMedida>
          </dCDetalle>
        </dDetalle>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<kTDE>
  <gTipoDE>${tipoDE}</gTipoDE>
  <gDtipDE>
    <iDTE>${String(tipoDE).padStart(2, '0')}</iDTE>
    <dDesTiDE>${tipoLabel}</dDesTiDE>
  </gDtipDE>
  <gDE>
    <gDatGralOpe>
      <gDatGralDoc>
        <iTimbre>${escapeXml(timbrado)}</iTimbre>
        <dFechaEmi>${fechaEmision}</dFechaEmi>
        <dFecEmiNum>${fechaEmision.replace(/-/g, '')}</dFecEmiNum>
        <gEmis>
          <dRucEm>${escapeXml(rucEmisor)}</dRucEm>
          <dDVEmi>${dvEmisor}</dDVEmi>
          <dNomEmi>${escapeXml(nombreEmisor)}</dNomEmi>
          <dDirEmi>${escapeXml(dirEmisor || '')}</dDirEmi>
          <dNumCasEmi>0</dNumCasEmi>
          <gDatLocalEmi>
            <dDepEmi>${String(cDepEmi).padStart(2, '0')}</dDepEmi>
            <dDesDepEmi>${escapeXml(desDepEmi)}</dDesDepEmi>
            <dCiuEmi>${String(cCiuEmi).padStart(2, '0')}</dCiuEmi>
            <dDesCiuEmi>${escapeXml(desCiuEmi)}</dDesCiuEmi>
          </gDatLocalEmi>
          ${telEmisor ? `<dTelEmi>${escapeXml(telEmisor)}</dTelEmi>` : ''}
          ${emailEmisor ? `<dEmailEmi>${escapeXml(emailEmisor)}</dEmailEmi>` : ''}
          <dCdActEco>${escapeXml(cActEco)}</dCdActEco>
          <dDesActEco>${escapeXml(desActEco)}</dDesActEco>
        </gEmis>
        <gDatRec>
          ${rucReceptor ? `
          <dRucRec>${escapeXml(rucReceptor)}</dRucRec>
          <dDVRec>${dvReceptor || 0}</dDVRec>
          <dNomRec>${escapeXml(nombreReceptor)}</dNomRec>
          <dDirRec>${escapeXml(dirReceptor || '')}</dDirRec>
          <dNumCasRec>0</dNumCasRec>
          <gDatLocalRec>
            <dDepRec>${String(cDepRec).padStart(2, '0')}</dDepRec>
            <dDesDepRec>${escapeXml(desDepRec)}</dDesDepRec>
            <dCiuRec>${String(cCiuRec).padStart(2, '0')}</dCiuRec>
            <dDesCiuRec>${escapeXml(desCiuRec)}</dDesCiuRec>
          </gDatLocalRec>
          ${telReceptor ? `<dTelRec>${escapeXml(telReceptor)}</dTelRec>` : ''}
          ${emailReceptor ? `<dEmailRec>${escapeXml(emailReceptor)}</dEmailRec>` : ''}
          ` : `
          <dTDocRec>${escapeXml(tipoDocReceptor || 'CI')}</dTDocRec>
          <dNumDocRec>${escapeXml(numDocReceptor || '')}</dNumDocRec>
          <dNomRec>${escapeXml(nombreReceptor)}</dNomRec>
          <dDirRec>${escapeXml(dirReceptor || '')}</dDirRec>
          <dNumCasRec>0</dNumCasRec>
          <gDatLocalRec>
            <dDepRec>${String(cDepRec).padStart(2, '0')}</dDepRec>
            <dDesDepRec>${escapeXml(desDepRec)}</dDesDepRec>
            <dCiuRec>${String(cCiuRec).padStart(2, '0')}</dCiuRec>
            <dDesCiuRec>${escapeXml(desCiuRec)}</dDesCiuRec>
          </gDatLocalRec>
          `}
        </gDatRec>
        <gDatosDoc>
          <dCDCDoc>${cdc}</dCDCDoc>
          <dNumDoc>${numeroDoc}</dNumDoc>
          <dSerieDoc>AB</dSerieDoc>
          <dEspDoc>${String(establecimiento).padStart(3, '0')}-${String(puntoExp).padStart(3, '0')}</dEspDoc>
          <dDesCseg>${escapeXml(codigoSeguridad)}</dDesCseg>
          <gOpeDE>
            <iIndPres>1</iIndPres>
            <dMoneda>${moneda}</dMoneda>
            <dTipoCam>1</dTipoCam>
          </gOpeDE>
          <gCamCond>
            <iCondOpe>1</iCondOpe>
          </gCamCond>
          <gTotSub>
            <dSubExe>0.00</dSubExe>
            <dSubExo>0.00</dSubExo>
            <dSub5>${Number(subtotal).toFixed(2)}</dSub5>
            <dSub10>0.00</dSub10>
            <dTotOpe>${Number(subtotal).toFixed(2)}</dTotOpe>
            <dTotIVA>${Number(impuesto).toFixed(2)}</dTotIVA>
            <dTotGralOpe>${Number(total).toFixed(2)}</dTotGralOpe>
          </gTotSub>
        </gDatosDoc>
        <gDatosDocOriginal>
          <iDTipoDEOriginal>01</iDTipoDEOriginal>
          <dCDCOriginal>${cdcOriginal}</dCDCOriginal>
          <dNumDocOriginal>${numeroOriginal}</dNumDocOriginal>
          <dFecEmiOriginal>${fechaOriginal}</dFecEmiOriginal>
          <dMotivo>${escapeXml(motivo)}</dMotivo>
        </gDatosDocOriginal>
      </gDatGralDoc>
      <gDatosAdicionales>
        <gRespFirme>
          <dInfoFirme>MOCK-FIRMA-PARA-PRUEBAS-DEL-SISTEMA</dInfoFirme>
        </gRespFirme>
      </gDatosAdicionales>
    </gDatGralOpe>
    <gDtipDE>${tipoDE}</gDtipDE>
    <gTotSub>
      <dSubExe>0.00</dSubExe>
      <dSubExo>0.00</dSubExo>
      <dSub5>${Number(subtotal).toFixed(2)}</dSub5>
      <dSub10>0.00</dSub10>
      <dTotOpe>${Number(subtotal).toFixed(2)}</dTotOpe>
      <dTotIVA>${Number(impuesto).toFixed(2)}</dTotIVA>
      <dTotGralOpe>${Number(total).toFixed(2)}</dTotGralOpe>
    </gTotSub>
    <gDatosDocOriginal>
      <iDTipoDEOriginal>01</iDTipoDEOriginal>
      <dCDCOriginal>${cdcOriginal}</dCDCOriginal>
      <dNumDocOriginal>${numeroOriginal}</dNumDocOriginal>
      <dFecEmiOriginal>${fechaOriginal}</dFecEmiOriginal>
      <dMotivo>${escapeXml(motivo)}</dMotivo>
    </gDatosDocOriginal>
  </gDE>
  <gItems>
${itemsXml}
  </gItems>
  <gRespFirme>
    <dInfoFirme>MOCK-FIRMA-PARA-PRUEBAS-DEL-SISTEMA</dInfoFirme>
  </gRespFirme>
</kTDE>`

  return xml
}
