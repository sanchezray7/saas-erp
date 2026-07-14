import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: 24,
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 400,
        width: '100%',
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--color-danger-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 24px',
        }}>
          🔒
        </div>

        <div style={{
          fontSize: '4rem',
          fontWeight: 800,
          lineHeight: 1,
          color: 'var(--color-text)',
          marginBottom: 8,
          letterSpacing: '-0.03em',
        }}>
          403
        </div>

        <h1 style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: 'var(--color-text)',
          margin: '0 0 8px',
        }}>
          {t('forbidden.titulo')}
        </h1>

        <p style={{
          fontSize: '0.88rem',
          color: 'var(--color-text-soft)',
          margin: '0 0 32px',
          lineHeight: 1.5,
        }}>
          {t('forbidden.descripcion')}
        </p>

        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.88rem',
            fontWeight: 600,
            padding: '10px 24px',
            borderRadius: 'var(--radius)',
            background: 'var(--color-accent)',
            color: '#fff',
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
        >
          ← {t('forbidden.volver')}
        </Link>
      </div>
    </div>
  )
}
