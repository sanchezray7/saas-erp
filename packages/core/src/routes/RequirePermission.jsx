import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function RequirePermission({ perform, perm, children }) {
  const { can } = useAuth()
  const required = perform ?? perm

  if (!can(required)) {
    return <Navigate to="/403" replace />
  }

  return children
}
