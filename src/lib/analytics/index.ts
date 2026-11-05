import { pageContext, validateEvent, type EventName, type EventProperties } from './events';
import { validCounter, type CounterEvent, type CounterName } from './catalog';
import { cloudflareProvider, safeCloudflareDocument } from './providers';

const mode = import.meta.env.PUBLIC_ANALYTICS_MODE ?? 'off';
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const origin = import.meta.env.PUBLIC_COUNTERS_ORIGIN ?? 'https://danimon.party';
const enabled = (mode === 'test' && local) || (mode === 'production' && location.origin === origin && location.protocol === 'https:');
const seen = new Set<string>();
const previous = new Map<string, number>();
const context = pageContext();
const direct: Partial<Record<EventName, CounterName>> = {
  cv_download_clicked: 'cv_download_clicked', linkedin_clicked: 'linkedin_clicked',
  project_detail_viewed: 'project_detail_viewed', project_media_opened: 'project_media_opened',
  project_video_started: 'project_video_started', project_video_completed: 'project_video_completed',
  animation_paused: 'animation_paused', animation_resumed: 'animation_resumed',
  webgl_initialization_failed: 'webgl_failed', graphics_fallback_activated: 'graphics_fallback',
  frontend_error_detected: 'frontend_error',
};
export function interactionsAllowed() {
  return enabled && navigator.doNotTrack !== '1' &&
    !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
}
export function count(counter: CounterName, project: CounterEvent['project'] = 'none', once = false) {
  if (!interactionsAllowed() || ('prerendering' in document && document.prerendering)) return;
  const event: CounterEvent = { page: context.page_id, language: context.language, counter, project };
  if (!validCounter(event)) return;
  const signature = counter + '/' + project;
  if (once && seen.has(signature)) return;
  const now = performance.now();
  if (now - (previous.get(signature) ?? -Infinity) < 500) return;
  seen.add(signature);
  previous.set(signature, now);
  // No persistent queue, retry token, visitor identifier or cookie.
  void fetch('/api/interactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([event]), credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
  }).catch(() => {});
}
export function trackEvent<N extends EventName>(name: N, properties: EventProperties[N]) {
  const safe = validateEvent(name, properties);
  if (!safe) return;
  const project = typeof safe.project_id === 'string' ? safe.project_id as CounterEvent['project'] : 'none';
  if (direct[name]) { count(direct[name]!, project); return; }
  if (name === 'project_opened') {
    count(safe.action === 'details' ? 'project_details_revealed' : project === 'invoice-reader' ? 'project_demo_clicked' : 'project_opened', project, safe.action === 'details');
  } else if (name === 'language_changed') {
    count(safe.target_language === 'en' ? 'language_en_selected' : 'language_es_selected');
  } else if (name === 'contact_clicked') {
    const methods: Record<string, CounterName> = { chooser: 'contact_chooser_opened', gmail: 'email_gmail_clicked', outlook: 'email_outlook_clicked', 'email-app': 'email_app_clicked' };
    count(methods[String(safe.method)]);
  } else if (name === 'email_copy_clicked') {
    count(safe.result === 'copied' ? 'email_copy_succeeded' : 'email_copy_selected');
  } else if (name === 'scroll_depth_reached') {
    count(('scroll_' + safe.percent + '_reached') as CounterName, 'none', true);
  } else if (name === 'active_time_milestone') {
    count(('active_' + safe.seconds + '_seconds') as CounterName, 'none', true);
  } else if (name === 'section_viewed') {
    const id = safe.section_id === 'invoice-feature' ? 'invoice' : safe.section_id;
    count(('section_' + id + '_viewed') as CounterName, 'none', true);
  }
}
export function trackOnce<N extends EventName>(name: N, properties: EventProperties[N]) {
  const signature = name + JSON.stringify(properties);
  if (!interactionsAllowed() || seen.has(signature) || !validateEvent(name, properties)) return;
  seen.add(signature);
  trackEvent(name, properties);
}
export function initializeAnalytics() {
  if (document.documentElement.hasAttribute('data-counter-initialized')) return;
  document.documentElement.dataset.counterInitialized = 'true';
  // Delete only keys owned by the superseded integration; never inspect their values.
  try { localStorage.removeItem('danimon.analytics.consent.v1'); } catch {}
  try { sessionStorage.removeItem('danimon.analytics.session.v1'); } catch {}
  const token = import.meta.env.PUBLIC_CLOUDFLARE_TOKEN ?? '';
  if (mode === 'production' && interactionsAllowed() && safeCloudflareDocument() &&
      import.meta.env.PUBLIC_CLOUDFLARE_MANUAL_AUDITED === 'true' &&
      import.meta.env.PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED === 'true' && /^[a-f0-9]{32}$/.test(token))
    cloudflareProvider(token);
}
