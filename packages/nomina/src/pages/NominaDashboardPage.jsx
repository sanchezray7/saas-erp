import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, Skeleton, PERMISSIONS } from '@saas/core'
import { obtenerResumenNomina, obtenerNominaPorDepartamento } from '../data/dashboard'
import { fmtMonto } from '../data/periodos'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

export function NominaDashboardPage() {
  const { activeCompanyId, pais, can } = useAuth()
  const [data, setData] = useState(null)
  const [deptos, setDeptos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeCompanyId) return
    ;(async () => {
      try {
        const res = await obtenerResumenNomina(activeCompanyId)
        setData(res)
        if (res.ultimo) {
          const d = await obtenerNominaPorDepartamento(activeCompanyId, res.ultimo.id).catch(() => [])
          setDeptos(d)
        }
      } catch (_) {}
      setLoading(false)
    })()
  }, [activeCompanyId])

  if (loading) return <Skeleton.Card />
  if (!data || !data.ultimo) return (
    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
      <p className="meta">Sin datos. Calculá al menos un período de nómina para ver el dashboard.</p>
      {can(PERMISSIONS.NOMINA_VER) && <Link to="/nomina/periodos" className="btn btn-sm" style={{ display: 'inline-block', marginTop: 12, color: '#2563eb' }}>Ir a períodos</Link>}
    </div>
  )

  const { kpis, evolucion } = data
  const tieneEvol = evolucion.length > 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="page-header">
          <h1>📊 Dashboard de nómina</h1>
          <span className="meta">Último período: {data.ultimo.nombre}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{kpis.empleados}</div>
          <div className="kpi-label">Empleados</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#16a34a' }}>{fmtMonto(kpis.totalRem)}</div>
          <div className="kpi-label">Total Remunerativo</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#dc2626' }}>{fmtMonto(kpis.totalDed)}</div>
          <div className="kpi-label">Total Deducciones</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#2563eb' }}>{fmtMonto(kpis.neto)}</div>
          <div className="kpi-label">Neto a Pagar</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Evolución neto */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.88rem', margin: '0 0 12px' }}>Evolución neto a pagar</h3>
          {tieneEvol ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtMonto(v)} />
                <Line type="monotone" dataKey="neto" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="meta">Se necesitan al menos 2 períodos</p>}
        </div>

        {/* Remunerativo vs Deducciones */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.88rem', margin: '0 0 12px' }}>Remunerativo vs Deducciones</h3>
          {tieneEvol ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtMonto(v)} />
                <Bar dataKey="remunerativo" fill="#16a34a" name="Remunerativo" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deducciones" fill="#dc2626" name="Deducciones" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="meta">Se necesitan al menos 2 períodos</p>}
        </div>
      </div>

      {/* Por departamento */}
      {deptos.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.88rem', margin: '0 0 12px' }}>Distribución por departamento</h3>
          <div className="table-wrapper">
            <table className="table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr><th>Departamento</th><th style={{ textAlign: 'right' }}>Empleados</th><th style={{ textAlign: 'right' }}>Remunerativo</th><th style={{ textAlign: 'right' }}>Deducciones</th><th style={{ textAlign: 'right' }}>Neto</th></tr>
              </thead>
              <tbody>
                {deptos.map((d) => (
                  <tr key={d.nombre}>
                    <td style={{ fontWeight: 600 }}>{d.nombre}</td>
                    <td style={{ textAlign: 'right' }}>{d.empleados}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMonto(d.remunerativo)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(d.deducciones)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMonto(d.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Últimos períodos */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: '0.88rem', margin: '0 0 12px' }}>Últimos períodos</h3>
        <div className="table-wrapper">
          <table className="table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr><th>Período</th><th style={{ textAlign: 'right' }}>Remunerativo</th><th style={{ textAlign: 'right' }}>Deducciones</th><th style={{ textAlign: 'right' }}>Neto</th></tr>
            </thead>
            <tbody>
              {evolucion.slice().reverse().map((e) => (
                <tr key={e.periodo}>
                  <td style={{ fontWeight: 600 }}>{e.periodo}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMonto(e.remunerativo)}</td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtMonto(e.deducciones)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMonto(e.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
