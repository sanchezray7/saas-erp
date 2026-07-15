import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AuthContext } from './context'
import { getSupabase } from '../lib/supabase'
import { rolesFromSession } from './rolesFromSession'
import { getPermissionsForRoles } from './permissions'
import { setLocaleFromPais } from '../i18n/index'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [companies, setCompanies] = useState([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [roles, setRoles] = useState([])
  const [permisos, setPermisos] = useState(new Set())
  const [activeCompanyId, setActiveCompanyId] = useState(() => localStorage.getItem('activeCompanyId'))
  const [companyPais, setCompanyPais] = useState(null)
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)
  const companiesGenRef = useRef(0)
  const fetchingPermsRef = useRef(false)

  const supabase = getSupabase()

  async function fetchCompaniesFromDB() {
    const { data, error } = await supabase.rpc('get_user_companies')
    if (error) {
      console.error('[fetchCompaniesFromDB] RPC error:', error)
      return
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('[fetchCompaniesFromDB] No companies for user')
      return
    }
    return data.map((c) => ({
      id: c.id,
      name: c.name ?? 'Empresa',
      role: c.role,
      plan: c.plan,
    }))
  }

  async function fetchPermissionsFromEF(companyId) {
    try {
      const { data, error } = await supabase.functions.invoke('get-user-permissions', {
        body: { company_id: companyId },
      })
      if (error) throw error
      return data?.permissions ?? null
    } catch (err) {
      console.warn('[fetchPermissions] EF falló, usa fallback local:', err.message)
      return null
    }
  }

  async function loadSession(currentSession) {
    setSession(currentSession)
    const currentUser = currentSession?.user ?? null
    setUser(currentUser)

    if (currentSession) {
      const { companies: jwtCompanies } = rolesFromSession(currentSession)

      if (jwtCompanies.length > 0) {
        setCompanies(jwtCompanies)
        setCompaniesLoading(false)
      } else if (currentUser) {
        try {
          setCompaniesLoading(true)
          const genAtStart = companiesGenRef.current
          const dbCompanies = await fetchCompaniesFromDB()
          if (genAtStart === companiesGenRef.current) {
            setCompanies(dbCompanies || [])
          }
        } finally {
          setCompaniesLoading(false)
        }
      }
    } else {
      setCompanies([])
      setCompaniesLoading(false)
      setRoles([])
      setPermisos(new Set())
    }
  }

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadSession(session).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      loadSession(session).catch(() => {})
    })

    return () => subscription?.unsubscribe()
  }, [])

  const effectiveCompanyId = useMemo(() => {
    if (!user || companies.length === 0) return null
    if (activeCompanyId && companies.some((c) => c.id === activeCompanyId)) return activeCompanyId
    if (companies.length === 1) return companies[0].id
    return null
  }, [user, companies, activeCompanyId])

  useEffect(() => {
    if (effectiveCompanyId) {
      localStorage.setItem('activeCompanyId', effectiveCompanyId)
      setActiveCompanyId(effectiveCompanyId)
    } else if (!user) {
      setActiveCompanyId(null)
    }
  }, [effectiveCompanyId, user])

  useEffect(() => {
    if (!effectiveCompanyId || !user) {
      setRoles([])
      setPermisos(new Set())
      return
    }

    if (fetchingPermsRef.current) return
    fetchingPermsRef.current = true

    const { rolesByCompany } = rolesFromSession(session)
    let userRoles = rolesByCompany[effectiveCompanyId] || []

    if (userRoles.length === 0) {
      const company = companies.find((c) => c.id === effectiveCompanyId)
      if (company?.role) userRoles = [company.role]
    }

    setRoles(userRoles)
    setPermisos(getPermissionsForRoles(userRoles))

    // Intenta permisos desde Edge Function (sobrescribe si llega)
    fetchPermissionsFromEF(effectiveCompanyId).then((perms) => {
      fetchingPermsRef.current = false
      if (perms && Array.isArray(perms)) {
        // Fusionar EF + permisos locales (para que nuevos permisos funcionen sin deploy EF)
        const merged = new Set([...perms, ...getPermissionsForRoles(userRoles)])
        setPermisos(merged)
      }
    })
  }, [effectiveCompanyId, user, session, companies])

  useEffect(() => {
    if (!effectiveCompanyId) { setCompanyPais(null); return }
    getSupabase()
      .from('companies')
      .select('pais')
      .eq('id', effectiveCompanyId)
      .single()
      .then(({ data }) => {
        if (data?.pais) {
          setCompanyPais(data.pais)
          setLocaleFromPais(data.pais)
        }
      })
      .catch(() => {})
  }, [effectiveCompanyId])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Propagar sesión inmediatamente (sin esperar onAuthStateChange)
    loadSession(data.session)
    return data
  }, [supabase])

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    loadSession(null)
    setActiveCompanyId(null)
    localStorage.removeItem('activeCompanyId')
  }, [supabase])

  const selectCompany = useCallback((id) => {
    setActiveCompanyId(id)
    localStorage.setItem('activeCompanyId', id)
  }, [])

  const createCompanyAndSelect = useCallback(async (name, userId) => {
    const { data: companyId, error } = await supabase.rpc('crear_empresa_crm', {
      empresa_nombre: name,
      p_user_id: userId || undefined,
    })
    if (error) throw error

    companiesGenRef.current += 1
    const newCompany = { id: companyId, name, role: 'admin' }
    setCompanies((prev) => [...prev, newCompany])
    setActiveCompanyId(companyId)
    localStorage.setItem('activeCompanyId', companyId)

    return companyId
  }, [supabase])

  const can = useCallback((permiso) => {
    return permisos.has(permiso)
  }, [permisos])

  return (
    <AuthContext.Provider value={{
      user, session, loading, companies, companiesLoading, roles, permisos,
      activeCompanyId: effectiveCompanyId, selectCompany, signIn, signUp, signOut, can,
      createCompanyAndSelect, pais: companyPais,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
