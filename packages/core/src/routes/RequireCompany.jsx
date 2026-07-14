import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function RequireCompany({ children, requireSelection }) {
  const { user, activeCompanyId, companies, companiesLoading, loading } = useAuth()

  if (loading || companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ padding: 40 }}>
        <div className="skeleton" style={{ width: 300, height: 200 }} />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!companies.length && !requireSelection) {
    return <Navigate to="/crear-empresa" replace />
  }

  if (!activeCompanyId && !requireSelection) {
    return <Navigate to="/seleccionar-empresa" replace />
  }

  return children
}
