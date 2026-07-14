import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-page">
          <div className="auth-card">
            <h1 className="auth-title">Error inesperado</h1>
            <p className="auth-subtitle" style={{ color: 'var(--color-danger)' }}>
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <pre style={{ fontSize: 12, marginTop: 16, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', background: 'var(--color-surface-alt)', padding: 12, borderRadius: 6 }}>
              {this.state.error?.stack}
            </pre>
            <button
              className="btn btn--primary btn--md"
              style={{ marginTop: 20, width: '100%' }}
              onClick={() => window.location.href = '/'}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
