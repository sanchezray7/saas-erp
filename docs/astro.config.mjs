import { defineConfig } from 'astro/config'
import netlify from '@astrojs/netlify'

export default defineConfig({
  site: 'https://docs.saas-empresarial.com',
  output: 'server',
  adapter: netlify(),
})
