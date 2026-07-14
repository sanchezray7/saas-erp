import { useId } from 'react'

export function FormField({
  label,
  id,
  error,
  hint,
  as = 'input',
  ...controlProps
}) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined

  const a11yProps = {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }

  const messages = (
    <>
      {hint && <p id={hintId} className="frm-hint">{hint}</p>}
      {error && <p id={errorId} className="frm-error" role="alert">{error}</p>}
    </>
  )

  const Tag = as === 'textarea' ? 'textarea' : as === 'select' ? 'select' : 'input'

  return (
    <div className="frm">
      {label && <label htmlFor={fieldId} className="frm-label">{label}</label>}
      <Tag id={fieldId} className="frm-input" {...a11yProps} {...controlProps}>
        {as === 'select' ? controlProps.children : null}
      </Tag>
      {messages}
    </div>
  )
}
