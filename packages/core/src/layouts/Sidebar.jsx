import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/context'
import { useCompanyConfig } from '../theme/companyConfigContext'
import { Logo } from '../components/Logo'
import { NAV_TOPS, NAV_SECTIONS_BASE } from './navItems'

export function Sidebar({ open, onClose, extraSections = [], footerExtra, headerExtra }) {
  const { t, i18n } = useTranslation()
  const { companies, activeCompanyId, selectCompany, signOut, roles, can, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { config } = useCompanyConfig()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState({})

  const activeCompany = companies.find((c) => c.id === activeCompanyId)

  function isActive(path, end = false) {
    if (end) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <Logo size={24} fallback="📊" className="sidebar-logo-img" />
        <span className="sidebar-brand">{config.appName}</span>
        {headerExtra && <div style={{ marginLeft: 'auto' }}>{headerExtra}</div>}
      </div>

      <nav className="sidebar-nav">
        {NAV_TOPS.filter((item) => !item.permission || can(item.permission)).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`sidebar-link ${isActive(item.to, item.end) ? 'active' : ''}`}
            onClick={onClose}
          >
            <span>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}

        {[...extraSections, ...NAV_SECTIONS_BASE].map((section) => {
          const visible = section.items.filter((item) => !item.permission || can(item.permission))
          if (visible.length === 0) return null
          const isOpen = collapsed[section.sectionKey] === true

          return (
            <div key={section.sectionKey} className="sidebar-section">
              <button
                type="button"
                className="sidebar-section-toggle"
                onClick={() => setCollapsed((p) => ({ ...p, [section.sectionKey]: !isOpen }))}
              >
                <span>{section.icon}</span>
                <span>{section.labelKey ? t(section.labelKey) : (section.label || section.sectionKey)}</span>
                <span className="sidebar-chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
              </button>
              {isOpen && (
                <div className="sidebar-sub">
                  {visible.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`sidebar-link sidebar-link--sub ${isActive(item.to) ? 'active' : ''}`}
                      onClick={onClose}
                    >
                      <span>{item.icon}</span>
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-company">
            <span className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-sm" aria-hidden="true">
              {(user.user_metadata?.full_name || user.email)?.[0]?.toUpperCase() ?? '?'}
            </span>
            <div className="sidebar-company-info">
              <span className="sidebar-company-name">{user.user_metadata?.full_name || user.email}</span>
              <span className="sidebar-company-role">{roles.join(', ') || t('sidebar.sinRol')}</span>
            </div>
          </div>
        )}

        <div className="sidebar-actions">
          {footerExtra}
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="sidebar-lang"
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
            <option value="pt-BR">PT</option>
          </select>

          <button type="button" className="sidebar-action" onClick={toggleTheme} title={theme === 'dark' ? t('sidebar.temaClaro') : t('sidebar.temaOscuro')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {companies.length > 1 && (
          <Link to="/seleccionar-empresa" className="sidebar-link sidebar-link--action" onClick={onClose}>
            🔄 {t('sidebar.cambiarEmpresa')}
          </Link>
        )}

        <button type="button" className="sidebar-link sidebar-link--action" onClick={signOut}>
          🚪 {t('sidebar.cerrarSesion')}
        </button>
      </div>

      <style>{`
        .sidebar { width: 260px; height: 100vh; overflow-y: auto; background: var(--color-sidebar); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; z-index: 200; transition: transform 0.25s; }
        @media (max-width: 768px) { .sidebar { transform: translateX(-100%); } .sidebar.open { transform: translateX(0); } }
        .sidebar-header { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .sidebar-brand { font-weight: 700; font-size: 1rem; color: #ffffff; }
        .sidebar-nav { padding: 8px 0; }
        .sidebar-link { display: flex; align-items: center; gap: 10px; padding: 10px 20px; font-size: 0.88rem; font-weight: 500; color: #e8edf5; transition: background 0.15s; cursor: pointer; background: none; border: none; width: 100%; text-align: left; font-family: inherit; border-radius: 0; }
        .sidebar-link:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
        .sidebar-link.active { background: rgba(255,255,255,0.12); color: #60a5fa; }
        .sidebar-link--sub { padding-left: 52px; font-size: 0.84rem; }
        .sidebar-section-toggle { display: flex; align-items: center; gap: 10px; padding: 10px 20px; font-size: 0.78rem; font-weight: 600; color: #d1d9e6; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer; background: none; border: none; width: 100%; text-align: left; font-family: inherit; transition: color 0.15s; }
        .sidebar-section-toggle:hover { color: #ffffff; }
        .sidebar-chevron { margin-left: auto; font-size: 0.6rem; transition: transform 0.2s; }
        .sidebar-sub { margin: 2px 0; }
        .sidebar-footer { flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.08); padding: 12px 0; }
        .sidebar-company { display: flex; align-items: center; gap: 10px; padding: 8px 20px; }
        .sidebar-company-info { display: flex; flex-direction: column; min-width: 0; }
        .sidebar-company-name { font-size: 0.82rem; font-weight: 600; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar-company-role { font-size: 0.72rem; font-weight: 500; color: #d1d9e6; text-transform: capitalize; }
        .sidebar-actions { display: flex; align-items: center; gap: 6px; padding: 8px 20px; }
        .sidebar-lang { font-size: 0.72rem; font-weight: 600; background: transparent; color: #d1d9e6; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-family: inherit; transition: color 0.15s; }
        .sidebar-lang:hover { color: #ffffff; background: rgba(255,255,255,0.06); }
        .sidebar-action { background: none; border: none; cursor: pointer; font-size: 1rem; padding: 4px; border-radius: 6px; transition: background 0.15s; color: #d1d9e6; }
        .sidebar-action:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
        .sidebar-link--action { font-size: 0.82rem; font-weight: 500; color: #e8edf5; }
        .sidebar-link--action:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
      `}</style>
    </aside>
  )
}
