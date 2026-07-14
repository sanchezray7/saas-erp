import { useAuth } from '../auth/useAuth'

export function Can({ perform, fallback = null, children }) {
  const { can } = useAuth()
  if (!can(perform)) return fallback
  return children
}
