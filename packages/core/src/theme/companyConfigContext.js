import { createContext, useContext } from 'react'

const DEFAULT_CONFIG = {
  logoUrl: null,
  appName: 'ERP',
  primaryColor: '#2c7be5',
  faviconUrl: null,
}

export const CompanyConfigContext = createContext({ config: DEFAULT_CONFIG })

export function useCompanyConfig() {
  return useContext(CompanyConfigContext)
}

export { DEFAULT_CONFIG }
