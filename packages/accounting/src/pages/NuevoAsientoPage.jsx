import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, Button, Skeleton, FormField, formatMoney, alertError, notify, getSupabase } from '@saas/core'
import { listarAccounts } from '../data/accounts'

export function NuevoAsientoPage() {
  const navigate = useNavigate()
  const { activeCompanyId, can } = useAuth()
  const supabase = getSupabase()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [entryNumber, setEntryNumber] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [descripcion, setDescripcion] = useState('')
  const [accounts, setAccounts] = useState([])
  const [lines, setLines] = useState([{ account_id: '', description: '', debit: 0, credit: 0 }])

  useEffect(() => {
    Promise.all([
      supabase.rpc('generar_numero_asiento', { p_company_id: activeCompanyId }).then(({ data }) => setEntryNumber(data || fallbackNumero())).catch(() => setEntryNumber(fallbackNumero())),
      listarAccounts(activeCompanyId).then(setAccounts),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [activeCompanyId, supabase])

  function fallbackNumero() {
    const now = new Date()
    const d = now.toISOString().slice(0, 10).replace(/-/g, '')
    return `AS-${d}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`
  }

  function updateLine(idx, field, value) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  function addLine() {
    setLines((prev) => [...prev, { account_id: '', description: '', debit: 0, credit: 0 }])
  }

  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01
  const hasEmpty = lines.some((l) => !l.account_id || (Number(l.debit) <= 0 && Number(l.credit) <= 0))

  async function handleSubmit(estado = 'contabilizado') {
    if (!descripcion.trim()) { alertError('Error', 'Descripción requerida'); return }
    if (!balanced) { alertError('Error', 'El asiento no está cuadrado (débitos ≠ créditos)'); return }
    if (hasEmpty) { alertError('Error', 'Completá todas las líneas'); return }

    setSubmitting(true)
    try {
      // Crear asiento
      const { data: entry, error: err1 } = await supabase
        .from('journal_entries')
        .insert({
          company_id: activeCompanyId,
          entry_number: entryNumber,
          entry_date: fecha,
          description: descripcion,
          source_type: 'manual',
          total_debit: totalDebit,
          total_credit: totalCredit,
          estado,
        })
        .select('id')
        .single()
      if (err1) throw err1

      // Insertar líneas
      const linesPayload = lines.map((l) => ({
        journal_entry_id: entry.id,
        account_id: l.account_id,
        description: l.description || null,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))
      const { error: err2 } = await supabase.from('journal_entry_lines').insert(linesPayload)
      if (err2) throw err2

      notify(`Asiento ${entryNumber} ${estado === 'contabilizado' ? 'contabilizado' : 'guardado como borrador'}`)
      navigate(`/asientos/${entry.id}`)
    } catch (err) { alertError('Error', err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return <Skeleton.Card />

  return (
    <div className="card">
      <div className="page-header">
        <h1>📒 Nuevo Asiento Manual</h1>
        <Link to="/asientos"><Button variant="ghost" size="sm">Volver</Button></Link>
      </div>

      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="N° Asiento" value={entryNumber} disabled />
          <FormField label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <FormField label="Descripción" required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Pago de alquiler junio 2026" />

        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '8px 0 0' }}>Líneas</h3>

        <div className="items-table-desktop">
          <table className="table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Cuenta</th>
                <th style={{ width: '30%' }}>Descripción</th>
                <th style={{ width: 120, textAlign: 'right' }}>Débito</th>
                <th style={{ width: 120, textAlign: 'right' }}>Crédito</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td>
                    <select className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={line.account_id} onChange={(e) => updateLine(idx, 'account_id', e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                    </select>
                  </td>
                  <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%' }} value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} placeholder="Detalle" /></td>
                  <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%', textAlign: 'right' }} type="number" min="0" step="1" value={line.debit} onChange={(e) => updateLine(idx, 'debit', e.target.value)} /></td>
                  <td><input className="form-input" style={{ fontSize: '0.82rem', padding: '4px 8px', width: '100%', textAlign: 'right' }} type="number" min="0" step="1" value={line.credit} onChange={(e) => updateLine(idx, 'credit', e.target.value)} /></td>
                  <td>{lines.length > 1 && <button type="button" onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="items-table-mobile">
          {lines.map((line, idx) => (
            <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.82rem' }}>Línea {idx + 1}</strong>
                {lines.length > 1 && <button type="button" onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>}
              </div>
              <select className="form-input" style={{ fontSize: '0.82rem' }} value={line.account_id} onChange={(e) => updateLine(idx, 'account_id', e.target.value)}>
                <option value="">— Cuenta —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
              <input className="form-input" style={{ fontSize: '0.82rem' }} value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} placeholder="Detalle" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="form-input" style={{ fontSize: '0.82rem' }} type="number" min="0" step="1" value={line.debit} onChange={(e) => updateLine(idx, 'debit', e.target.value)} placeholder="Débito" />
                <input className="form-input" style={{ fontSize: '0.82rem' }} type="number" min="0" step="1" value={line.credit} onChange={(e) => updateLine(idx, 'credit', e.target.value)} placeholder="Crédito" />
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={addLine}>+ Agregar línea</Button>

        <div style={{ textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          <div style={{ fontSize: '0.9rem' }}>Total Débito: <strong>{formatMoney(totalDebit, 'PYG')}</strong></div>
          <div style={{ fontSize: '0.9rem' }}>Total Crédito: <strong>{formatMoney(totalCredit, 'PYG')}</strong></div>
          <div style={{ fontSize: '0.9rem', color: balanced ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
            {balanced ? '✅ Cuadrado' : '❌ Descadrado por ' + formatMoney(Math.abs(totalDebit - totalCredit), 'PYG')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" onClick={() => handleSubmit('borrador')} disabled={submitting || !balanced || hasEmpty || !descripcion.trim()}>
            {submitting ? 'Guardando...' : '💾 Guardar borrador'}
          </Button>
          <Button type="button" onClick={() => handleSubmit('contabilizado')} disabled={submitting || !balanced || hasEmpty || !descripcion.trim()}>
            {submitting ? 'Guardando...' : '✅ Contabilizar'}
          </Button>
          <Link to="/asientos"><Button variant="ghost">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
