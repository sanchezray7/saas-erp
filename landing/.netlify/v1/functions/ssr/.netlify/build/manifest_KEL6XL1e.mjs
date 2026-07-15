import '@astrojs/internal-helpers/path';
import '@astrojs/internal-helpers/remote';
import 'piccolore';
import { n as NOOP_MIDDLEWARE_HEADER, o as decodeKey } from './chunks/astro/server_28ksw8Eg.mjs';
import 'clsx';
import 'es-module-lexer';
import 'html-escaper';

const NOOP_MIDDLEWARE_FN = async (_ctx, next) => {
  const response = await next();
  response.headers.set(NOOP_MIDDLEWARE_HEADER, "true");
  return response;
};

const codeToStatusMap = {
  // Implemented from IANA HTTP Status Code Registry
  // https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  CONTENT_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_CONTENT: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NETWORK_AUTHENTICATION_REQUIRED: 511
};
Object.entries(codeToStatusMap).reduce(
  // reverse the key-value pairs
  (acc, [key, value]) => ({ ...acc, [value]: key }),
  {}
);

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/","cacheDir":"file:///C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/node_modules/.astro/","outDir":"file:///C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/dist/","srcDir":"file:///C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/","publicDir":"file:///C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/public/","buildClientDir":"file:///C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/dist/","buildServerDir":"file:///C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/.netlify/build/","adapterName":"@astrojs/netlify","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"inline","content":":root{--primary: #6366f1;--primary-dark: #4f46e5;--primary-light: #818cf8;--bg: #ffffff;--bg-alt: #f8fafc;--bg-dark: #0f172a;--text: #1e293b;--text-muted: #64748b;--text-light: #ffffff;--border: #e2e8f0;--radius: 12px;--radius-sm: 8px;--shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);--shadow-lg: 0 10px 25px rgba(0,0,0,.12);--max-w: 1200px}*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}body{font-family:Inter,system-ui,sans-serif;color:var(--text);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}a{color:inherit;text-decoration:none}img{max-width:100%}h1,h2,h3,h4{line-height:1.2}.container{max-width:var(--max-w);margin:0 auto;padding:0 1.5rem}.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.5rem;border-radius:var(--radius-sm);font-weight:600;font-size:.95rem;border:none;cursor:pointer;transition:all .2s}.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-dark);transform:translateY(-1px)}.btn-outline{background:transparent;color:var(--text);border:1.5px solid var(--border)}.btn-outline:hover{border-color:var(--primary);color:var(--primary)}.btn-lg{padding:1rem 2rem;font-size:1.05rem}.section{padding:5rem 0}.section-alt{background:var(--bg-alt)}.section-dark{background:var(--bg-dark);color:var(--text-light)}.section-title{text-align:center;font-size:2rem;font-weight:700;margin-bottom:.75rem}.section-subtitle{text-align:center;color:var(--text-muted);font-size:1.1rem;max-width:600px;margin:0 auto 3rem}.section-dark .section-subtitle{color:#94a3b8}.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}@media(max-width:768px){.section{padding:3rem 0}.section-title{font-size:1.6rem}.grid-3{grid-template-columns:1fr}}.cookie-banner{position:fixed;bottom:0;left:0;right:0;background:var(--bg-dark);color:#fff;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:center;gap:1rem;z-index:200;flex-wrap:wrap}.cookie-banner p{font-size:.85rem;color:#94a3b8;max-width:600px}.navbar{position:fixed;top:0;left:0;right:0;z-index:100;background:#fffffff2;backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}.logo{font-size:1.25rem;font-weight:800;color:var(--text)}.logo span{color:var(--primary)}.nav-links{display:flex;gap:1.5rem}.nav-links a{color:var(--text-muted);font-size:.9rem;font-weight:500;transition:color .2s}.nav-links a:hover{color:var(--primary)}.nav-right{display:flex;align-items:center;gap:.75rem}.lang-chips{display:flex;gap:2px;background:var(--bg-alt);border-radius:6px;padding:2px}.lang-chip{padding:4px 8px;font-size:.75rem;font-weight:600;border-radius:4px;color:var(--text-muted);transition:all .2s}.lang-chip.active,.lang-chip:hover{background:#fff;color:var(--primary);box-shadow:var(--shadow)}.btn-sm{padding:.5rem 1rem;font-size:.85rem}.menu-toggle{display:none;background:none;border:none;cursor:pointer;color:var(--text)}.mobile-menu{display:none;flex-direction:column;padding:1rem 1.5rem;background:#fff;border-bottom:1px solid var(--border)}.mobile-menu.open{display:flex}.mobile-link{padding:.5rem 0;color:var(--text-muted);font-weight:500}@media(max-width:768px){.nav-links,.nav-right{display:none}.menu-toggle{display:block}}.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2rem;padding:3rem 0}.footer-brand .logo{font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:.5rem}.footer-brand .logo span{color:var(--primary-light)}.footer-desc{font-size:.85rem;color:#94a3b8;line-height:1.6}.footer-col h4{font-size:.85rem;font-weight:600;margin-bottom:.75rem;color:#fff}.footer-col a{display:block;font-size:.85rem;color:#94a3b8;margin-bottom:.4rem;transition:color .2s}.footer-col a:hover{color:var(--primary-light)}.footer-bottom{border-top:1px solid rgba(255,255,255,.1);padding:1.5rem 0;text-align:center;font-size:.8rem;color:#64748b}@media(max-width:768px){.footer-grid{grid-template-columns:1fr 1fr}}\n.legal-content{font-size:1rem;line-height:1.8;color:var(--text-muted);margin-top:2rem}\n"}],"routeData":{"route":"/privacidad","isIndex":false,"type":"page","pattern":"^\\/privacidad\\/?$","segments":[[{"content":"privacidad","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/privacidad.astro","pathname":"/privacidad","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"inline","content":":root{--primary: #6366f1;--primary-dark: #4f46e5;--primary-light: #818cf8;--bg: #ffffff;--bg-alt: #f8fafc;--bg-dark: #0f172a;--text: #1e293b;--text-muted: #64748b;--text-light: #ffffff;--border: #e2e8f0;--radius: 12px;--radius-sm: 8px;--shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);--shadow-lg: 0 10px 25px rgba(0,0,0,.12);--max-w: 1200px}*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}body{font-family:Inter,system-ui,sans-serif;color:var(--text);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}a{color:inherit;text-decoration:none}img{max-width:100%}h1,h2,h3,h4{line-height:1.2}.container{max-width:var(--max-w);margin:0 auto;padding:0 1.5rem}.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.5rem;border-radius:var(--radius-sm);font-weight:600;font-size:.95rem;border:none;cursor:pointer;transition:all .2s}.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-dark);transform:translateY(-1px)}.btn-outline{background:transparent;color:var(--text);border:1.5px solid var(--border)}.btn-outline:hover{border-color:var(--primary);color:var(--primary)}.btn-lg{padding:1rem 2rem;font-size:1.05rem}.section{padding:5rem 0}.section-alt{background:var(--bg-alt)}.section-dark{background:var(--bg-dark);color:var(--text-light)}.section-title{text-align:center;font-size:2rem;font-weight:700;margin-bottom:.75rem}.section-subtitle{text-align:center;color:var(--text-muted);font-size:1.1rem;max-width:600px;margin:0 auto 3rem}.section-dark .section-subtitle{color:#94a3b8}.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}@media(max-width:768px){.section{padding:3rem 0}.section-title{font-size:1.6rem}.grid-3{grid-template-columns:1fr}}.cookie-banner{position:fixed;bottom:0;left:0;right:0;background:var(--bg-dark);color:#fff;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:center;gap:1rem;z-index:200;flex-wrap:wrap}.cookie-banner p{font-size:.85rem;color:#94a3b8;max-width:600px}.navbar{position:fixed;top:0;left:0;right:0;z-index:100;background:#fffffff2;backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}.logo{font-size:1.25rem;font-weight:800;color:var(--text)}.logo span{color:var(--primary)}.nav-links{display:flex;gap:1.5rem}.nav-links a{color:var(--text-muted);font-size:.9rem;font-weight:500;transition:color .2s}.nav-links a:hover{color:var(--primary)}.nav-right{display:flex;align-items:center;gap:.75rem}.lang-chips{display:flex;gap:2px;background:var(--bg-alt);border-radius:6px;padding:2px}.lang-chip{padding:4px 8px;font-size:.75rem;font-weight:600;border-radius:4px;color:var(--text-muted);transition:all .2s}.lang-chip.active,.lang-chip:hover{background:#fff;color:var(--primary);box-shadow:var(--shadow)}.btn-sm{padding:.5rem 1rem;font-size:.85rem}.menu-toggle{display:none;background:none;border:none;cursor:pointer;color:var(--text)}.mobile-menu{display:none;flex-direction:column;padding:1rem 1.5rem;background:#fff;border-bottom:1px solid var(--border)}.mobile-menu.open{display:flex}.mobile-link{padding:.5rem 0;color:var(--text-muted);font-weight:500}@media(max-width:768px){.nav-links,.nav-right{display:none}.menu-toggle{display:block}}.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2rem;padding:3rem 0}.footer-brand .logo{font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:.5rem}.footer-brand .logo span{color:var(--primary-light)}.footer-desc{font-size:.85rem;color:#94a3b8;line-height:1.6}.footer-col h4{font-size:.85rem;font-weight:600;margin-bottom:.75rem;color:#fff}.footer-col a{display:block;font-size:.85rem;color:#94a3b8;margin-bottom:.4rem;transition:color .2s}.footer-col a:hover{color:var(--primary-light)}.footer-bottom{border-top:1px solid rgba(255,255,255,.1);padding:1.5rem 0;text-align:center;font-size:.8rem;color:#64748b}@media(max-width:768px){.footer-grid{grid-template-columns:1fr 1fr}}\n"}],"routeData":{"route":"/terminos","isIndex":false,"type":"page","pattern":"^\\/terminos\\/?$","segments":[[{"content":"terminos","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/terminos.astro","pathname":"/terminos","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"inline","content":":root{--primary: #6366f1;--primary-dark: #4f46e5;--primary-light: #818cf8;--bg: #ffffff;--bg-alt: #f8fafc;--bg-dark: #0f172a;--text: #1e293b;--text-muted: #64748b;--text-light: #ffffff;--border: #e2e8f0;--radius: 12px;--radius-sm: 8px;--shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);--shadow-lg: 0 10px 25px rgba(0,0,0,.12);--max-w: 1200px}*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}body{font-family:Inter,system-ui,sans-serif;color:var(--text);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}a{color:inherit;text-decoration:none}img{max-width:100%}h1,h2,h3,h4{line-height:1.2}.container{max-width:var(--max-w);margin:0 auto;padding:0 1.5rem}.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 1.5rem;border-radius:var(--radius-sm);font-weight:600;font-size:.95rem;border:none;cursor:pointer;transition:all .2s}.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-dark);transform:translateY(-1px)}.btn-outline{background:transparent;color:var(--text);border:1.5px solid var(--border)}.btn-outline:hover{border-color:var(--primary);color:var(--primary)}.btn-lg{padding:1rem 2rem;font-size:1.05rem}.section{padding:5rem 0}.section-alt{background:var(--bg-alt)}.section-dark{background:var(--bg-dark);color:var(--text-light)}.section-title{text-align:center;font-size:2rem;font-weight:700;margin-bottom:.75rem}.section-subtitle{text-align:center;color:var(--text-muted);font-size:1.1rem;max-width:600px;margin:0 auto 3rem}.section-dark .section-subtitle{color:#94a3b8}.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}@media(max-width:768px){.section{padding:3rem 0}.section-title{font-size:1.6rem}.grid-3{grid-template-columns:1fr}}.cookie-banner{position:fixed;bottom:0;left:0;right:0;background:var(--bg-dark);color:#fff;padding:1rem 1.5rem;display:flex;align-items:center;justify-content:center;gap:1rem;z-index:200;flex-wrap:wrap}.cookie-banner p{font-size:.85rem;color:#94a3b8;max-width:600px}.navbar{position:fixed;top:0;left:0;right:0;z-index:100;background:#fffffff2;backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}.logo{font-size:1.25rem;font-weight:800;color:var(--text)}.logo span{color:var(--primary)}.nav-links{display:flex;gap:1.5rem}.nav-links a{color:var(--text-muted);font-size:.9rem;font-weight:500;transition:color .2s}.nav-links a:hover{color:var(--primary)}.nav-right{display:flex;align-items:center;gap:.75rem}.lang-chips{display:flex;gap:2px;background:var(--bg-alt);border-radius:6px;padding:2px}.lang-chip{padding:4px 8px;font-size:.75rem;font-weight:600;border-radius:4px;color:var(--text-muted);transition:all .2s}.lang-chip.active,.lang-chip:hover{background:#fff;color:var(--primary);box-shadow:var(--shadow)}.btn-sm{padding:.5rem 1rem;font-size:.85rem}.menu-toggle{display:none;background:none;border:none;cursor:pointer;color:var(--text)}.mobile-menu{display:none;flex-direction:column;padding:1rem 1.5rem;background:#fff;border-bottom:1px solid var(--border)}.mobile-menu.open{display:flex}.mobile-link{padding:.5rem 0;color:var(--text-muted);font-weight:500}@media(max-width:768px){.nav-links,.nav-right{display:none}.menu-toggle{display:block}}.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2rem;padding:3rem 0}.footer-brand .logo{font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:.5rem}.footer-brand .logo span{color:var(--primary-light)}.footer-desc{font-size:.85rem;color:#94a3b8;line-height:1.6}.footer-col h4{font-size:.85rem;font-weight:600;margin-bottom:.75rem;color:#fff}.footer-col a{display:block;font-size:.85rem;color:#94a3b8;margin-bottom:.4rem;transition:color .2s}.footer-col a:hover{color:var(--primary-light)}.footer-bottom{border-top:1px solid rgba(255,255,255,.1);padding:1.5rem 0;text-align:center;font-size:.8rem;color:#64748b}@media(max-width:768px){.footer-grid{grid-template-columns:1fr 1fr}}\n"},{"type":"external","src":"/_assets/index.CBOxIteY.css"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"site":"https://saas-empresarial.com","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/[locale]/index.astro",{"propagation":"none","containsHead":true}],["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/[locale]/privacidad.astro",{"propagation":"none","containsHead":true}],["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/[locale]/terminos.astro",{"propagation":"none","containsHead":true}],["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/index.astro",{"propagation":"none","containsHead":true}],["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/privacidad.astro",{"propagation":"none","containsHead":true}],["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/pages/terminos.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/[locale]/index@_@astro":"pages/_locale_.astro.mjs","\u0000@astro-page:src/pages/[locale]/privacidad@_@astro":"pages/_locale_/privacidad.astro.mjs","\u0000@astro-page:src/pages/[locale]/terminos@_@astro":"pages/_locale_/terminos.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astro-page:src/pages/privacidad@_@astro":"pages/privacidad.astro.mjs","\u0000@astro-page:src/pages/terminos@_@astro":"pages/terminos.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000noop-middleware":"_noop-middleware.mjs","\u0000virtual:astro:actions/noop-entrypoint":"noop-entrypoint.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_KEL6XL1e.mjs","C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/node_modules/unstorage/drivers/netlify-blobs.mjs":"chunks/netlify-blobs_DM36vZAS.mjs","C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/ContactForm.astro?astro&type=script&index=0&lang.ts":"_assets/ContactForm.astro_astro_type_script_index_0_lang.CyqzFm4S.js","C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/CookieBanner.astro?astro&type=script&index=0&lang.ts":"_assets/CookieBanner.astro_astro_type_script_index_0_lang.H7JUyKzI.js","C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Navbar.astro?astro&type=script&index=0&lang.ts":"_assets/Navbar.astro_astro_type_script_index_0_lang.CVYeCKLn.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/ContactForm.astro?astro&type=script&index=0&lang.ts","document.querySelector(\".contact-form\")?.addEventListener(\"submit\",async t=>{t.preventDefault();const e=t.target,a=new FormData(e);try{await fetch(\"/\",{method:\"POST\",body:a}),e.style.display=\"none\",document.querySelector(\".form-gracias\").style.display=\"block\"}catch{}});"],["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/CookieBanner.astro?astro&type=script&index=0&lang.ts","const e=document.getElementById(\"cookieBanner\"),t=document.getElementById(\"cookieAccept\");localStorage.getItem(\"cookie-consent\")&&(e.style.display=\"none\");t?.addEventListener(\"click\",()=>{localStorage.setItem(\"cookie-consent\",\"true\"),e.style.display=\"none\"});"],["C:/Users/sanch/Documents/Desarrollo/saas/saas-empresarial/landing/src/components/Navbar.astro?astro&type=script&index=0&lang.ts","document.getElementById(\"menuToggle\")?.addEventListener(\"click\",()=>{document.getElementById(\"mobileMenu\")?.classList.toggle(\"open\")});"]],"assets":["/_assets/index.CBOxIteY.css","/favicon.svg","/og-image.svg","/robots.txt"],"i18n":{"fallbackType":"redirect","strategy":"pathname-prefix-other-locales","locales":["es","en","pt-BR"],"defaultLocale":"es","domainLookupTable":{}},"buildFormat":"directory","checkOrigin":true,"allowedDomains":[],"actionBodySizeLimit":1048576,"serverIslandNameMap":[],"key":"KnIr6bqbEbyhXP9IZT6+V8d+bhnOMTrrb37htr6N+yo=","sessionConfig":{"driver":"netlify-blobs","options":{"name":"astro-sessions","consistency":"strong"}}});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = () => import('./chunks/netlify-blobs_DM36vZAS.mjs');

export { manifest };
