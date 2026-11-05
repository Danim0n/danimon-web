import { clearOptionalSession, CONSENT_KEY, CONSENT_LIFETIME, privacySignal, readConsent, sessionIdentity, writeConsent, type Consent } from './consent';
import { pageContext, validateEvent, type EventName, type EventProperties, type SafeEvent } from './events';
import { cloudflareProvider, hasCloudflareBeacon, posthogProvider, safeCloudflareDocument, type CloudflareHandle, type Provider } from './providers';

const mode = import.meta.env.PUBLIC_ANALYTICS_MODE ?? 'off';
const testMode = mode === 'test' && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
const production = mode === 'production' && location.protocol === 'https:' && location.hostname === 'danimon.party';
const key = import.meta.env.PUBLIC_POSTHOG_KEY ?? '';
const token = import.meta.env.PUBLIC_CLOUDFLARE_TOKEN ?? '';
// An explicit deployment audit is required: automatic beacons cannot be consent-gated here.
const cfReady = import.meta.env.PUBLIC_CLOUDFLARE_MANUAL_AUDITED === 'true';
const enabled = testMode || production;
let consent: Consent | null = readConsent();
let provider: Provider | null = null;
let posthogLoaded = false;
let identity = '';
let cf: CloudflareHandle | null = null;
let generation = 0;
let pageSent = false;
const once = new Set<string>();
const lastEvent = new Map<string, number>();
type Status = 'off' | 'ready' | 'loading' | 'blocked' | 'unconfigured';
let status: Status = enabled ? 'unconfigured' : 'off';
const context = pageContext();
const controller = new AbortController();
const subscriptions = new Set<(active: boolean) => void>();
const testEvents: SafeEvent[] = [];
const testState = { events: testEvents, loads: 0, stops: 0, cloudflareLoads: 0, cloudflareDuplicate: false,
  delay: 0, fail: false, reloadRequired: false, realSdk: false };

export function interactionsAllowed() {
  return enabled && !privacySignal() && consent?.interactions === true && Date.now() - consent.updatedAt < CONSENT_LIFETIME;
}
export function currentPreferences() {
  return { consent, signal: privacySignal(), enabled, status };
}
export function onAnalyticsChange(callback: (active: boolean) => void) {
  subscriptions.add(callback);
  callback(interactionsAllowed() && provider !== null);
  return () => subscriptions.delete(callback);
}
function notify() {
  subscriptions.forEach(callback => callback(interactionsAllowed() && provider !== null));
  window.dispatchEvent(new CustomEvent('portfolio:privacy-state'));
}
function stopPosthog(clearIdentity = true) {
  provider?.stop();
  provider = null;
  if (clearIdentity) clearOptionalSession();
  identity = '';
  pageSent = false;
  once.clear();
  lastEvent.clear();
}

/** Public typed entry point. No queue is kept before consent or while loading. */
export function trackEvent<N extends EventName>(name: N, properties: EventProperties[N]): void {
  if (!interactionsAllowed() || !provider || !readCurrentDecision()) return;
  const safe = validateEvent(name, properties);
  if (!safe) return;
  if ((!testMode || testState.realSdk) && sessionIdentity() !== identity) {
    stopPosthog(false);
    void reconcile();
    return;
  }
  // Deliberate controls can repeat, but never at pointer/frame frequency.
  const signature = name + JSON.stringify(safe);
  const time = performance.now();
  if (time - (lastEvent.get(signature) ?? -Infinity) < 750) return;
  lastEvent.set(signature, time);
  try { provider.capture({ name, properties: { ...context, ...safe } }); } catch { /* Navigation never depends on analytics. */ }
}
function readCurrentDecision() {
  // Observe withdrawal in another tab even before the storage event is dispatched.
  const saved = readConsent();
  if (saved && consent && (saved.updatedAt !== consent.updatedAt || saved.web !== consent.web || saved.interactions !== consent.interactions)) {
    consent = saved;
    if (!saved.interactions) { stopPosthog(); return false; }
  }
  return !privacySignal();
}
export function trackOnce<N extends EventName>(name: N, properties: EventProperties[N]) {
  if (!interactionsAllowed() || !provider) return;
  const id = name + JSON.stringify(properties);
  if (once.has(id) || !validateEvent(name, properties)) return;
  once.add(id);
  trackEvent(name, properties);
}

async function reconcile() {
  const run = provider && interactionsAllowed() ? generation : ++generation;
  const allow = () => run === generation && interactionsAllowed();
  if (!interactionsAllowed()) {
    stopPosthog();
    status = enabled ? 'ready' : 'off';
    // Reload a real page to terminate SDK listeners and any pending transport retries.
    if (production && posthogLoaded) { location.reload(); return; }
  } else if (!provider) {
    status = 'loading';
    notify();
    try {
      let candidate: Provider | null = null;
      if (testMode && !testState.realSdk) {
        testState.loads++;
        if (testState.delay) await new Promise(resolve => setTimeout(resolve, Math.min(testState.delay, 10000)));
        if (testState.fail) throw new Error('test provider blocked');
        if (allow()) candidate = {
          capture(event) { if (interactionsAllowed()) testEvents.push(structuredClone(event)); },
          stop() { testState.stops++; },
        };
      } else if (testMode || /^phc_[A-Za-z0-9_-]{10,200}$/.test(key)) {
        identity = sessionIdentity();
        candidate = await posthogProvider(testMode ? 'phc_LOCAL_TEST_ONLY_NOT_A_REAL_PROJECT' : key, identity, allow);
      }
      if (!allow()) { candidate?.stop(); return; }
      provider = candidate;
      if (candidate && !testMode) posthogLoaded = true;
      status = candidate ? 'ready' : 'unconfigured';
    } catch { if (run === generation) status = 'blocked'; }
  }
  if (run !== generation) return;
  if (enabled && consent?.web && !privacySignal() && !cf) {
    if (testMode) {
      testState.cloudflareDuplicate = hasCloudflareBeacon();
      if (!testState.cloudflareDuplicate) { testState.cloudflareLoads++; cf = { stop() {} }; }
    } else if (cfReady && /^[a-f0-9]{32}$/.test(token) && safeCloudflareDocument()) {
      cf = cloudflareProvider(token);
    }
  } else if ((!consent?.web || privacySignal()) && cf) {
    cf.stop();
    cf = null;
    // The beacon has no supported teardown. Reload after revocation to remove its listeners.
    if (testMode) testState.reloadRequired = true;
    else location.reload();
  }
  if (provider && !pageSent) {
    pageSent = true;
    trackEvent('page_viewed', {});
    if (context.page_id === 'local-events') trackOnce('project_detail_viewed', { project_id: 'local-events' });
    if (context.page_id === 'invoice-reader') trackOnce('project_detail_viewed', { project_id: 'invoice-reader' });
  }
  notify();
}
export function savePreferences(web: boolean, interactions: boolean) {
  consent = writeConsent(privacySignal() ? false : web, privacySignal() ? false : interactions);
  // Synchronously close the gate before any asynchronous provider work.
  if (!consent.interactions) stopPosthog();
  void reconcile();
}
export function withdrawConsent() { savePreferences(false, false); }
export function initializeAnalytics() {
  if (document.documentElement.hasAttribute('data-analytics-initialized')) return;
  document.documentElement.dataset.analyticsInitialized = 'true';
  if (testMode) Object.defineProperty(window, '__analyticsTest', { value: {
    ...testState,
    get events() { return testEvents; },
    get state() { return { ...testState, ...currentPreferences(), providerReady: !!provider }; },
    setDelay(value: number) { testState.delay = value; },
    setFailure(value: boolean) { testState.fail = value; },
    useRealSdk() { testState.realSdk = true; },
    track: trackEvent, save: savePreferences, withdraw: withdrawConsent,
    clear() { testEvents.length = 0; },
  } });
  window.addEventListener('storage', event => {
    if (event.key === CONSENT_KEY || event.key === null) {
      consent = readConsent();
      void reconcile();
    }
  }, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => {
    const saved = readConsent();
    if (saved?.updatedAt !== consent?.updatedAt) { consent = saved; void reconcile(); }
  }, { signal: controller.signal });
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { generation++; stopPosthog(false); controller.abort(); }
  }, { signal: controller.signal });
  void reconcile();
}
