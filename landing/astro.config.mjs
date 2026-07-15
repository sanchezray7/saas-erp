import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import netlify from '@astrojs/netlify'

export default defineConfig({
  site: 'https://saas-empresarial.com',
  output: 'server',
  adapter: netlify(),
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'es',
        locales: {
          es: 'es-ES',
          en: 'en-US',
          'pt-BR': 'pt-BR',
        },
      },
    }),
  ],
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en', 'pt-BR'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  build: {
    assets: '_assets',
  },
})
