import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Button, alertError, notify, ConfirmModal } from '@saas/core'

const FIELD_MAP = {
  contacts: {
    name: { label: 'Nombre', required: true },
    email: { label: 'Email', required: false },
    phone: { label: 'Teléfono', required: false },
    position: { label: 'Cargo', required: false },
    source: { label: 'Origen', required: false },
    notes: { label: 'Notas', required: false },
  },
  organizations: {
    name: { label: 'Nombre', required: true },
    email: { label: 'Email', required: false },
    phone: { label: 'Teléfono', required: false },
    website: { label: 'Sitio web', required: false },
    industry: { label: 'Industria', required: false },
    description: { label: 'Descripción', required: false },
  },
  deals: {
    title: { label: 'Título', required: true },
    value: { label: 'Valor', required: false },
    notes: { label: 'Notas', required: false },
    expected_close_date: { label: 'Fecha cierre', required: false },
  },
  productos: {
    nombre: { label: 'Nombre', required: true },
    codigo: { label: 'Código', required: false },
    tipo: { label: 'Tipo (producto/servicio)', required: false },
    descripcion: { label: 'Descripción', required: false },
    precio_unitario: { label: 'Precio unitario', required: true },
    moneda: { label: 'Moneda (PYG/USD/etc)', required: false },
    unidad_medida: { label: 'Unidad medida', required: false },
  },
}

const ALIASES = {
  name: ['name', 'nombre', 'nome', 'full_name', 'fullname'],
  email: ['email', 'correo', 'e-mail', 'mail'],
  phone: ['phone', 'telefono', 'teléfono', 'telefone', 'tel'],
  position: ['position', 'cargo', 'cargo_contacts', 'job_title', 'title'],
  source: ['source', 'origen', 'origem', 'lead_source'],
  notes: ['notes', 'notas', 'note', 'observations', 'observaciones'],
  website: ['website', 'web', 'site', 'sitio', 'url'],
  industry: ['industry', 'industria', 'indústria', 'sector'],
  description: ['description', 'descripcion', 'descrição', 'desc'],
  title: ['title', 'titulo', 'título', 'deal', 'deal_name', 'name'],
  value: ['value', 'valor', 'amount', 'monto', 'val'],
  expected_close_date: ['expected_close_date', 'close_date', 'fecha_cierre', 'cierre', 'closing_date'],
}

function detectColumn(header) {
  const h = header.toLowerCase().trim().replace(/[_-]/g, '')
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.some((a) => a.replace(/[_-]/g, '') === h || header.toLowerCase() === a)) return field
  }
  return null
}

export function ImportCsvModal({ entity, onImport, onClose }) {
  const { t } = useTranslation()
  const fileRef = useRef(null)
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [columnMap, setColumnMap] = useState({})
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const fields = FIELD_MAP[entity]

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete(results) {
          setHeaders(results.meta.fields || [])
          setRows(results.data.filter((r) => Object.values(r).some((v) => v)))
          setParsing(false)
        },
        error() {
          alertError('Error', 'Error al leer el CSV')
          setParsing(false)
        },
      })
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
          if (data.length === 0) {
            alertError('Error', 'El archivo no contiene datos')
            setParsing(false)
            return
          }
          setHeaders(Object.keys(data[0]))
          setRows(data)
        } catch {
          alertError('Error', 'Error al leer el archivo Excel')
        }
        setParsing(false)
      }
      reader.readAsArrayBuffer(file)
    }
  }

  function autoMap() {
    const map = {}
    for (const h of headers) {
      const field = detectColumn(h)
      if (field && fields[field]) map[h] = field
    }
    setColumnMap(map)
  }

  async function handleImport() {
    setConfirming(false)
    setImporting(true)
    try {
      const mapped = rows.map((row) => {
        const obj = {}
        for (const [header, field] of Object.entries(columnMap)) {
          obj[field] = row[header]?.trim() ?? ''
        }
        return obj
      }).filter((r) => r[Object.keys(fields).find((k) => fields[k].required)]?.trim())

      if (mapped.length === 0) {
        alertError('Error', 'No hay filas con datos válidos después del mapeo')
        setImporting(false)
        return
      }

      await onImport(mapped)
      notify(t('common.importado', `${mapped.length} registros importados`))
      onClose()
    } catch (err) {
      alertError('Error', err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="page-header">
          <h2>{t('common.importar')} {entity}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            style={{ marginBottom: 8 }}
          />
          <p className="meta" style={{ fontSize: '0.75rem' }}>{t('common.formatosAceptados', 'CSV, Excel (.xlsx, .xls)')}</p>
        </div>

        {parsing && <p className="meta">{t('common.cargando')}…</p>}

        {headers.length > 0 && !parsing && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Button size="xs" onClick={autoMap}>{t('common.autoMapear', 'Auto-mapear')}</Button>
            </div>

            <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h}>
                        <select
                          value={columnMap[h] || ''}
                          onChange={(e) => setColumnMap((m) => ({ ...m, [h]: e.target.value }))}
                          style={{ fontSize: '0.75rem', maxWidth: 120 }}
                        >
                          <option value="">— {t('common.noMapear', 'No mapear')} —</option>
                          {Object.entries(fields).map(([key, f]) => (
                            <option key={key} value={key}>{f.label}{f.required ? ' *' : ''}</option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {headers.map((h) => <td key={h}>{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="meta" style={{ marginBottom: 12 }}>
              {rows.length} {t('common.registrosEncontrados', 'registros encontrados')}
              {Object.values(columnMap).filter(Boolean).length > 0 && (
                <> · {Object.values(columnMap).filter(Boolean).length} {t('common.columnasMapeadas', 'columnas mapeadas')}</>
              )}
            </p>

            <div className="config-form-actions">
              <Button
                size="sm"
                onClick={() => setConfirming(true)}
                disabled={importing || Object.values(columnMap).filter(Boolean).length === 0}
              >
                {importing ? t('common.importando', 'Importando…') : t('common.importar')}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancelar')}</Button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: var(--color-surface); border-radius: var(--radius-lg); padding: 24px; width: 90%; max-width: 700px; box-shadow: var(--shadow-lg); }
      `}</style>

      {confirming && (
        <ConfirmModal
          title={t('common.confirmarImportacion', '¿Confirmar importación?')}
          onConfirm={handleImport}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
