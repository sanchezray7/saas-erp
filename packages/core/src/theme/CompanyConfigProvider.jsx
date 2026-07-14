import { useState, useEffect, useCallback, useRef } from 'react'
import { CompanyConfigContext, DEFAULT_CONFIG } from './companyConfigContext'
import { getSupabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

export function CompanyConfigProvider({ children }) {
  const { activeCompanyId } = useAuth()
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const styleRef = useRef(null)

  // Cargar config desde DB cuando cambia la empresa activa
  useEffect(() => {
    if (!activeCompanyId) {
      setConfig(DEFAULT_CONFIG)
      return
    }

    const supabase = getSupabase()
    supabase
      .from('company_config')
      .select('*')
      .eq('company_id', activeCompanyId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return
        setConfig({
          logoUrl: data.logo_url || null,
          appName: data.app_name || 'CRM',
          primaryColor: data.primary_color || '#2c7be5',
          faviconUrl: data.favicon_url || null,
        })
      })
  }, [activeCompanyId])

  // Inyectar CSS dinámico con el color primario de la empresa
  useEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style')
      styleRef.current.setAttribute('id', 'company-colors')
      document.head.appendChild(styleRef.current)
    }
    styleRef.current.textContent = `
      :root {
        --color-accent: ${config.primaryColor};
        --color-accent-hover: ${config.primaryColor}dd;
        --color-accent-soft: ${config.primaryColor}1f;
        --color-accent-ring: ${config.primaryColor}2e;
      }
    `
  }, [config.primaryColor])

  // Actualizar favicon
  useEffect(() => {
    if (!config.faviconUrl) return
    const link = document.querySelector('link[rel="icon"]')
    if (link) link.href = config.faviconUrl
  }, [config.faviconUrl])

  // Actualizar title cuando cambia appName
  useEffect(() => {
    document.title = config.appName || 'CRM'
  }, [config.appName])

  return (
    <CompanyConfigContext.Provider value={{ config }}>
      {children}
    </CompanyConfigContext.Provider>
  )
}
