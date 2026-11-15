import type { KVNamespace } from '@cloudflare/workers-types';
import { inertResponseCsp, securityHeaders } from '../src/lib/security-policy';

const copy = {
  es: {
    title: 'Web temporalmente en mantenimiento',
    description: 'El portfolio volverá a estar disponible próximamente.',
    other: 'English',
    otherLang: 'en',
  },
  en: {
    title: 'Website temporarily under maintenance',
    description: 'The portfolio will be available again soon.',
    other: 'Español',
    otherLang: 'es',
  },
} as const;

const styles = `
  :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #061215; color: #effbf9; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 2rem clamp(1rem, 5vw, 4rem); isolation: isolate; }
  body::before { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(ellipse at 52% 15%, #125359 0, transparent 56%),
      radial-gradient(ellipse at 85% 100%, #0a333a 0, transparent 65%); }
  main { width: min(100%, 56rem); padding: clamp(1.5rem, 7vw, 4.5rem); position: relative;
    border: 1px solid #427a7a; border-radius: clamp(1rem, 3vw, 2rem);
    background: linear-gradient(145deg, #123034f5, #081619fa 72%); box-shadow: 0 2rem 6rem #01080b85; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .brand { font-size: 1.05rem; font-weight: 650; letter-spacing: -0.04em; }
  a { display: inline-flex; min-height: 2.75rem; align-items: center; padding-inline: 0.65rem;
    color: #b4eee7; text-underline-offset: 0.25em; border-radius: 0.25rem; }
  a:hover { color: #fff; }
  a:focus-visible { outline: 2px solid #b4eee7; outline-offset: 2px; }
  .line { height: 1px; margin: clamp(0.75rem, 3vw, 1.5rem) 0 clamp(2.25rem, 8vw, 5rem);
    position: relative; overflow: hidden; background: #42676a; }
  .line::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, #affbf1, transparent);
    animation: sweep 4s ease-in-out 1; animation-fill-mode: both; }
  h1 { max-width: 17ch; margin: 0; font-size: clamp(2.15rem, 7.3vw, 5.3rem); line-height: 1.01;
    letter-spacing: -0.07em; font-weight: 620; text-wrap: balance; overflow-wrap: break-word; }
  p { color: #b9d5d4; margin: 1.25rem 0 0; max-width: 48ch; font-size: clamp(1rem, 2.2vw, 1.25rem); line-height: 1.6; }
  @keyframes sweep { from { transform: translateX(-100%); opacity: 0; } 36%, 60% { opacity: 0.85; }
    to { transform: translateX(85%); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .line::after { animation: none; opacity: 0; } }
`;

export async function maintenanceEnabled(config?: Pick<KVNamespace, 'get'>) {
  if (!config) return false;
  // A configured binding that cannot be read must never expose the portfolio.
  try {
    return await config.get('mode', { cacheTtl: 30 }) !== 'normal';
  } catch {
    return true;
  }
}

function language(request: Request) {
  const url = new URL(request.url);
  const selected = url.searchParams.get('lang');
  if (selected === 'es' || selected === 'en') return selected;
  if (/^\/es(?:\/|$)/i.test(url.pathname)) return 'es';
  const accepted = (request.headers.get('Accept-Language') ?? '').split(',').map(entry => {
    const [tag, weight = 'q=1'] = entry.trim().toLowerCase().split(';');
    return { tag: tag.split('-')[0], quality: Number(weight.trim().replace(/^q=/, '')) };
  });
  return accepted.filter(entry => entry.quality > 0 && (entry.tag === 'en' || entry.tag === 'es'))
    .sort((a, b) => b.quality - a.quality)[0]?.tag === 'es' ? 'es' : 'en';
}

export function maintenanceResponse(request: Request) {
  const lang = language(request);
  const message = copy[lang];
  const nonce = crypto.randomUUID();
  const alternate = message.otherLang === 'es' ? '/es/?lang=es' : '/?lang=en';
  const body = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${message.title} | danimon.party</title>
  <style nonce="${nonce}">${styles}</style>
</head>
<body>
  <main>
    <div class="top">
      <span class="brand">danimon.party</span>
      <a href="${alternate}" lang="${message.otherLang}" hreflang="${message.otherLang}">${message.other}</a>
    </div>
    <div class="line" aria-hidden="true"></div>
    <h1>${message.title}</h1>
    <p>${message.description}</p>
  </main>
</body>
</html>`;

  return new Response(request.method === 'HEAD' ? null : body, {
    status: 503,
    headers: {
      ...securityHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Language': lang,
      'Content-Security-Policy': `${inertResponseCsp}; style-src 'nonce-${nonce}'`,
      'Retry-After': '300',
      'Cache-Control': 'no-store, no-transform',
      'X-Robots-Tag': 'noindex, nofollow',
      'Vary': 'Accept-Language',
      'NEL': '{"max_age":0}',
    },
  });
}
