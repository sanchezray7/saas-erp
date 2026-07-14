import { Button } from './Button'

export function ConfirmModal({ title, message, onConfirm, onCancel, confirmText, loading }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button danger onClick={onConfirm} disabled={loading}>
            {loading ? '...' : (confirmText || 'Confirmar')}
          </Button>
        </div>
      </div>
      <style>{`
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: var(--color-surface); border-radius: var(--radius-lg); padding: 28px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .modal-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text); }
        .modal-message { font-size: 0.9rem; color: var(--color-text-soft); margin-bottom: 24px; line-height: 1.5; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
      `}</style>
    </div>
  )
}
