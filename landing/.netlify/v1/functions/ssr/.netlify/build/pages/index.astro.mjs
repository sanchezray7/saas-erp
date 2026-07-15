import { d as createComponent, i as renderComponent, r as renderTemplate } from '../chunks/astro/server_28ksw8Eg.mjs';
import 'piccolore';
import { $ as $$BaseLayout, a as $$Navbar, b as $$Footer } from '../chunks/Footer_B1xjIWwC.mjs';
import { $ as $$Hero, a as $$Features, b as $$Testimonios, c as $$Pricing, d as $$FaqSection, e as $$ContactForm } from '../chunks/ContactForm_7qdeLAm0.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(($$result, $$props, $$slots) => {
  const locale = "es";
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {}, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Navbar", $$Navbar, { "locale": locale })} ${renderComponent($$result2, "Hero", $$Hero, { "locale": locale })} ${renderComponent($$result2, "Features", $$Features, { "locale": locale })} ${renderComponent($$result2, "Testimonios", $$Testimonios, { "locale": locale })} ${renderComponent($$result2, "Pricing", $$Pricing, { "locale": locale })} ${renderComponent($$result2, "FaqSection", $$FaqSection, { "locale": locale })} ${renderComponent($$result2, "ContactForm", $$ContactForm, { "locale": locale })} ${renderComponent($$result2, "Footer", $$Footer, { "locale": locale })} ` })}`;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/index.astro", void 0);

const $$file = "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
