export function resolveTemplate(text, variables) {
  return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const keys = key.split('.')
    let val = variables
    for (const k of keys) {
      if (val == null || typeof val !== 'object') return `{{${key}}}`
      val = val[k]
    }
    return val != null ? val : `{{${key}}}`
  })
}

export const CONTEXT_VARIABLES = {
  contact: [
    { key: 'contacto.nombre', desc: 'Nombre del contacto' },
    { key: 'contacto.email', desc: 'Email del contacto' },
    { key: 'contacto.telefono', desc: 'Teléfono del contacto' },
    { key: 'contacto.cargo', desc: 'Cargo del contacto' },
    { key: 'contacto.empresa', desc: 'Empresa del contacto' },
    { key: 'usuario.nombre', desc: 'Tu nombre (vendedor)' },
    { key: 'usuario.email', desc: 'Tu email' },
    { key: 'usuario.telefono', desc: 'Tu teléfono' },
    { key: 'empresa.nombre', desc: 'Nombre de tu empresa' },
  ],
  deal: [
    { key: 'deal.titulo', desc: 'Título de la oportunidad' },
    { key: 'deal.valor', desc: 'Valor de la oportunidad' },
    { key: 'deal.etapa', desc: 'Etapa actual' },
    { key: 'deal.fecha_cierre', desc: 'Fecha de cierre estimada' },
    { key: 'contacto.nombre', desc: 'Nombre del contacto' },
    { key: 'contacto.email', desc: 'Email del contacto' },
    { key: 'contacto.empresa', desc: 'Empresa del contacto' },
    { key: 'usuario.nombre', desc: 'Tu nombre (vendedor)' },
    { key: 'usuario.email', desc: 'Tu email' },
    { key: 'usuario.telefono', desc: 'Tu teléfono' },
    { key: 'empresa.nombre', desc: 'Nombre de tu empresa' },
  ],
  lead: [
    { key: 'lead.nombre', desc: 'Nombre del lead' },
    { key: 'lead.email', desc: 'Email del lead' },
    { key: 'lead.telefono', desc: 'Teléfono del lead' },
    { key: 'lead.mensaje', desc: 'Mensaje del lead' },
    { key: 'empresa.nombre', desc: 'Nombre de tu empresa' },
    { key: 'usuario.nombre', desc: 'Tu nombre (vendedor)' },
    { key: 'usuario.email', desc: 'Tu email' },
    { key: 'usuario.telefono', desc: 'Tu teléfono' },
  ],
  whatsapp: [
    { key: 'contacto.nombre', desc: 'Nombre del contacto' },
    { key: 'contacto.email', desc: 'Email del contacto' },
    { key: 'contacto.telefono', desc: 'Teléfono del contacto' },
    { key: 'contacto.empresa', desc: 'Empresa del contacto' },
    { key: 'usuario.nombre', desc: 'Tu nombre (vendedor)' },
    { key: 'usuario.email', desc: 'Tu email' },
    { key: 'usuario.telefono', desc: 'Tu teléfono' },
    { key: 'empresa.nombre', desc: 'Nombre de tu empresa' },
    { key: 'cotizacion.numero', desc: 'Número de cotización' },
    { key: 'cotizacion.total', desc: 'Total de cotización' },
    { key: 'cotizacion.link', desc: 'Link público de cotización' },
    { key: 'deal.titulo', desc: 'Título de la oportunidad' },
    { key: 'deal.valor', desc: 'Valor de la oportunidad' },
  ],
}

export const CONTEXT_OPTIONS = [
  { value: 'contact', label: 'Contacto' },
  { value: 'deal', label: 'Oportunidad' },
  { value: 'lead', label: 'Lead (webhook)' },
  { value: 'whatsapp', label: 'WhatsApp' },
]
