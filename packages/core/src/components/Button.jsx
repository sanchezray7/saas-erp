import { forwardRef } from 'react'

const variants = {
  primary: 'btn--primary',
  ghost: 'btn--ghost',
  outline: 'btn--outline',
}

const sizes = {
  xs: 'btn--xs',
  sm: 'btn--sm',
  md: 'btn--md',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size, danger = false, type = 'button', className = '', children, ...rest },
  ref,
) {
  const classes = [
    'btn',
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    danger && 'btn--danger',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {children}
    </button>
  )
})
