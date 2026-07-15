import { d as createComponent, i as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_28ksw8Eg.mjs';
import 'piccolore';
import { t, $ as $$BaseLayout, a as $$Navbar, b as $$Footer } from '../chunks/Footer_B1xjIWwC.mjs';
export { renderers } from '../renderers.mjs';

const $$Terminos = createComponent(($$result, $$props, $$slots) => {
  const locale = "es";
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": t(locale, "terminos.titulo") + " - Saas Empresarial" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Navbar", $$Navbar, { "locale": locale })} ${maybeRenderHead()}<section class="section" style="padding-top:100px"> <div class="container" style="max-width:720px"> <h1 class="section-title">${t(locale, "terminos.titulo")}</h1> <div class="legal-content"> <p>${t(locale, "terminos.contenido")}</p> </div> </div> </section> ${renderComponent($$result2, "Footer", $$Footer, { "locale": locale })} ` })}`;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/terminos.astro", void 0);

const $$file = "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/terminos.astro";
const $$url = "/terminos";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Terminos,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
