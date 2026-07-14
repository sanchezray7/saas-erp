import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './locales/es.json'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

const LOCALE_POR_PAIS = {
  PY: 'es', AR: 'es', CL: 'es', CO: 'es', PE: 'es',
  UY: 'es', BO: 'es', EC: 'es', VE: 'es', MX: 'es',
  BR: 'pt-BR',
}

export function setLocaleFromPais(pais) {
  const lng = LOCALE_POR_PAIS[pais]
  if (!lng) return
  // Solo cambiar si el usuario no eligió manualmente
  const manual = localStorage.getItem('i18nextLng')
  if (!manual || manual === i18n.language) {
    i18n.changeLanguage(lng)
    if (!manual) localStorage.setItem('i18nextLng', lng)
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      'pt-BR': { translation: ptBR },
    },
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
