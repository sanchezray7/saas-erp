import { useState } from 'react'
import { HELP } from '../data/helpContent'

function renderTexto(texto) {
  return texto
    .split('\n')
    .map((line) => {
      if (line.startsWith('**')) return line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return line
    })
    .join('<br/>')
}

function parseLine(line) {
  const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  return bold
}

export function HelpPage() {
  const sections = Object.entries(HELP)
  const [active, setActive] = useState(sections[0]?.[0] || null)

  const section = HELP[active]

  return (
    <div className="card" style={{ padding: 0, display: 'flex', minHeight: 'calc(100vh - 200px)' }}>
      {/* Sidebar de navegación */}
      <div style={{
        width: 220, borderRight: '1px solid var(--border)', flexShrink: 0,
        overflowY: 'auto', padding: '12px 0',
      }}>
        {sections.map(([key, s]) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 16px', border: 'none',
              background: active === key ? 'var(--bg-alt)' : 'transparent',
              color: 'var(--text)', cursor: 'pointer', fontSize: '0.88rem',
              fontWeight: active === key ? 600 : 400, textAlign: 'left',
            }}
          >
            <span>{s.icon}</span>
            <span>{s.titulo}</span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: 720 }}>
        {section && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: '2rem' }}>{section.icon}</span>
              <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{section.titulo}</h1>
            </div>
            <p className="meta" style={{ marginBottom: 24 }}>{section.descripcion}</p>

            {section.modulos.map((modulo, idx) => (
              <div key={idx} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>{modulo.titulo}</h2>
                <p className="meta" style={{ marginBottom: 12 }}>{modulo.descripcion}</p>

                {/* Pasos */}
                {modulo.pasos && (
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>Pasos:</h4>
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {modulo.pasos.map((paso, i) => (
                        <li key={i} style={{ fontSize: '0.88rem', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: parseLine(paso) }} />
                      ))}
                    </ol>
                  </div>
                )}

                {/* Estados */}
                {modulo.estados && (
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>Estados:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {modulo.estados.map((est, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.88rem' }}>
                          <span style={{ fontWeight: 600, minWidth: 120 }}>{est.nombre}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{est.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {modulo.tips && (
                  <div style={{
                    background: '#fef3c7', border: '1px solid #f59e0b',
                    borderRadius: 8, padding: '12px 16px', marginBottom: 12,
                  }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: '#92400e' }}>💡 Tips</h4>
                    <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {modulo.tips.map((tip, i) => (
                        <li key={i} style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: 1.5 }}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Acciones */}
                {modulo.acciones && (
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>Acciones:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {modulo.acciones.map((acc, i) => (
                        <div key={i} style={{ fontSize: '0.88rem' }}>
                          <strong>{acc.label}:</strong> {acc.desc}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
