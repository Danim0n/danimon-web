export const projectIds = ['local-events', 'automation-backend', 'portfolio', 'invoice-reader'] as const;
export type ProjectId = typeof projectIds[number];
export type SectionId = 'main' | 'projects' | 'stack' | 'about' | 'invoice-feature';
export type Experience = 'project-carousel' | 'invoice-reader' | 'fluid-background';
export type Source = 'appbar' | 'carousel' | 'case-shortcut' | 'invoice-feature' | 'profile' | 'email-options' | 'inline' | 'direct';
type Project = { project_id: ProjectId; source: Source };
type Interactive = { experience: Experience };

export interface EventProperties {
  section_viewed: { section_id: SectionId };
  project_opened: Project & { action: 'details' | 'navigate' };
  project_detail_viewed: { project_id: ProjectId };
  project_media_opened: { project_id: ProjectId; media_type: 'image' | 'video' };
  project_video_started: { project_id: ProjectId };
  project_video_completed: { project_id: ProjectId };
  language_changed: { target_language: 'en' | 'es' };
  scroll_depth_reached: { percent: 25 | 50 | 75 | 100 };
  active_time_milestone: { seconds: 30 | 60 | 180 };
  cv_download_clicked: { source: 'profile' };
  linkedin_clicked: { source: 'profile' };
  contact_clicked: { source: 'profile' | 'email-options'; method: 'chooser' | 'gmail' | 'outlook' | 'email-app' };
  email_copy_clicked: { source: 'email-options'; result: 'copied' | 'selected' };
  animation_paused: Interactive & { reason: 'system-preference' };
  animation_resumed: Interactive & { reason: 'system-preference' };
  webgl_initialization_failed: { reason: 'unsupported' | 'program' | 'context-lost' };
  graphics_fallback_activated: { reason: 'unsupported' | 'program' | 'context-lost' };
  frontend_error_detected: { kind: 'runtime' | 'promise' };
}
export type EventName = keyof EventProperties;
export type SafeProperties = Record<string, string | number | boolean>;
export interface EventContext {
  page_id: 'home' | 'local-events' | 'invoice-reader' | 'privacy' | 'cookies' | 'not-found';
  language: 'en' | 'es';
}
export interface SafeEvent { name: EventName; properties: SafeProperties }

const projects = [...projectIds];
const sources = ['appbar', 'carousel', 'case-shortcut', 'invoice-feature', 'profile', 'email-options', 'inline', 'direct'];
const experiences = ['project-carousel', 'invoice-reader', 'fluid-background'];
type Rules = Record<string, readonly (string | number)[]>;
const rules: Record<EventName, Rules> = {
  section_viewed: { section_id: ['main', 'projects', 'stack', 'about', 'invoice-feature'] },
  project_opened: { project_id: projects, source: sources, action: ['details', 'navigate'] },
  project_detail_viewed: { project_id: projects },
  project_media_opened: { project_id: projects, media_type: ['image', 'video'] },
  project_video_started: { project_id: projects },
  project_video_completed: { project_id: projects },
  language_changed: { target_language: ['en', 'es'] },
  scroll_depth_reached: { percent: [25, 50, 75, 100] },
  active_time_milestone: { seconds: [30, 60, 180] },
  cv_download_clicked: { source: ['profile'] },
  linkedin_clicked: { source: ['profile'] },
  contact_clicked: { source: ['profile', 'email-options'], method: ['chooser', 'gmail', 'outlook', 'email-app'] },
  email_copy_clicked: { source: ['email-options'], result: ['copied', 'selected'] },
  animation_paused: { experience: experiences, reason: ['system-preference'] },
  animation_resumed: { experience: experiences, reason: ['system-preference'] },
  webgl_initialization_failed: { reason: ['unsupported', 'program', 'context-lost'] },
  graphics_fallback_activated: { reason: ['unsupported', 'program', 'context-lost'] },
  frontend_error_detected: { kind: ['runtime', 'promise'] },
};

/** Reject arbitrary keys and values, including visitor input and URL fragments. */
export function validateEvent(name: string, properties: unknown): SafeProperties | null {
  if (!Object.hasOwn(rules, name) || !properties || typeof properties !== 'object' || Array.isArray(properties)) return null;
  const spec = rules[name as EventName];
  const data = properties as Record<string, unknown>;
  if (Object.keys(data).length !== Object.keys(spec).length || Object.keys(data).some(key => !Object.hasOwn(spec, key))) return null;
  for (const [key, allowed] of Object.entries(spec)) {
    if (!Object.hasOwn(data, key) || !allowed.includes(data[key] as string | number)) return null;
  }
  return { ...data } as SafeProperties;
}

export function pageContext(): EventContext {
  const path = location.pathname;
  const known: Record<string, EventContext['page_id']> = {
    '/': 'home', '/es/': 'home',
    '/projects/local-events/': 'local-events', '/es/proyectos/eventos/': 'local-events',
    '/demo/facturas/': 'invoice-reader', '/es/demo/facturas/': 'invoice-reader',
    '/cookies/': 'cookies', '/es/cookies/': 'cookies',
  };
  return { page_id: known[path] ?? 'not-found', language: document.documentElement.lang === 'es' ? 'es' : 'en' };
}
