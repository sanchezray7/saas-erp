import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, formatMoney, alertError } from '@saas/core'
import { listarEmpleados, listarDepartamentos } from '../data/empleados'

export function EmpleadosPage() {
  const { activeCompanyId } = useAuth()
  const [data, setData] = useState([])
  const [deptos, setDeptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtroDepto, setFiltroDepto] = useState('')

  useEffect(() => {
    Promise.all([
      listarEmpleados(activeCompanyId).catch(() => []),
      listarDepartamentos(activeCompanyId).catch(() => []),
    ]).then(([emps, deps]) => {
      setData(emps)
      setDeptos(deps)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />

  const filtradas = data.filter((e) => {
    const nombre = `${e.nombre} ${e.apellido}`.toLowerCase()
    const matchQ = !q || nombre.includes(q.toLowerCase()) || (e.email || '').includes(q.toLowerCase())
    const matchDepto = !filtroDepto || e.contrato_activo?.departamento?.nombre === filtroDepto
    return matchQ && matchDepto
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>👤 Empleados</h1>
          <Link to="/empleados/nuevo"><Button size="sm">+ Nuevo empleado</Button></Link>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Buscar por nombre o email..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220, fontSize: '0.82rem' }} />
          <select className="form-input" value={filtroDepto} onChange={(e) => setFiltroDepto(e.target.value)} style={{ width: 160, fontSize: '0.82rem' }}>
            <option value="">Todos los departamentos</option>
            {deptos.map((d) => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
          </select>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="card"><p className="meta" style={{ padding: 24, textAlign: 'center' }}>No hay empleados registrados</p></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Código biométrico</th>
                  <th>Departamento</th>
                  <th>Puesto</th>
                  <th>Salario</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Nombre" style={{ fontWeight: 600 }}>{e.apellido}, {e.nombre}</td>
                    <td data-label="Email" className="meta">{e.email || '—'}</td>
                    <td data-label="Código biométrico" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{e.codigo_biometrico || '—'}</td>
                    <td data-label="Departamento">{e.contrato_activo?.departamento?.nombre || '—'}</td>
                    <td data-label="Puesto">{e.contrato_activo?.puesto?.nombre || e.contrato_activo?.cargo || '—'}</td>
                    <td data-label="Salario" style={{ fontWeight: 600 }}>{formatMoney(e.contrato_activo?.salario || 0, e.contrato_activo?.moneda)}</td>
                    <td><Link to={`/empleados/${e.id}`} className="link" style={{ fontSize: '0.82rem' }}>Ver</Link></td>
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
