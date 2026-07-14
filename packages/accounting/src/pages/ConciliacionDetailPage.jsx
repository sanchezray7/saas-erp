import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, alertError, notify } from '@saas/core'
import { obtenerConciliacion, listarExtractos, importarExtracto, toggleConciliarExtracto, cerrarConciliacion, obtenerTransaccionLibro } from '../data/conciliacion'

export function ConciliacionDetailPage() {
  const { id } = useParams()
  const { activeCompanyId } = useAuth()
  const [concil, setConcil] = useState(null)
  const [extractos, setExtractos] = useState([])
  const [libro, setLibro] = useState([])
  const [loading, setLoading] = useState(true)
  const [csvText, setCsvText] = useState('')
  const [importando, setImportando] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    obtenerConciliacion(id)
      .then((c) => {
        setConcil(c)
        return Promise.all([
          listarExtractos(id),
          c ? obtenerTransaccionLibro(c.account_id, c.periodo_inicio?.slice(0, 10), c.periodo_fin?.slice(0, 10)) : Promise.resolve([]),
        ]).then(([e, l]) => {
          setExtractos(e)
          setLibro(l || [])
        })
      }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function handleImportar() {
    if (!csvText.trim()) { alertError('Error', 'Pegá las líneas del extracto'); return }
    setImportando(true)
    try {
      const lineas = csvText.trim().split('\n').map((linea) => {
        const partes = linea.split('\t').map((p) => p.trim())
        // Formato esperado: fecha\tconcepto\tmonto\treferencia (opcional)
        return { fecha: partes[0], concepto: partes[1] || '', monto: partes[2] || '0', referencia: partes[3] || '' }
      })
      await importarExtracto(activeCompanyId, concil.account_id, id, lineas)
      const nuevos = await listarExtractos(id)
      setExtractos(nuevos)
      setCsvText('')
      notify(`${lineas.length} líneas importadas`)
    } catch (err) { alertError('Error', err.message) }
    finally { setImportando(false) }
  }

  async function handleToggle(extractoId, actual) {
    try {
      await toggleConciliarExtracto(extractoId, !actual)
      setExtractos((prev) => prev.map((e) => e.id === extractoId ? { ...e, conciliado: !actual } : e))
    } catch (err) { alertError('Error', err.message) }
  }

  async function handleCerrar() {
    if (!window.confirm('¿Cerrar esta conciliación?')) return
    setCerrando(true)
    try {
      await cerrarConciliacion(id)
      notify('Conciliación cerrada')
      setConcil((prev) => ({ ...prev, estado: 'cerrada' }))
    } catch (err) { alertError('Error', err.message) }
    finally { setCerrando(false) }
  }

  if (loading) return <Skeleton.Card />
  if (!concil) return <div className="card"><p className="meta">Conciliación no encontrada</p></div>

  const totalExtracto = extractos.reduce((s, e) => s + Number(e.monto), 0)
  const conciliados = extractos.filter((e) => e.conciliado).reduce((s, e) => s + Number(e.monto), 0)
  const dif = Number(concil.saldo_final_extracto) - Number(concil.saldo_final_libro)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/conciliacion"><Button variant="ghost" size="sm">Volver</Button></Link>
        {concil.estado === 'abierta' && (
          <Button size="sm" onClick={handleCerrar} disabled={cerrando}>
            {cerrando ? 'Cerrando...' : '✅ Cerrar conciliación'}
          </Button>
        )}
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1rem', margin: 0 }}>
              🏦 {concil.account?.banco_nombre || concil.account?.name || 'Cuenta'}
            </h1>
            <p className="meta">
              {concil.account?.numero_cuenta ? `Cuenta: ${concil.account.numero_cuenta}` : concil.account?.code}
              {' · '}
              {concil.periodo_inicio?.slice(0, 10)} — {concil.periodo_fin?.slice(0, 10)}
            </p>
          </div>
          <span className="badge" style={{ background: concil.estado === 'cerrada' ? '#dcfce7' : '#fef3c7', color: concil.estado === 'cerrada' ? '#16a34a' : '#d97706' }}>
            {concil.estado}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
          <div><div className="meta">Saldo extracto</div><div style={{ fontWeight: 700 }}>{Number(concil.saldo_final_extracto).toLocaleString()}</div></div>
          <div><div className="meta">Saldo libro</div><div style={{ fontWeight: 700 }}>{Number(concil.saldo_final_libro).toLocaleString()}</div></div>
          <div><div className="meta">Diferencia</div><div style={{ fontWeight: 700, color: dif === 0 ? '#16a34a' : '#dc2626' }}>{dif.toLocaleString()}</div></div>
          <div><div className="meta">Conciliado</div><div style={{ fontWeight: 700, color: '#16a34a' }}>{conciliados.toLocaleString()}</div></div>
          <div><div className="meta">Pendiente</div><div style={{ fontWeight: 700, color: '#d97706' }}>{(totalExtracto - conciliados).toLocaleString()}</div></div>
        </div>
      </div>

      {/* Cargar extracto */}
      {concil.estado === 'abierta' && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>📥 Cargar extracto bancario</h3>
          <p className="meta" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
            Pegá las líneas copiadas del extracto. Formato: <strong>fecha (YYYY-MM-DD) TAB concepto TAB monto TAB referencia</strong>.
            Una línea por movimiento. Usá monto negativo para egresos, positivo para ingresos.
          </p>
          <textarea className="form-input" rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)}
            placeholder={`2026-06-01\tSaldo inicial\t5000000\n2026-06-05\tTransferencia cliente X\t+1500000\tREF123\n2026-06-10\tPago proveedor Y\t-800000\tCH-0042\n2026-06-15\tComisión bancaria\t-25000`}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem' }} />
          <div style={{ marginTop: 8 }}>
            <Button size="sm" onClick={handleImportar} disabled={importando || !csvText.trim()}>
              {importando ? 'Importando...' : '📥 Importar extracto'}
            </Button>
          </div>
        </div>
      )}

      {/* Extracto vs Libro */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>📋 Movimientos</h3>
        {extractos.length === 0 ? (
          <p className="meta" style={{ padding: 16, textAlign: 'center' }}>Cargá el extracto bancario para ver los movimientos.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>✓</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {extractos.map((e) => (
                  <tr key={e.id} style={{ background: e.conciliado ? '#f0fdf4' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      {concil.estado === 'abierta' ? (
                        <input type="checkbox" checked={e.conciliado} onChange={() => handleToggle(e.id, e.conciliado)} />
                      ) : (
                        <span>{e.conciliado ? '✅' : '⏳'}</span>
                      )}
                    </td>
                    <td className="meta">{e.fecha?.slice(0, 10)}</td>
                    <td>{e.concepto}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: Number(e.monto) >= 0 ? '#16a34a' : '#dc2626' }}>
                      {Number(e.monto).toLocaleString()}
                    </td>
                    <td className="meta">{e.referencia || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
