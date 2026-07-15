import { useAuth } from '../auth/useAuth'
import { usePlan } from '../data/plan'
import { UpgradeBanner } from '../components/UpgradeBanner'

export function RequireFeature({ featureKey, children }) {
  const { activeCompanyId } = useAuth()
  const { featureEnabled, loading } = usePlan({ companyId: activeCompanyId })

  if (loading) return null

  if (!featureEnabled(featureKey)) {
    return (
      <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
        <UpgradeBanner featureKey={featureKey} />
      </div>
    )
  }

  return children
}
