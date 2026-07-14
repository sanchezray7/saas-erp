import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { obtenerEmpleado, listarContratos, obtenerBancarioActivo, listarBancarioHistorial, obtenerFiscalActivo, listarFiscalHistorial, listarDocumentos } from '../data/empleados'

export function EmpleadoDetailPage() {
  const { id } = useParams()
  const [emp, setEmp] = useState(null)
  const [contratos, setContratos] = useState([])
  const [bancario, setBancario] = useState(null)
  const [bancarioHist, setBancarioHist] = useState([])
  const [fiscal, setFiscal] = useState(null)
  const [fiscalHist, setFiscalHist] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const emp = await obtenerEmpleado(id)
        if (!emp) { setLoading(false); return }
        setEmp(emp)
        const [c, b, bh, f, fh, d] = await Promise.all([
          listarContratos(id).catch(() => []),
          obtenerBancarioActivo(id).catch(() => null),
          listarBancarioHistorial(id).catch(() => []),
          obtenerFiscalActivo(id).catch(() => null),
          listarFiscalHistorial(id).catch(() => []),
          listarDocumentos(id).catch(() => []),
        ])
        setContratos(c); setBancario(b); setBancarioHist(bh)
        setFiscal(f); setFiscalHist(fh); setDocumentos(d)
      } catch (_) {}
      finally { setLoading(false) }
    }
    load()
  }, [id])

  if (loading) return <Skeleton.Card />
  if (!emp) return <div className="card"><p className="meta">Empleado no encontrado</p></div>

  const contratoActivo = contratos.find((c) => !c.vigencia_hasta)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/empleados"><Button variant="ghost" size="sm">Volver</Button></Link>
        <Link to={`/empleados/${id}/editar`}><Button size="sm">Editar</Button></Link>
      </div>

      {/* Datos personales */}
      <div className="card">
        <div className="page-header">
          <h1 style={{ fontSize: '1rem', margin: 0 }}>👤 {emp.nombre} {emp.apellido}</h1>
          <span className="badge" style={{ background: emp.activo ? '#dcfce7' : '#f5f5f5', color: emp.activo ? '#16a34a' : '#9ca3af' }}>{emp.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div><div className="meta">Email</div><div>{emp.email || '—'}</div></div>
          <div><div className="meta">Teléfono</div><div>{emp.telefono || '—'}</div></div>
          <div><div className="meta">Dirección</div><div>{emp.direccion || '—'}</div></div>
          <div><div className="meta">Fecha de nacimiento</div><div>{emp.fecha_nacimiento?.slice(0, 10) || '—'}</div></div>
          <div><div className="meta">Código biométrico</div><div style={{ fontFamily: 'monospace' }}>{emp.codigo_biometrico || '—'}</div></div>
        </div>
      </div>

      {/* Contrato activo */}
      {contratoActivo && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>💼 Contrato activo</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div><div className="meta">Departamento</div><div style={{ fontWeight: 600 }}>{contratoActivo.departamento?.nombre || '—'}</div></div>
            <div><div className="meta">Puesto</div><div style={{ fontWeight: 600 }}>{contratoActivo.puesto?.nombre || contratoActivo.cargo || '—'}</div></div>
            <div><div className="meta">Tipo</div><div>{contratoActivo.tipo}</div></div>
            <div><div className="meta">Vigencia desde</div><div>{contratoActivo.vigencia_desde?.slice(0, 10)}</div></div>
            <div><div className="meta">Salario</div><div style={{ fontWeight: 700 }}>{formatMoney(contratoActivo.salario, contratoActivo.moneda)}</div></div>
          </div>
        </div>
      )}

      {/* Historial de contratos */}
      {contratos.length >= 1 && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>📋 Historial de contratos</h3>
          {contratos.filter((c) => c.vigencia_hasta).length === 0 ? (
            <p className="meta" style={{ fontSize: '0.82rem' }}>Contrato inicial — sin cambios anteriores</p>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ fontSize: '0.82rem' }}>
                <thead><tr><th>Vigencia</th><th>Departamento</th><th>Salario</th><th>Tipo</th></tr></thead>
                <tbody>
                  {contratos.filter((c) => c.vigencia_hasta).map((c) => (
                    <tr key={c.id}>
                      <td className="meta">{c.vigencia_desde?.slice(0, 10)} → {c.vigencia_hasta?.slice(0, 10)}</td>
                      <td>{c.departamento?.nombre || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(c.salario, c.moneda)}</td>
                      <td>{c.tipo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bancario activo */}
      {bancario && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>🏦 Datos bancarios</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div><div className="meta">Banco</div><div>{bancario.banco || '—'}</div></div>
            <div><div className="meta">Cuenta</div><div>{bancario.numero_cuenta || '—'}</div></div>
            <div><div className="meta">Tipo</div><div>{bancario.tipo_cuenta || '—'}</div></div>
            <div><div className="meta">Vigencia desde</div><div>{bancario.vigencia_desde?.slice(0, 10)}</div></div>
          </div>
          {bancarioHist.length >= 1 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>📋 Historial de cambios bancarios</summary>
              {bancarioHist.filter((b) => b.vigencia_hasta).length === 0 ? (
                <p className="meta" style={{ fontSize: '0.78rem', padding: '4px 0' }}>Sin cambios anteriores (registro inicial)</p>
              ) : (
                bancarioHist.filter((b) => b.vigencia_hasta).map((b) => (
                  <div key={b.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{b.banco || '—'} · {b.numero_cuenta || '—'}</span>
                    <span className="meta">{b.vigencia_desde?.slice(0, 10)} → {b.vigencia_hasta?.slice(0, 10)}</span>
                  </div>
                ))
              )}
            </details>
          )}
        </div>
      )}

      {/* Fiscal activo */}
      {fiscal && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>📄 Datos fiscales</h3>
          <div><div className="meta">N° IPS / INSS</div><div style={{ fontWeight: 600 }}>{fiscal.numero_ips || '—'}</div></div>
          <div><div className="meta">Vigencia desde</div><div>{fiscal.vigencia_desde?.slice(0, 10)}</div></div>
          {fiscalHist.length >= 1 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>📋 Historial de cambios fiscales</summary>
              {fiscalHist.filter((f) => f.vigencia_hasta).length === 0 ? (
                <p className="meta" style={{ fontSize: '0.78rem', padding: '4px 0' }}>Sin cambios anteriores</p>
              ) : (
                fiscalHist.filter((f) => f.vigencia_hasta).map((f) => (
                  <div key={f.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>IPS: {f.numero_ips || '—'}</span>
                    <span className="meta">{f.vigencia_desde?.slice(0, 10)} → {f.vigencia_hasta?.slice(0, 10)}</span>
                  </div>
                ))
              )}
            </details>
          )}
        </div>
      )}

      {/* Documentos */}
      {documentos.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>🪪 Documentos</h3>
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead><tr><th>Tipo</th><th>N°</th><th>Emisión</th><th>Vencimiento</th><th>Vigencia</th></tr></thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.tipo}</td>
                    <td>{d.numero || '—'}</td>
                    <td className="meta">{d.fecha_emision?.slice(0, 10) || '—'}</td>
                    <td className="meta">{d.fecha_vencimiento?.slice(0, 10) || '—'}</td>
                    <td className="meta">{d.vigencia_desde?.slice(0, 10)}{d.vigencia_hasta ? ` → ${d.vigencia_hasta.slice(0, 10)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
