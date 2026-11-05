export const CONSENT_KEY = 'danimon.analytics.consent.v1';
export const SESSION_KEY = 'danimon.analytics.session.v1';
export const CONSENT_LIFETIME = 180 * 24 * 60 * 60 * 1000;
export interface Consent { version: 1; updatedAt: number; web: boolean; interactions: boolean }
let transientSession: { id: string; lastSeen: number } | null = null;
export function privacySignal(): boolean {
  return navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
export function readConsent(): Consent | null {
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null');
    if (value?.version !== 1 || typeof value.web !== 'boolean' || typeof value.interactions !== 'boolean' ||
        !Number.isFinite(value.updatedAt) || value.updatedAt > Date.now() || Date.now() - value.updatedAt >= CONSENT_LIFETIME) return null;
    return value;
  } catch { return null; }
}
export function writeConsent(web: boolean, interactions: boolean): Consent {
  const value: Consent = { version: 1, updatedAt: Date.now(), web, interactions };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(value)); } catch { /* Memory-only choice remains usable. */ }
  return value;
}
export function clearOptionalSession() {
  transientSession = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Restricted storage. */ }
}
/** UUIDv7 encodes the start time required by PostHog's session aggregation. */
function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = Date.now();
  for (let index = 5; index >= 0; index--) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }
  bytes[6] = (bytes[6] & 15) | 112;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
/** A random, per-tab session, renewed after 30 minutes idle. Only call after consent. */
export function sessionIdentity(): string {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    if (typeof value?.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.id) &&
        Number.isFinite(value.lastSeen) && Date.now() - value.lastSeen < 30 * 60 * 1000 && value.lastSeen <= Date.now()) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: value.id, lastSeen: Date.now() }));
      return value.id;
    }
    const id = newSessionId();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: Date.now() }));
    return id;
  } catch {
    if (!transientSession || Date.now() - transientSession.lastSeen >= 30 * 60 * 1000)
      transientSession = { id: newSessionId(), lastSeen: Date.now() };
    transientSession.lastSeen = Date.now();
    return transientSession.id;
  }
}
