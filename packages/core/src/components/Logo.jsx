import { useCompanyConfig } from '../theme/companyConfigContext'

export function Logo({ size = 40, fallback = '📊', className = '', style: inlineStyle }) {
  const { config } = useCompanyConfig()
  const url = config.logoUrl
  const s = { width: size, height: size, ...inlineStyle }

  if (url) {
    return (
      <img
        src={url}
        alt={config.appName || 'Logo'}
        className={className}
        style={{ ...s, objectFit: 'contain' }}
      />
    )
  }

  return (
    <span
      className={className}
      role="img"
      aria-label={config.appName || 'Logo'}
      style={{
        ...s,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.55,
      }}
    >
      {fallback}
    </span>
  )
}
