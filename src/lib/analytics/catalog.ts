export const projects = ['none', 'local-events', 'automation-backend', 'portfolio', 'invoice-reader'] as const;
export const pages = ['home', 'local-events', 'invoice-reader', 'privacy', 'cookies', 'not-found', 'cv-document'] as const;
export const counters = [
  'cv_download_clicked', 'cv_response_served', 'linkedin_clicked', 'github_clicked', 'professional_link_clicked',
  'contact_chooser_opened', 'email_gmail_clicked', 'email_outlook_clicked', 'email_app_clicked',
  'email_copy_succeeded', 'email_copy_selected', 'project_opened', 'project_details_revealed',
  'project_detail_viewed', 'project_demo_clicked', 'project_repository_clicked',
  'project_media_opened', 'project_video_started', 'project_video_completed',
  'navigation_main_clicked', 'navigation_projects_clicked', 'navigation_stack_clicked', 'navigation_about_clicked',
  'language_en_selected', 'language_es_selected',
  'section_main_viewed', 'section_projects_viewed', 'section_stack_viewed', 'section_about_viewed', 'section_invoice_viewed',
  'carousel_dragged', 'invoice_read_started', 'invoice_read_cancelled', 'invoice_source_viewed',
  'invoice_review_saved', 'invoice_result_export_clicked', 'invoice_review_cleared',
  'scroll_25_reached', 'scroll_50_reached', 'scroll_75_reached', 'scroll_100_reached',
  'active_30_seconds', 'active_60_seconds', 'active_180_seconds',
  'animation_paused', 'animation_resumed', 'webgl_failed', 'graphics_fallback', 'frontend_error',
] as const;
export type CounterName = typeof counters[number];
export type ProjectId = Exclude<typeof projects[number], 'none'>;
export type PageId = typeof pages[number];
export interface CounterEvent {
  page: PageId;
  language: 'en' | 'es';
  counter: CounterName;
  project: typeof projects[number];
}
export function validCounter(value: unknown, server = false): value is CounterEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'counter,language,page,project') return false;
  if (!(pages as readonly unknown[]).includes(data.page) || !['en', 'es'].includes(data.language as string) ||
      !(counters as readonly unknown[]).includes(data.counter) || !(projects as readonly unknown[]).includes(data.project)) return false;
  if (!server && data.counter === 'cv_response_served') return false;
  if (!server && data.page === 'cv-document') return false;
  const projectCounter = /^project_/.test(data.counter as string);
  if (projectCounter) return data.project !== 'none';
  if ((data.counter as string).startsWith('invoice_')) return data.project === 'invoice-reader';
  return data.project === 'none';
}
