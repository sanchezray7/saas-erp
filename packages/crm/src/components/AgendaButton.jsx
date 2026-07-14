import { useState } from 'react'
import { useAuth } from '@saas/core'
import { AgendaModal } from './AgendaModal'

export function AgendaButton() {
  const { roles } = useAuth()
  const [open, setOpen] = useState(false)

  const esAdminOVendedor = roles.some((r) => r === 'admin' || r === 'vendedor')
  if (!esAdminOVendedor) return null

  return (
    <>
      <button
        type="button"
        className="sidebar-action"
        onClick={() => setOpen(true)}
        title="Agenda del día"
        style={{ position: 'relative', fontSize: '1.1rem' }}
      >
        📋
      </button>

      {open && <AgendaModal onClose={() => setOpen(false)} />}
    </>
  )
}
