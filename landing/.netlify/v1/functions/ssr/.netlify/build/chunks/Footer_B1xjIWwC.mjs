import { c as createAstro, d as createComponent, m as maybeRenderHead, j as renderScript, r as renderTemplate, i as renderComponent, k as renderSlot, l as renderHead, f as addAttribute } from './astro/server_28ksw8Eg.mjs';
import 'piccolore';
/* empty css                         */
import 'clsx';

const $$Astro$3 = createAstro("https://saas-empresarial.com");
const $$CookieBanner = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$CookieBanner;
  const { locale = "es" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div class="cookie-banner" id="cookieBanner"> <p>${locale === "es" ? "Usamos cookies para mejorar tu experiencia. Al continuar navegando acept\xE1s nuestra pol\xEDtica de cookies." : locale === "en" ? "We use cookies to improve your experience. By continuing you accept our cookie policy." : "Usamos cookies para melhorar sua experi\xEAncia. Ao continuar navegando voc\xEA aceita nossa pol\xEDtica de cookies."}</p> <button id="cookieAccept" class="btn btn-primary btn-sm"> ${locale === "es" ? "Aceptar" : locale === "en" ? "Accept" : "Aceitar"} </button> </div> ${renderScript($$result, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/CookieBanner.astro?astro&type=script&index=0&lang.ts")} `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/CookieBanner.astro", void 0);

function t(locale, path) {
  const keys = path.split('.');
  let obj = TRADUCCIONES[locale] || TRADUCCIONES.es;
  for (const key of keys) {
    obj = obj?.[key];
    if (obj === undefined) return path
  }
  return obj ?? path
}

const TRADUCCIONES = {
  es: {
    meta: {
      title: 'Saas Empresarial — ERP todo-en-uno para empresas',
      description: 'Sistema ERP completo con CRM, facturación electrónica, inventario, contabilidad, RRHH y nómina. Todo en un solo lugar.',
      ogDescription: 'ERP integral para empresas en Latinoamérica',
    },
    nav: {
      productos: 'Módulos',
      precios: 'Precios',
      faq: 'FAQ',
      contacto: 'Contacto',
      iniciarSesion: 'Iniciar sesión',
      registrar: 'Comenzar gratis',
    },
    hero: {
      titulo: 'El ERP que tu empresa necesita',
      subtitulo: 'Administrá tu negocio desde un solo lugar: CRM, facturación, inventario, contabilidad, RRHH y nómina. Diseñado para empresas en Latinoamérica.',
      cta: 'Comenzar gratis',
      demo: 'Ver módulos',
    },
    features: {
      titulo: 'Todo lo que necesitás en un solo sistema',
      subtitulo: 'Nueve módulos integrados que cubren cada área de tu empresa',
      items: [
        { icon: '📦', titulo: 'Catálogo', desc: 'Gestioná productos y servicios con precios, impuestos y múltiples unidades de medida.' },
        { icon: '👥', titulo: 'CRM', desc: 'Administrá contactos, oportunidades, cotizaciones y pipelines de ventas.' },
        { icon: '🧾', titulo: 'Facturación', desc: 'Emití facturas electrónicas, notas de crédito y débito con SIFEN/e-kuatia.' },
        { icon: '🏭', titulo: 'Proveedores', desc: 'Gestioná órdenes de compra, facturas de proveedor y scorecards.' },
        { icon: '📊', titulo: 'Inventario', desc: 'Controlá stock, transferencias, conteos cíclicos y kardex.' },
        { icon: '💰', titulo: 'Contabilidad', desc: 'Plan de cuentas, asientos automáticos, impuestos y reportes.' },
        { icon: '👔', titulo: 'RRHH', desc: 'Empleados, asistencia, vacaciones, ausencias y control horario.' },
        { icon: '📋', titulo: 'Nómina', desc: 'Liquidación de sueldos, recibos, libro de sueldos digital y asientos contables.' },
        { icon: '💬', titulo: 'WhatsApp', desc: 'Enviá mensajes y notificaciones desde el sistema vía Twilio.' },
      ],
    },
    testimonios: {
      titulo: 'Lo que dicen nuestros clientes',
      subtitulo: 'Empresas que ya confían en Saas Empresarial',
      items: [
        { nombre: 'Carlos Méndez', cargo: 'CEO', empresa: 'Distribuidora XYZ', texto: 'Pasamos de Excel a Saas Empresarial y centralizamos toda la operación. La facturación electrónica y la nómina nos ahorran horas cada semana.' },
        { nombre: 'María González', cargo: 'Gerente de Administración', empresa: 'Grupo Comercial del Sur', texto: 'Tener CRM, inventario y contabilidad integrados nos permite tomar decisiones en tiempo real. El soporte es excelente.' },
        { nombre: 'Juan Pérez', cargo: 'Director Financiero', empresa: 'Servicios Generales SA', texto: 'Implementamos la nómina con la legislación paraguaya. El cálculo automático de IPS y aguinaldo nos quitó un peso de encima.' },
      ],
    },
    pricing: {
      titulo: 'Planes simples y transparentes',
      subtitulo: 'Elegí el plan que mejor se adapte a tu empresa. Sin sorpresas.',
      free: {
        nombre: 'Free',
        desc: 'Para empezar',
        precio: 'Gratis',
        period: '',
        features: ['Hasta 2 usuarios', 'CRM completo', 'Catálogo de productos', 'Facturación electrónica', 'Soporte por email'],
      },
      starter: {
        nombre: 'Starter',
        desc: 'Para pequeñas empresas',
        precio: '$29',
        period: '/mes',
        features: ['Hasta 10 usuarios', 'Todo Free +', 'Inventario + almacenes', 'Órdenes de compra', 'Contabilidad básica', 'Soporte prioritario'],
      },
      business: {
        nombre: 'Business',
        desc: 'Para empresas en crecimiento',
        precio: '$79',
        period: '/mes',
        features: ['Usuarios ilimitados', 'Todo Starter +', 'RRHH completo', 'Nómina + libro de sueldos', 'Reportes avanzados', 'Asientos automáticos', 'Soporte dedicado 24/7'],
      },
    },
    faq: {
      titulo: 'Preguntas frecuentes',
      items: [
        { p: '¿Qué es Saas Empresarial?', r: 'Es un sistema ERP completo en la nube que integra CRM, facturación electrónica, inventario, contabilidad, RRHH y nómina en una sola plataforma.' },
        { p: '¿Necesito instalar algo?', r: 'No. Saas Empresarial funciona completamente en tu navegador web. Solo necesitás internet para acceder.' },
        { p: '¿Soporta la legislación paraguaya?', r: 'Sí. La facturación electrónica está diseñada para SIFEN/e-kuatia. La nómina calcula automáticamente IPS, IPS Patronal, aguinaldo y cumple con la legislación laboral de Paraguay.' },
        { p: '¿Puedo probarlo gratis?', r: 'Sí. El plan Free es completamente gratuito sin límite de tiempo. Incluye CRM, catálogo y facturación.' },
        { p: '¿Cómo migro mis datos?', r: 'Todos los módulos tienen importación por CSV/Excel. Podés cargar tus productos, contactos, empleados y demás datos desde tu sistema anterior.' },
        { p: '¿Ofrecen soporte?', r: 'Todos los planes incluyen soporte por email. Los planes Starter y Business tienen soporte prioritario y dedicado respectivamente.' },
      ],
    },
    footer: {
      producto: 'Producto',
      modulos: 'Módulos',
      precios: 'Precios',
      acceso: 'Acceso',
      iniciarSesion: 'Iniciar sesión',
      registrar: 'Registrarse',
      legal: 'Legal',
      privacidad: 'Privacidad',
      terminos: 'Términos del servicio',
      copyright: '© 2026 Saas Empresarial. Todos los derechos reservados.',
    },
    cookie: {
      texto: 'Usamos cookies para mejorar tu experiencia. Al continuar navegando aceptás nuestra política de cookies.',
      aceptar: 'Aceptar',
    },
    contacto: {
      titulo: 'Contactanos',
      subtitulo: 'Escribinos y te respondemos a la brevedad',
      nombre: 'Nombre',
      email: 'Correo electrónico',
      mensaje: 'Mensaje',
      enviar: 'Enviar',
      gracias: '¡Gracias! Te contactaremos pronto.',
    },
    terminos: {
      titulo: 'Términos del servicio',
      contenido: 'Al utilizar Saas Empresarial aceptás estos términos. El servicio se brinda "tal cual" y nos comprometemos a mantener la disponibilidad y seguridad de tus datos. No está permitido usar la plataforma para actividades ilícitas.',
    },
    privacidad: {
      titulo: 'Política de privacidad',
      contenido: 'En Saas Empresarial nos tomamos tu privacidad en serio. Los datos que almacenás en la plataforma son tuyos. No compartimos información personal con terceros sin tu consentimiento explícito.',
    },
  },

  en: {
    meta: {
      title: 'Saas Empresarial — All-in-one ERP for businesses',
      description: 'Complete ERP system with CRM, e-invoicing, inventory, accounting, HR and payroll. All in one place.',
      ogDescription: 'All-in-one ERP for Latin American businesses',
    },
    nav: {
      productos: 'Modules',
      precios: 'Pricing',
      faq: 'FAQ',
      contacto: 'Contact',
      iniciarSesion: 'Log in',
      registrar: 'Start free',
    },
    hero: {
      titulo: 'The ERP your business needs',
      subtitulo: 'Manage your business from one place: CRM, invoicing, inventory, accounting, HR and payroll. Designed for Latin American businesses.',
      cta: 'Start free',
      demo: 'View modules',
    },
    features: {
      titulo: 'Everything you need in one system',
      subtitulo: 'Nine integrated modules covering every area of your business',
      items: [
        { icon: '📦', titulo: 'Catalog', desc: 'Manage products and services with prices, taxes and multiple units.' },
        { icon: '👥', titulo: 'CRM', desc: 'Manage contacts, deals, quotes and sales pipelines.' },
        { icon: '🧾', titulo: 'Invoicing', desc: 'Issue electronic invoices, credit and debit notes with SIFEN/e-kuatia.' },
        { icon: '🏭', titulo: 'Procurement', desc: 'Manage purchase orders, supplier invoices and scorecards.' },
        { icon: '📊', titulo: 'Inventory', desc: 'Track stock, transfers, cycle counts and kardex.' },
        { icon: '💰', titulo: 'Accounting', desc: 'Chart of accounts, automatic entries, taxes and reports.' },
        { icon: '👔', titulo: 'HR', desc: 'Employees, attendance, vacations, absences and time control.' },
        { icon: '📋', titulo: 'Payroll', desc: 'Payroll calculation, receipts, digital payroll book and accounting entries.' },
        { icon: '💬', titulo: 'WhatsApp', desc: 'Send messages and notifications from the system via Twilio.' },
      ],
    },
    testimonios: {
      titulo: 'What our clients say',
      subtitulo: 'Businesses that trust Saas Empresarial',
      items: [
        { nombre: 'Carlos Méndez', cargo: 'CEO', empresa: 'Distribuidora XYZ', texto: 'We moved from Excel to Saas Empresarial and centralized our entire operation. E-invoicing and payroll save us hours every week.' },
        { nombre: 'María González', cargo: 'Admin Manager', empresa: 'Grupo Comercial del Sur', texto: 'Having CRM, inventory and accounting integrated lets us make decisions in real time. The support is excellent.' },
        { nombre: 'Juan Pérez', cargo: 'CFO', empresa: 'Servicios Generales SA', texto: 'We implemented payroll with Paraguayan legislation. Automatic IPS and aguinaldo calculation took a huge weight off our shoulders.' },
      ],
    },
    pricing: {
      titulo: 'Simple and transparent plans',
      subtitulo: 'Choose the plan that fits your business. No surprises.',
      free: {
        nombre: 'Free',
        desc: 'To get started',
        precio: 'Free',
        period: '',
        features: ['Up to 2 users', 'Full CRM', 'Product catalog', 'E-invoicing', 'Email support'],
      },
      starter: {
        nombre: 'Starter',
        desc: 'For small businesses',
        precio: '$29',
        period: '/mo',
        features: ['Up to 10 users', 'Everything Free +', 'Inventory + warehouses', 'Purchase orders', 'Basic accounting', 'Priority support'],
      },
      business: {
        nombre: 'Business',
        desc: 'For growing businesses',
        precio: '$79',
        period: '/mo',
        features: ['Unlimited users', 'Everything Starter +', 'Full HR module', 'Payroll + payroll book', 'Advanced reports', 'Automatic entries', '24/7 dedicated support'],
      },
    },
    faq: {
      titulo: 'Frequently asked questions',
      items: [
        { p: 'What is Saas Empresarial?', r: 'A complete cloud ERP system integrating CRM, e-invoicing, inventory, accounting, HR and payroll in one platform.' },
        { p: 'Do I need to install anything?', r: 'No. Saas Empresarial works entirely in your web browser. You only need internet access.' },
        { p: 'Does it support Paraguayan legislation?', r: 'Yes. E-invoicing is designed for SIFEN/e-kuatia. Payroll automatically calculates IPS, employer IPS, aguinaldo and complies with Paraguayan labor law.' },
        { p: 'Can I try it for free?', r: 'Yes. The Free plan is completely free with no time limit. It includes CRM, catalog and invoicing.' },
        { p: 'How do I migrate my data?', r: 'All modules support CSV/Excel import. You can load your products, contacts, employees and other data from your previous system.' },
        { p: 'Do you offer support?', r: 'All plans include email support. Starter and Business plans have priority and dedicated support respectively.' },
      ],
    },
    footer: {
      producto: 'Product',
      modulos: 'Modules',
      precios: 'Pricing',
      acceso: 'Access',
      iniciarSesion: 'Log in',
      registrar: 'Sign up',
      legal: 'Legal',
      privacidad: 'Privacy',
      terminos: 'Terms of service',
      copyright: '© 2026 Saas Empresarial. All rights reserved.',
    },
    cookie: {
      texto: 'We use cookies to improve your experience. By continuing you accept our cookie policy.',
      aceptar: 'Accept',
    },
    contacto: {
      titulo: 'Contact us',
      subtitulo: 'Write to us and we will get back to you shortly',
      nombre: 'Name',
      email: 'Email',
      mensaje: 'Message',
      enviar: 'Send',
      gracias: 'Thank you! We will contact you soon.',
    },
    terminos: {
      titulo: 'Terms of service',
      contenido: 'By using Saas Empresarial you agree to these terms. The service is provided "as is" and we commit to maintaining the availability and security of your data. Using the platform for illicit activities is not permitted.',
    },
    privacidad: {
      titulo: 'Privacy policy',
      contenido: 'At Saas Empresarial we take your privacy seriously. The data you store on the platform is yours. We do not share personal information with third parties without your explicit consent.',
    },
  },

  'pt-BR': {
    meta: {
      title: 'Saas Empresarial — ERP completo para empresas',
      description: 'Sistema ERP completo com CRM, faturamento eletrônico, inventário, contabilidade, RH e folha de pagamento. Tudo em um só lugar.',
      ogDescription: 'ERP integral para empresas na América Latina',
    },
    nav: {
      productos: 'Módulos',
      precios: 'Preços',
      faq: 'FAQ',
      contacto: 'Contato',
      iniciarSesion: 'Entrar',
      registrar: 'Comece grátis',
    },
    hero: {
      titulo: 'O ERP que sua empresa precisa',
      subtitulo: 'Administre seu negócio em um só lugar: CRM, faturamento, inventário, contabilidade, RH e folha. Projetado para empresas na América Latina.',
      cta: 'Comece grátis',
      demo: 'Ver módulos',
    },
    features: {
      titulo: 'Tudo que você precisa em um único sistema',
      subtitulo: 'Nove módulos integrados que cobrem cada área da sua empresa',
      items: [
        { icon: '📦', titulo: 'Catálogo', desc: 'Gerencie produtos e serviços com preços, impostos e múltiplas unidades.' },
        { icon: '👥', titulo: 'CRM', desc: 'Administre contatos, oportunidades, cotações e pipelines de vendas.' },
        { icon: '🧾', titulo: 'Faturamento', desc: 'Emita notas fiscais eletrônicas, notas de crédito e débito.' },
        { icon: '🏭', titulo: 'Compras', desc: 'Gerencie ordens de compra, notas fiscais de fornecedor e scorecards.' },
        { icon: '📊', titulo: 'Inventário', desc: 'Controle estoque, transferências, contagens cíclicas e kardex.' },
        { icon: '💰', titulo: 'Contabilidade', desc: 'Plano de contas, lançamentos automáticos, impostos e relatórios.' },
        { icon: '👔', titulo: 'RH', desc: 'Funcionários, ponto, férias, ausências e controle de horário.' },
        { icon: '📋', titulo: 'Folha', desc: 'Cálculo de salários, recibos, livro digital e lançamentos contábeis.' },
        { icon: '💬', titulo: 'WhatsApp', desc: 'Envie mensagens e notificações do sistema via Twilio.' },
      ],
    },
    testimonios: {
      titulo: 'O que nossos clientes dizem',
      subtitulo: 'Empresas que confiam na Saas Empresarial',
      items: [
        { nombre: 'Carlos Méndez', cargo: 'CEO', empresa: 'Distribuidora XYZ', texto: 'Saímos do Excel para o Saas Empresarial e centralizamos toda a operação. O faturamento eletrônico e a folha nos economizam horas toda semana.' },
        { nombre: 'María González', cargo: 'Gerente Administrativa', empresa: 'Grupo Comercial do Sul', texto: 'Ter CRM, inventário e contabilidade integrados nos permite tomar decisões em tempo real. O suporte é excelente.' },
        { nombre: 'Juan Pérez', cargo: 'Diretor Financeiro', empresa: 'Serviços Gerais SA', texto: 'Implementamos a folha com a legislação paraguaia. O cálculo automático de IPS e aguinaldo tirou um peso enorme das nossas costas.' },
      ],
    },
    pricing: {
      titulo: 'Planos simples e transparentes',
      subtitulo: 'Escolha o plano ideal para sua empresa. Sem surpresas.',
      free: {
        nombre: 'Free',
        desc: 'Para começar',
        precio: 'Grátis',
        period: '',
        features: ['Até 2 usuários', 'CRM completo', 'Catálogo de produtos', 'Faturamento eletrônico', 'Suporte por email'],
      },
      starter: {
        nombre: 'Starter',
        desc: 'Para pequenas empresas',
        precio: '$29',
        period: '/mês',
        features: ['Até 10 usuários', 'Tudo Free +', 'Inventário + armazéns', 'Ordens de compra', 'Contabilidade básica', 'Suporte prioritário'],
      },
      business: {
        nombre: 'Business',
        desc: 'Para empresas em crescimento',
        precio: '$79',
        period: '/mês',
        features: ['Usuários ilimitados', 'Tudo Starter +', 'RH completo', 'Folha + livro digital', 'Relatórios avançados', 'Lançamentos automáticos', 'Suporte dedicado 24/7'],
      },
    },
    faq: {
      titulo: 'Perguntas frequentes',
      items: [
        { p: 'O que é Saas Empresarial?', r: 'É um sistema ERP completo na nuvem que integra CRM, faturamento eletrônico, inventário, contabilidade, RH e folha em uma única plataforma.' },
        { p: 'Preciso instalar algo?', r: 'Não. O Saas Empresarial funciona completamente no seu navegador. Você só precisa de internet.' },
        { p: 'Suporta a legislação paraguaia?', r: 'Sim. O faturamento eletrônico é projetado para SIFEN/e-kuatia. A folha calcula automaticamente IPS, IPS patronal, aguinaldo e cumpre a legislação trabalhista paraguaia.' },
        { p: 'Posso testar grátis?', r: 'Sim. O plano Free é completamente gratuito sem limite de tempo. Inclui CRM, catálogo e faturamento.' },
        { p: 'Como migro meus dados?', r: 'Todos os módulos possuem importação por CSV/Excel. Você pode carregar seus produtos, contatos, funcionários e outros dados do seu sistema anterior.' },
        { p: 'Oferecem suporte?', r: 'Todos os planos incluem suporte por email. Os planos Starter e Business têm suporte prioritário e dedicado respectivamente.' },
      ],
    },
    footer: {
      producto: 'Produto',
      modulos: 'Módulos',
      precios: 'Preços',
      acceso: 'Acesso',
      iniciarSesion: 'Entrar',
      registrar: 'Cadastrar',
      legal: 'Legal',
      privacidad: 'Privacidade',
      terminos: 'Termos de serviço',
      copyright: '© 2026 Saas Empresarial. Todos os direitos reservados.',
    },
    cookie: {
      texto: 'Usamos cookies para melhorar sua experiência. Ao continuar navegando você aceita nossa política de cookies.',
      aceptar: 'Aceitar',
    },
    contacto: {
      titulo: 'Fale conosco',
      subtitulo: 'Escreva para nós e responderemos em breve',
      nombre: 'Nome',
      email: 'Email',
      mensaje: 'Mensagem',
      enviar: 'Enviar',
      gracias: 'Obrigado! Entraremos em contato em breve.',
    },
    terminos: {
      titulo: 'Termos de serviço',
      contenido: 'Ao usar o Saas Empresarial você aceita estes termos. O serviço é fornecido "como está" e nos comprometemos a manter a disponibilidade e segurança dos seus dados. Não é permitido usar a plataforma para atividades ilícitas.',
    },
    privacidad: {
      titulo: 'Política de privacidade',
      contenido: 'No Saas Empresarial levamos sua privacidade a sério. Os dados que você armazena na plataforma são seus. Não compartilhamos informações pessoais com terceiros sem seu consentimento explícito.',
    },
  },
};

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro$2 = createAstro("https://saas-empresarial.com");
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const locale = Astro2.currentLocale || "es";
  const title = Astro2.props.title ?? t(locale, "meta.title");
  const description = Astro2.props.description ?? t(locale, "meta.description");
  const ogDescription = Astro2.props.ogDescription ?? t(locale, "meta.ogDescription");
  const canonical = new URL(Astro2.url.pathname, Astro2.site);
  const ogUrl = new URL(Astro2.url.pathname, Astro2.site);
  return renderTemplate(_a || (_a = __template(["<html", '> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="index, follow"><meta name="description"', '><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="canonical"', "><title>", '</title><meta property="og:title"', '><meta property="og:description"', '><meta property="og:type" content="website"><meta property="og:url"', '><meta property="og:image" content="https://saas-empresarial.com/og-image.svg"><meta property="og:locale"', '><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image" content="https://saas-empresarial.com/og-image.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><script type="application/ld+json">\n    {\n      "@context": "https://schema.org",\n      "@type": "Organization",\n      "name": "Saas Empresarial",\n      "url": "https://saas-empresarial.com",\n      "logo": "https://saas-empresarial.com/favicon.svg",\n      "description": "ERP platform for Latin American businesses."\n    }\n    <\/script><script type="application/ld+json">\n    {\n      "@context": "https://schema.org",\n      "@type": "SoftwareApplication",\n      "name": "Saas Empresarial",\n      "applicationCategory": "BusinessApplication",\n      "operatingSystem": "Web",\n      "description": "Sistema ERP completo con CRM, facturaci\xF3n, inventario, contabilidad, RRHH y n\xF3mina",\n      "url": "https://saas-empresarial.com",\n      "offers": [\n        { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" },\n        { "@type": "Offer", "name": "Starter", "price": "29", "priceCurrency": "USD" },\n        { "@type": "Offer", "name": "Business", "price": "79", "priceCurrency": "USD" }\n      ]\n    }\n    <\/script>', "</head> <body> <main> ", " </main> ", " </body></html>"])), addAttribute(locale === "pt-BR" ? "pt-BR" : locale, "lang"), addAttribute(description, "content"), addAttribute(canonical, "href"), title, addAttribute(title, "content"), addAttribute(ogDescription, "content"), addAttribute(ogUrl, "content"), addAttribute(locale === "pt-BR" ? "pt_BR" : locale === "en" ? "en_US" : "es_ES", "content"), addAttribute(title, "content"), addAttribute(ogDescription, "content"), renderHead(), renderSlot($$result, $$slots["default"]), renderComponent($$result, "CookieBanner", $$CookieBanner, { "locale": locale }));
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/layouts/BaseLayout.astro", void 0);

const $$Astro$1 = createAstro("https://saas-empresarial.com");
const $$Navbar = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Navbar;
  const { locale = "es" } = Astro2.props;
  const links = [
    { href: "#features", label: t(locale, "nav.productos") },
    { href: "#pricing", label: t(locale, "nav.precios") },
    { href: "#faq", label: t(locale, "nav.faq") },
    { href: "#contacto", label: t(locale, "nav.contacto") }
  ];
  const appUrl = "https://app.saas-empresarial.com";
  return renderTemplate`${maybeRenderHead()}<nav class="navbar"> <div class="container nav-inner"> <a href="/" class="logo">Saas <span>Empresarial</span></a> <div class="nav-links"> ${links.map((link) => renderTemplate`<a${addAttribute(link.href, "href")}>${link.label}</a>`)} </div> <div class="nav-right"> <div class="lang-chips"> <a href="/"${addAttribute(["lang-chip", { active: locale === "es" }], "class:list")}>ES</a> <a href="/en/"${addAttribute(["lang-chip", { active: locale === "en" }], "class:list")}>EN</a> <a href="/pt-BR/"${addAttribute(["lang-chip", { active: locale === "pt-BR" }], "class:list")}>PT</a> </div> <a${addAttribute(`${appUrl}/login`, "href")} class="btn btn-outline btn-sm">${t(locale, "nav.iniciarSesion")}</a> <a${addAttribute(`${appUrl}/register`, "href")} class="btn btn-primary btn-sm">${t(locale, "nav.registrar")}</a> </div> <button class="menu-toggle" id="menuToggle" aria-label="Menu"> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"></path></svg> </button> </div> <div class="mobile-menu" id="mobileMenu"> ${links.map((link) => renderTemplate`<a${addAttribute(link.href, "href")} class="mobile-link">${link.label}</a>`)} <div class="lang-chips" style="margin-top:1rem"> <a href="/"${addAttribute(["lang-chip", { active: locale === "es" }], "class:list")}>ES</a> <a href="/en/"${addAttribute(["lang-chip", { active: locale === "en" }], "class:list")}>EN</a> <a href="/pt-BR/"${addAttribute(["lang-chip", { active: locale === "pt-BR" }], "class:list")}>PT</a> </div> <a${addAttribute(`${appUrl}/login`, "href")} class="btn btn-outline" style="width:100%;margin-top:1rem">${t(locale, "nav.iniciarSesion")}</a> <a${addAttribute(`${appUrl}/register`, "href")} class="btn btn-primary" style="width:100%;margin-top:0.5rem">${t(locale, "nav.registrar")}</a> </div> </nav> ${renderScript($$result, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Navbar.astro?astro&type=script&index=0&lang.ts")} `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Navbar.astro", void 0);

const $$Astro = createAstro("https://saas-empresarial.com");
const $$Footer = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Footer;
  const { locale = "es" } = Astro2.props;
  const appUrl = "https://app.saas-empresarial.com";
  return renderTemplate`${maybeRenderHead()}<footer class="footer section-dark"> <div class="container footer-grid"> <div class="footer-brand"> <div class="logo">Saas <span>Empresarial</span></div> <p class="footer-desc">ERP todo-en-uno para empresas en Latinoamérica.</p> </div> <div class="footer-col"> <h4>${t(locale, "footer.producto")}</h4> <a href="#features">${t(locale, "footer.modulos")}</a> <a href="#pricing">${t(locale, "footer.precios")}</a> </div> <div class="footer-col"> <h4>${t(locale, "footer.acceso")}</h4> <a${addAttribute(`${appUrl}/login`, "href")}>${t(locale, "footer.iniciarSesion")}</a> <a${addAttribute(`${appUrl}/register`, "href")}>${t(locale, "footer.registrar")}</a> </div> <div class="footer-col"> <h4>${t(locale, "footer.legal")}</h4> <a href="/privacidad">${t(locale, "footer.privacidad")}</a> <a href="/terminos">${t(locale, "footer.terminos")}</a> </div> </div> <div class="container footer-bottom"> <p>${t(locale, "footer.copyright")}</p> </div> </footer> `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Footer.astro", void 0);

export { $$BaseLayout as $, $$Navbar as a, $$Footer as b, t };
