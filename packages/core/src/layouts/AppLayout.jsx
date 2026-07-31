import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCompanyConfig } from '../theme/companyConfigContext'
import { Logo } from '../components/Logo'
import { AssistantWidget } from '../components/AssistantWidget'
import { CompanyConfigProvider } from '../theme/CompanyConfigProvider'
import { Sidebar } from './Sidebar'
import { PlanOutlet } from './PlanOutlet'

function LayoutInner({ extraSections = [], footerExtra, headerExtra }) {
  const { t } = useTranslation()
  const { config } = useCompanyConfig()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} extraSections={extraSections} footerExtra={footerExtra} headerExtra={headerExtra} />

      <div className="app-content">
        <header className="app-header">
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menú"
          >
            ☰
          </button>
          <Logo size={20} fallback="📊" className="flex-shrink-0" />
          <span className="font-bold text-text">{config.appName}</span>
        </header>
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <main className="app-main">
          <PlanOutlet />
        </main>
      </div>

      <AssistantWidget />

      <style>{`
        .app-content { margin-left: 260px; flex: 1; min-height: 100vh; display: flex; flex-direction: column; }
        @media (max-width: 768px) { .app-content { margin-left: 0; } }
        .app-header { display: none; padding: 12px 16px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); align-items: center; gap: 10px; }
        @media (max-width: 768px) { .app-header { display: flex; position: sticky; top: 0; z-index: 100; } }
        .hamburger-btn { background: none; border: none; cursor: pointer; font-size: 1.3rem; padding: 4px; color: var(--color-text); }
        .app-main { flex: 1; padding: 28px; max-width: 960px; width: 100%; margin: 0 auto; }
        @media (max-width: 768px) { .app-main { padding: 16px; } }
        .sidebar-overlay { display: none; }
        @media (max-width: 768px) { .sidebar-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 150; } }
      `}</style>
    </div>
  )
}

export function AppLayout({ extraSections = [], footerExtra, headerExtra }) {
  return (
    <CompanyConfigProvider>
      <LayoutInner extraSections={extraSections} footerExtra={footerExtra} headerExtra={headerExtra} />
    </CompanyConfigProvider>
  )
}
