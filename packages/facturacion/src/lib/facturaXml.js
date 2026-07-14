function escaparXML(texto) {
  if (texto == null) return ''
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatearFecha(date) {
  if (!date) return new Date().toISOString().slice(0, 19)
  return new Date(date).toISOString().slice(0, 19)
}

function formatearFechaSinHora(date) {
  if (!date) return new Date().toISOString().slice(0, 10)
  return new Date(date).toISOString().slice(0, 10)
}

/**
 * Genera el XML Kude v150 completo según Manual Técnico SIFEN.
 */
export function generarFacturaXml({
  // Emisor
  rucEmisor, dvEmisor, nombreEmisor, dirEmisor, numCasEmisor = 0,
  cDepEmi = 1, desDepEmi = 'CAPITAL', cCiuEmi = 1, desCiuEmi = 'ASUNCION (DISTRITO)',
  telEmisor, emailEmisor,
  cActEco = '00000', desActEco = 'COMERCIO GENERAL',
  iTipCont = 2, cTipReg = 3,

  // Receptor
  rucReceptor, dvReceptor, nombreReceptor, dirReceptor,
  cDepRec = 1, desDepRec = 'CAPITAL', cCiuRec = 1, desCiuRec = 'ASUNCION (DISTRITO)',
  telReceptor, emailReceptor, codCliente,
  iNatRec = 1, iTiOpe = 1, tipoDocReceptor, numDocReceptor, paisReceptor = 'PRY',

  // Documento
  timbrado, establecimiento = 1, puntoExp = 1, numeroDoc = 1, cdc, dvCDC,
  fechaEmision, serieNum = 'AB',

  // Operación
  tipoTransaccion = 1, tipoEmision = 1, codigoSeguridad = '000000001',
  indicadorPresencial = 1, moneda = 'PYG', tipoCambio,

  // Condiciones de pago
  condicionOpe = 1, plazoCredito = 0,

  // Firma (mock)
  digestValue = 'MOCK-HASH-4koJaqXWpOnd3IquMS1s7vbnBaIpYs1d5XjSW+n3uI4=',
  signatureValue = 'MOCK-FIRMA-PARA-PRUEBAS-DEL-SISTEMA',

  // Items
  items = [],

  // Transporte (opcional)
  modoTransporte, responsableFlete,
}) {
  const now = new Date()
  const fecFirma = formatearFecha(now)
  const feEmiDE = fechaEmision ? formatearFecha(fechaEmision) : fecFirma
  const fechaDoc = formatearFechaSinHora(now)

  // Calcular subtotales por tasa de IVA
  let sub5 = 0, sub10 = 0, subExe = 0, subExo = 0
  let iva5 = 0, iva10 = 0
  let totalItems = 0, totalDesc = 0
  let baseGrav5 = 0, baseGrav10 = 0

  for (const item of items) {
    const tasa = item.tasaIva || 10
    const totalItem = (item.cantidad || 1) * (item.precioUnitario || 0)
    const descItem = item.descuento || 0
    const baseGrav = totalItem - descItem

    totalItems += totalItem
    totalDesc += descItem

    if (item.exento) {
      subExe += baseGrav
    } else if (item.exonerado) {
      subExo += baseGrav
    } else if (tasa === 5) {
      sub5 += baseGrav
      iva5 += baseGrav * 0.05
      baseGrav5 += baseGrav
    } else {
      sub10 += baseGrav
      iva10 += baseGrav * 0.10
      baseGrav10 += baseGrav
    }
  }

  const totalOpe = sub5 + sub10 + subExe + subExo
  const totalIva = iva5 + iva10
  const totalGral = totalOpe
  const totalBaseIva = baseGrav5 + baseGrav10

  // Items XML
  const itemsXml = items.map((item, idx) => {
    const tasa = item.tasaIva || 10
    const totalItem = (item.cantidad || 1) * (item.precioUnitario || 0)
    const descItem = item.descuento || 0
    const baseGrav = totalItem - descItem
    const liqIva = item.exento || item.exonerado ? 0 : baseGrav * (tasa / 100)
    const afecIva = item.exento ? 3 : item.exonerado ? 2 : 1

    return `
      <gCamItem>
        <dCodInt>${escaparXML(item.codigoInterno || `ITEM${idx + 1}`)}</dCodInt>
        <dDesProSer>${escaparXML(item.descripcion)}</dDesProSer>
        <cUniMed>${item.codUnidadMedida || 77}</cUniMed>
        <dDesUniMed>${escaparXML(item.unidadMedida || 'UNI')}</dDesUniMed>
        <dCantProSer>${Math.round(Number(item.cantidad || 1))}</dCantProSer>
        ${item.infItem ? `<dInfItem>${item.infItem}</dInfItem>` : ''}
        <gValorItem>
          <dPUniProSer>${Math.round(Number(item.precioUnitario || 0))}</dPUniProSer>
          <dTotBruOpeItem>${Math.round(totalItem)}</dTotBruOpeItem>
          <gValorRestaItem>
            <dDescItem>${Math.round(descItem)}</dDescItem>
            <dPorcDesIt>${item.porcDescuento || 0}</dPorcDesIt>
            <dDescGloItem>0</dDescGloItem>
            <dTotOpeItem>${Math.round(baseGrav)}</dTotOpeItem>
          </gValorRestaItem>
        </gValorItem>
        <gCamIVA>
          <iAfecIVA>${afecIva}</iAfecIVA>
          <dDesAfecIVA>${item.exento ? 'Exento' : item.exonerado ? 'Exonerado' : 'Gravado IVA'}</dDesAfecIVA>
          <dPropIVA>100</dPropIVA>
          <dTasaIVA>${tasa}</dTasaIVA>
          <dBasGravIVA>${Math.round(baseGrav)}</dBasGravIVA>
          <dLiqIVAItem>${Math.round(liqIva)}</dLiqIVAItem>
        </gCamIVA>
      </gCamItem>`
  }).join('')

  const idDE = cdc || `ID-${Date.now()}`
const nomMone = { PYG: 'Guarani', USD: 'Dólar americano', BRL: 'Real', ARS: 'Peso argentino', CLP: 'Peso chileno', COP: 'Peso colombiano', PEN: 'Sol', UYU: 'Peso uruguayo', BOB: 'Boliviano', MXN: 'Peso mexicano' }

const TIPOS_DOC_REC = { 1: 'Cédula paraguaya', 2: 'Pasaporte', 3: 'Cédula extranjera', 4: 'Carnet de residencia' }

// Generar bloque gDatRec condicional según tipo de receptor
let gDatRecXml = ''
if (tipoDocReceptor && !rucReceptor) {
  // Receptor sin RUC → documento alternativo
  gDatRecXml = `
      <gDatRec>
        <iNatRec>${iNatRec}</iNatRec>
        <iTiOpe>${iTiOpe}</iTiOpe>
        <cPaisRec>${paisReceptor}</cPaisRec>
        <dDesPaisRe>${paisReceptor === 'PRY' ? 'Paraguay' : 'Extranjero'}</dDesPaisRe>
        <iTiIDRec>${tipoDocReceptor}</iTiIDRec>
        <dDTiIDRec>${TIPOS_DOC_REC[tipoDocReceptor] || 'Documento de identidad'}</dDTiIDRec>
        <dNumIDRec>${escaparXML(String(numDocReceptor))}</dNumIDRec>
        <dNomRec>${escaparXML(nombreReceptor || '')}</dNomRec>
        ${dirReceptor ? `<dDirRec>${escaparXML(dirReceptor)}</dDirRec>` : ''}
        <dNumCasRec>0</dNumCasRec>
        ${cDepRec ? `<cDepRec>${cDepRec}</cDepRec>` : ''}
        ${desDepRec ? `<dDesDepRec>${escaparXML(desDepRec)}</dDesDepRec>` : ''}
        ${cCiuRec ? `<cCiuRec>${cCiuRec}</cCiuRec>` : ''}
        ${desCiuRec ? `<dDesCiuRec>${escaparXML(desCiuRec)}</dDesCiuRec>` : ''}
        <dTelRec>${escaparXML(telReceptor || '')}</dTelRec>
        ${emailReceptor ? `<dEmailRec>${escaparXML(emailReceptor)}</dEmailRec>` : ''}
      </gDatRec>`
} else {
  // Receptor con RUC (por defecto)
  const nomPais = { PRY: 'Paraguay', ARG: 'Argentina', BRA: 'Brasil', CHL: 'Chile', COL: 'Colombia', PER: 'Perú', URY: 'Uruguay', BOL: 'Bolivia', ECU: 'Ecuador', VEN: 'Venezuela', MEX: 'México', USA: 'Estados Unidos', ESP: 'España' }
  gDatRecXml = `
      <gDatRec>
        <iNatRec>${iNatRec}</iNatRec>
        <iTiOpe>${iTiOpe}</iTiOpe>
        <cPaisRec>${paisReceptor}</cPaisRec>
        <dDesPaisRe>${nomPais[paisReceptor] || 'Extranjero'}</dDesPaisRe>
        <iTiContRec>2</iTiContRec>
        <dRucRec>${escaparXML(String(rucReceptor || ''))}</dRucRec>
        <dDVRec>${dvReceptor || 0}</dDVRec>
        <dNomRec>${escaparXML(nombreReceptor || '')}</dNomRec>
        <dDirRec>${escaparXML(dirReceptor || '')}</dDirRec>
        <dNumCasRec>0</dNumCasRec>
        ${cDepRec ? `<cDepRec>${cDepRec}</cDepRec>` : ''}
        ${desDepRec ? `<dDesDepRec>${escaparXML(desDepRec)}</dDesDepRec>` : ''}
        ${cCiuRec ? `<cCiuRec>${cCiuRec}</cCiuRec>` : ''}
        ${desCiuRec ? `<dDesCiuRec>${escaparXML(desCiuRec)}</dDesCiuRec>` : ''}
        <dTelRec>${escaparXML(telReceptor || '')}</dTelRec>
        ${emailReceptor ? `<dEmailRec>${escaparXML(emailReceptor)}</dEmailRec>` : ''}
        ${codCliente ? `<dCodCliente>${escaparXML(codCliente)}</dCodCliente>` : ''}
      </gDatRec>`
}

const desMone = nomMone[moneda] || 'Guarani'

  return `<?xml version="1.0" encoding="UTF-8"?>
<rDE xmlns="https://ekuatia.set.gov.py/sifen/xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://ekuatia.set.gov.py/sifen/xsd siRecepDE_v150.xsd">
  <dVerFor>150</dVerFor>
  <DE Id="${escaparXML(idDE)}">
    <dDVId>${dvCDC || 1}</dDVId>
    <dFecFirma>${fecFirma}</dFecFirma>
    <dSisFact>1</dSisFact>
    <gOpeDE>
      <iTipEmi>${tipoEmision}</iTipEmi>
      <dDesTipEmi>${tipoEmision === 1 ? 'Normal' : 'Contingencia'}</dDesTipEmi>
      <dCodSeg>${codigoSeguridad || '000000001'}</dCodSeg>
      <dInfoEmi>1</dInfoEmi>
      <dInfoFisc>Documento generado por sistema de facturación</dInfoFisc>
    </gOpeDE>
    <gTimb>
      <iTiDE>1</iTiDE>
      <dDesTiDE>Factura electrónica</dDesTiDE>
      <dNumTim>${escaparXML(String(timbrado))}</dNumTim>
      <dEst>${String(establecimiento).padStart(3, '0')}</dEst>
      <dPunExp>${String(puntoExp).padStart(3, '0')}</dPunExp>
      <dNumDoc>${String(numeroDoc).padStart(7, '0')}</dNumDoc>
      <dSerieNum>${escaparXML(serieNum)}</dSerieNum>
      <dFeIniT>${formatearFechaSinHora(fechaEmision || now)}</dFeIniT>
    </gTimb>
    <gDatGralOpe>
      <dFeEmiDE>${feEmiDE}</dFeEmiDE>
      <gOpeCom>
        <iTipTra>${tipoTransaccion}</iTipTra>
        <dDesTipTra>${tipoTransaccion === 1 ? 'Venta de mercadería' : 'Venta de servicios'}</dDesTipTra>
        <iTImp>1</iTImp>
        <dDesTImp>IVA</dDesTImp>
        <cMoneOpe>${moneda}</cMoneOpe>
        <dDesMoneOpe>${desMone}</dDesMoneOpe>
        ${moneda !== 'PYG' && tipoCambio != null ? `
        <dTCamb>${tipoCambio}</dTCamb>` : ''}
      </gOpeCom>
      <gEmis>
        <dRucEm>${escaparXML(String(rucEmisor))}</dRucEm>
        <dDVEmi>${dvEmisor || 0}</dDVEmi>
        <iTipCont>${iTipCont}</iTipCont>
        <cTipReg>${cTipReg}</cTipReg>
        <dNomEmi>${escaparXML(nombreEmisor)}</dNomEmi>
        <dDirEmi>${escaparXML(dirEmisor || '')}</dDirEmi>
        <dNumCas>${numCasEmisor}</dNumCas>
        <cDepEmi>${cDepEmi}</cDepEmi>
        <dDesDepEmi>${escaparXML(desDepEmi)}</dDesDepEmi>
        <cCiuEmi>${cCiuEmi}</cCiuEmi>
        <dDesCiuEmi>${escaparXML(desCiuEmi)}</dDesCiuEmi>
        <dTelEmi>${escaparXML(telEmisor || '')}</dTelEmi>
        <dEmailE>${escaparXML(emailEmisor || '')}</dEmailE>
        <gActEco>
          <cActEco>${cActEco}</cActEco>
          <dDesActEco>${escaparXML(desActEco)}</dDesActEco>
        </gActEco>
      </gEmis>
      ${gDatRecXml}
    </gDatGralOpe>
    <gDtipDE>
      <gCamFE>
        <iIndPres>${indicadorPresencial}</iIndPres>
        <dDesIndPres>${indicadorPresencial === 1 ? 'Operación presencial' : 'Operación no presencial'}</dDesIndPres>
      </gCamFE>
      <gCamCond>
        <iCondOpe>${condicionOpe}</iCondOpe>
        <dDCondOpe>${condicionOpe === 1 ? 'Contado' : 'Crédito'}</dDCondOpe>
        ${condicionOpe === 2 ? `
        <gPagCred>
          <iCondCred>1</iCondCred>
          <dDCondCred>Plazo</dDCondCred>
          <dPlazoCre>${plazoCredito || 30}</dPlazoCre>
        </gPagCred>` : ''}
      </gCamCond>
      ${itemsXml}
      <gCamEsp>
        <gGrupAdi>
          <dCiclo>${now.toLocaleString('es', { month: 'long' }).toUpperCase()}</dCiclo>
          <dFecIniC>${new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)}</dFecIniC>
          <dFecFinC>${new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)}</dFecFinC>
        </gGrupAdi>
      </gCamEsp>
      <gTransp>
        <iModTrans>${modoTransporte || 1}</iModTrans>
        <dDesModTrans>${modoTransporte === 2 ? 'Fluvial' : modoTransporte === 3 ? 'Aéreo' : 'Terrestre'}</dDesModTrans>
        <iRespFlete>${responsableFlete || 2}</iRespFlete>
        <dNuDespImp>0</dNuDespImp>
      </gTransp>
    </gDtipDE>
    <gTotSub>
      <dSubExe>${Math.round(subExe)}</dSubExe>
      <dSubExo>${Math.round(subExo)}</dSubExo>
      <dSub5>${Math.round(sub5)}</dSub5>
      <dSub10>${Math.round(sub10)}</dSub10>
      <dTotOpe>${Math.round(totalOpe)}</dTotOpe>
      <dTotDesc>${Math.round(totalDesc)}</dTotDesc>
      <dTotDescGlotem>0</dTotDescGlotem>
      <dTotAntItem>0</dTotAntItem>
      <dTotAnt>0</dTotAnt>
      <dPorcDescTotal>0</dPorcDescTotal>
      <dDescTotal>0.0</dDescTotal>
      <dAnticipo>0</dAnticipo>
      <dRedon>0.0</dRedon>
      <dTotGralOpe>${Math.round(totalGral)}</dTotGralOpe>
      <dIVA5>${Math.round(iva5)}</dIVA5>
      <dIVA10>${Math.round(iva10)}</dIVA10>
      <dTotIVA>${Math.round(totalIva)}</dTotIVA>
      <dBaseGrav5>${Math.round(baseGrav5)}</dBaseGrav5>
      <dBaseGrav10>${Math.round(baseGrav10)}</dBaseGrav10>
      <dTBasGraIVA>${Math.round(totalBaseIva)}</dTBasGraIVA>
    </gTotSub>
  </DE>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />
      <Reference URI="#${escaparXML(idDE)}">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />
        <DigestValue>${escaparXML(digestValue)}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${escaparXML(signatureValue)}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>MOCK-CERTIFICADO-DE-PRUEBA-SIN-VALOR-FISCAL</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
  <gCamFuFD>
    <dCarQR>https://ekuatia.set.gov.py/consultas?nVersion=150&amp;Id=${escaparXML(idDE)}&amp;dFeEmiDE=${feEmiDE.replace(/[-:]/g, '').slice(0, 14)}&amp;dRucRec=${escaparXML(String(rucReceptor || ''))}&amp;dTotGralOpe=${totalGral}&amp;dTotIVA=${Math.round(totalIva)}&amp;cItems=${items.length}</dCarQR>
  </gCamFuFD>
</rDE>`
}
