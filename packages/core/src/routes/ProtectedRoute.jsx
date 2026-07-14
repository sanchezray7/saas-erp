import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ padding: 40 }}>
        <div className="skeleton" style={{ width: 300, height: 200 }} />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}
