import { c as createAstro, d as createComponent, m as maybeRenderHead, f as addAttribute, r as renderTemplate, i as renderComponent, j as renderScript } from './astro/server_28ksw8Eg.mjs';
import 'piccolore';
import 'clsx';
import { t } from './Footer_B1xjIWwC.mjs';
/* empty css                         */

const $$Astro$6 = createAstro("https://saas-empresarial.com");
const $$Hero = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$Hero;
  const { locale = "es" } = Astro2.props;
  const appUrl = "https://app.saas-empresarial.com";
  return renderTemplate`${maybeRenderHead()}<section class="hero"> <div class="container hero-content"> <div class="hero-badge">🚀 ERP todo-en-uno para empresas</div> <h1 class="hero-title">${t(locale, "hero.titulo")}</h1> <p class="hero-subtitle">${t(locale, "hero.subtitulo")}</p> <div class="hero-cta"> <a${addAttribute(`${appUrl}/register`, "href")} class="btn btn-primary btn-lg">${t(locale, "hero.cta")}</a> <a href="#features" class="btn btn-outline btn-lg">${t(locale, "hero.demo")}</a> </div> </div> <div class="hero-gradient"></div> </section> `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Hero.astro", void 0);

const $$Astro$5 = createAstro("https://saas-empresarial.com");
const $$Features = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$Features;
  const { locale = "es" } = Astro2.props;
  const items = t(locale, "features.items");
  return renderTemplate`${maybeRenderHead()}<section id="features" class="section section-alt"> <div class="container"> <h2 class="section-title">${t(locale, "features.titulo")}</h2> <p class="section-subtitle">${t(locale, "features.subtitulo")}</p> <div class="features-grid"> ${items.map((item) => renderTemplate`<div class="feature-card"> <div class="feature-icon">${item.icon}</div> <h3 class="feature-title">${item.titulo}</h3> <p class="feature-desc">${item.desc}</p> </div>`)} </div> </div> </section> `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Features.astro", void 0);

const $$Astro$4 = createAstro("https://saas-empresarial.com");
const $$Testimonios = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$Testimonios;
  const { locale = "es" } = Astro2.props;
  const items = t(locale, "testimonios.items");
  return renderTemplate`${maybeRenderHead()}<section id="testimonios" class="section"> <div class="container"> <h2 class="section-title">${t(locale, "testimonios.titulo")}</h2> <p class="section-subtitle">${t(locale, "testimonios.subtitulo")}</p> <div class="testimonios-grid"> ${items.map((item) => renderTemplate`<div class="testimonio-card"> <div class="testimonio-avatar">${item.nombre.charAt(0)}</div> <p class="testimonio-texto">"${item.texto}"</p> <div class="testimonio-autor"> <strong>${item.nombre}</strong> <span>${item.cargo}, ${item.empresa}</span> </div> </div>`)} </div> </div> </section> `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Testimonios.astro", void 0);

const $$Astro$3 = createAstro("https://saas-empresarial.com");
const $$PlanCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$PlanCard;
  const { plan, destacado = false, locale = "es" } = Astro2.props;
  const appUrl = "https://app.saas-empresarial.com";
  return renderTemplate`${maybeRenderHead()}<div${addAttribute(["plan-card", { destacado }], "class:list")}> ${destacado && renderTemplate`<div class="plan-badge">Más popular</div>`} <h3 class="plan-name">${plan.nombre}</h3> <p class="plan-desc">${plan.desc}</p> <div class="plan-price"> <span class="plan-amount">${plan.precio}</span> <span class="plan-period">${plan.period}</span> </div> <ul class="plan-features"> ${plan.features.map((f) => renderTemplate`<li class="plan-feature">✓ ${f}</li>`)} </ul> <a${addAttribute(`${appUrl}/register`, "href")}${addAttribute(["btn", { "btn-primary": true, "btn-lg": true }], "class:list")} style="width:100%;text-align:center;justify-content:center"> ${plan.nombre === "Free" || plan.nombre === "Gratis" ? "Comenzar gratis" : "Contratar"} </a> </div> `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/PlanCard.astro", void 0);

const $$Astro$2 = createAstro("https://saas-empresarial.com");
const $$Pricing = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Pricing;
  const { locale = "es" } = Astro2.props;
  const plans = [
    { key: "free", destacado: false },
    { key: "starter", destacado: true },
    { key: "business", destacado: false }
  ];
  return renderTemplate`${maybeRenderHead()}<section id="pricing" class="section section-alt"> <div class="container"> <h2 class="section-title">${t(locale, "pricing.titulo")}</h2> <p class="section-subtitle">${t(locale, "pricing.subtitulo")}</p> <div class="pricing-grid"> ${plans.map(({ key, destacado }) => {
    const plan = t(locale, `pricing.${key}`);
    return renderTemplate`${renderComponent($$result, "PlanCard", $$PlanCard, { "plan": plan, "destacado": destacado, "locale": locale })}`;
  })} </div> </div> </section> `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Pricing.astro", void 0);

const $$Astro$1 = createAstro("https://saas-empresarial.com");
const $$FaqSection = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$FaqSection;
  const { locale = "es" } = Astro2.props;
  const items = t(locale, "faq.items");
  return renderTemplate`${maybeRenderHead()}<section id="faq" class="section"> <div class="container" style="max-width:720px"> <h2 class="section-title">${t(locale, "faq.titulo")}</h2> <div class="faq-list"> ${items.map((item, i) => renderTemplate`<details class="faq-item" name="faq"> <summary class="faq-question"> <span>${item.p}</span> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg> </summary> <p class="faq-answer">${item.r}</p> </details>`)} </div> </div> </section> `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/FaqSection.astro", void 0);

const $$Astro = createAstro("https://saas-empresarial.com");
const $$ContactForm = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$ContactForm;
  const { locale = "es" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<section id="contacto" class="section section-alt"> <div class="container" style="max-width:560px"> <h2 class="section-title">${t(locale, "contacto.titulo")}</h2> <p class="section-subtitle">${t(locale, "contacto.subtitulo")}</p> <form class="contact-form" netlify name="contact" method="POST"> <input type="hidden" name="form-name" value="contact"> <div class="form-field"> <label for="nombre">${t(locale, "contacto.nombre")}</label> <input type="text" id="nombre" name="nombre" required> </div> <div class="form-field"> <label for="email">${t(locale, "contacto.email")}</label> <input type="email" id="email" name="email" required> </div> <div class="form-field"> <label for="mensaje">${t(locale, "contacto.mensaje")}</label> <textarea id="mensaje" name="mensaje" rows="4" required></textarea> </div> <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center"> ${t(locale, "contacto.enviar")} </button> </form> <p class="form-gracias" style="display:none">${t(locale, "contacto.gracias")}</p> </div> </section> ${renderScript($$result, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/ContactForm.astro?astro&type=script&index=0&lang.ts")} `;
}, "C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/ContactForm.astro", void 0);

export { $$Hero as $, $$Features as a, $$Testimonios as b, $$Pricing as c, $$FaqSection as d, $$ContactForm as e };
