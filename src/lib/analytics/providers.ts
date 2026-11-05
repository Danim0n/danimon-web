import type { SafeEvent } from './events';

export interface Provider {
  capture(event: SafeEvent): void;
  stop(): void;
}

/** Importing this module does not import, initialize or contact PostHog. */
export async function posthogProvider(key: string, identity: string, allowed: () => boolean): Promise<Provider | null> {
  const { default: posthog } = await import('posthog-js/no-external');
  if (!allowed()) return null;
  const instance = posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    capture_exceptions: false,
    capture_dead_clicks: false,
    rageclick: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_surveys_automatic_display: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    person_profiles: 'never',
    persistence: 'memory',
    disable_persistence: true,
    save_referrer: false,
    save_campaign_params: false,
    disable_scroll_properties: true,
    cross_subdomain_cookie: false,
    respect_dnt: true,
    ip: false,
    request_batching: false,
    api_transport: 'fetch',
    bootstrap: { distinctID: identity, isIdentifiedID: false },
    before_send(event) {
      if (!allowed() || event.event.startsWith('$')) return null;
      // capture() supplies ONLY an already validated envelope. Drop ALL SDK metadata.
      const envelope = event.properties.portfolio_safe as SafeEvent | undefined;
      if (!envelope || envelope.name !== event.event) return null;
      return {
        uuid: event.uuid, event: envelope.name, timestamp: event.timestamp,
        properties: {
          ...envelope.properties, token: key, distinct_id: identity, $session_id: identity,
          $process_person_profile: false, $geoip_disable: true, $ip: null,
        },
      };
    },
  }, 'portfolio_' + crypto.randomUUID().replaceAll('-', ''));
  if (!instance) return null;
  return {
    capture(event) {
      if (allowed()) instance.capture(event.name, { portfolio_safe: event }, { transport: 'sendBeacon' });
    },
    stop() {
      instance.opt_out_capturing();
      instance.stopSessionRecording();
      instance.reset();
      instance.clear_opt_in_out_capturing();
      instance.set_config({ disable_persistence: true });
    },
  };
}

export interface CloudflareHandle { stop(): void }
export function hasCloudflareBeacon(): boolean {
  return !!document.querySelector('script[src*="static.cloudflareinsights.com/beacon"],script[data-cf-beacon]');
}
export function safeCloudflareDocument(): boolean {
  if (location.search || location.hash) return false;
  const paths = ['/', '/es/', '/projects/local-events/', '/es/proyectos/eventos/',
    '/demo/facturas/', '/es/demo/facturas/', '/privacy/', '/es/privacidad/', '/cookies/', '/es/cookies/'];
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

