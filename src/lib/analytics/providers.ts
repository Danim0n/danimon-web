export interface CloudflareHandle { stop(): void }
export function hasCloudflareBeacon(): boolean {
  return !!document.querySelector('script[src*="static.cloudflareinsights.com/beacon"],script[data-cf-beacon]');
}
export function safeCloudflareDocument(): boolean {
  if (location.search || location.hash) return false;
  const paths = ['/', '/es/', '/projects/local-events/', '/es/proyectos/eventos/',
    '/demo/facturas/', '/es/demo/facturas/', '/cookies/', '/es/cookies/'];
  if (!paths.includes(location.pathname)) return false;
  try {
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.search || referrer.hash) return false;
      if (referrer.origin === location.origin ? !paths.includes(referrer.pathname) : referrer.pathname !== '/') return false;
    }
  } catch { return false; }
  return true;
}
export function cloudflareProvider(token: string): CloudflareHandle | null {
  if (hasCloudflareBeacon()) return null;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.defer = true;
  script.dataset.cfBeacon = JSON.stringify({ token, spa: false });
  script.referrerPolicy = 'no-referrer';
  document.head.append(script);
  return { stop() { script.remove(); } };
}

