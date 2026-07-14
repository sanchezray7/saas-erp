function decodeJwtClaims(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(payload)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function rolesFromSession(session) {
  if (!session?.user) return { rolesByCompany: {}, companies: [] }

  // Primero intenta leer del JWT directo (Custom Access Token Hook)
  const claims = decodeJwtClaims(session.access_token)
  const jwtCompanies = claims?.companies
  const jwtRoles = claims?.roles_by_company

  if (Array.isArray(jwtCompanies)) {
    return {
      companies: jwtCompanies.map((c) => ({ id: c.id, name: c.name })),
      rolesByCompany: jwtRoles || {},
    }
  }

  // Fallback a app_metadata
  const meta = session.user.app_metadata || {}
  const rolesByCompany = meta.roles_by_company || {}
  const companies = []

  if (meta.companies) {
    for (const c of meta.companies) {
      companies.push({ id: c.id, name: c.name })
    }
  }

  return { rolesByCompany, companies }
}
