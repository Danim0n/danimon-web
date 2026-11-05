import { interactionsAllowed, onAnalyticsChange, trackEvent, trackOnce } from './index';
import { pageContext, projectIds, type Experience, type ProjectId, type Source } from './events';

const projectRoutes: Record<string, ProjectId> = {
  '/projects/local-events/': 'local-events', '/es/proyectos/eventos/': 'local-events',
  '/demo/facturas/': 'invoice-reader', '/es/demo/facturas/': 'invoice-reader',
};
const counts = new Map<Experience, number>();
const lastControl = new Map<string, number>();
export function recordInteraction(experience: Experience, control: 'drag' | 'flip' | 'read' | 'cancel' | 'source' | 'save' | 'export' | 'clear') {
  if (!interactionsAllowed()) return;
  const id = experience + control;
  if (performance.now() - (lastControl.get(id) ?? -Infinity) < 1000) return;
  lastControl.set(id, performance.now());
  trackOnce('interactive_experience_started', { experience });
  trackEvent('interactive_control_used', { experience, control });
  if (experience === 'project-carousel') {
    trackOnce('3d_first_interaction', { experience });
    const count = (counts.get(experience) ?? 0) + 1;
    counts.set(experience, count);
    if (count === 5 || count === 10) trackOnce('3d_interaction_milestone', { experience, count });
  }
}
export function recordProjectDetails(index: number) {
  const project = projectIds[index];
  if (!project) return;
  trackOnce('project_opened', { project_id: project, source: 'carousel', action: 'details' });
  recordInteraction('project-carousel', 'flip');
}
function linkSource(element: Element): Source {
  if (element.closest('.portfolio-appbar')) return 'appbar';
  if (element.closest('.case-shortcut')) return 'case-shortcut';
  if (element.closest('#invoice-feature')) return 'invoice-feature';
  if (element.closest('.projects-wheel')) return 'carousel';
  if (element.closest('.mail-options')) return 'email-options';
  if (element.closest('.profile-dock')) return 'profile';
  return 'inline';
}
export function startInstrumentation() {
  if (document.documentElement.hasAttribute('data-analytics-instrumented')) return;
  document.documentElement.dataset.analyticsInstrumented = 'true';
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  const root = document.querySelector<HTMLElement>('.portfolio-scrollport');
  const scroller = root ?? document.documentElement;
  let observer: IntersectionObserver | null = null;
  let seconds = 0;
  let lastTick = performance.now();
  let lastActivity = performance.now();
  let active = false;
  let scrollScheduled = false;

  function scrollDepth() {
    scrollScheduled = false;
    if (!active) return;
    const distance = scroller.scrollHeight - scroller.clientHeight;
    if (distance <= 0) return;
    const percent = Math.min(100, (scroller.scrollTop / distance) * 100);
    for (const milestone of [25, 50, 75, 100] as const)
      if (percent >= (milestone === 100 ? 99 : milestone)) trackOnce('scroll_depth_reached', { percent: milestone });
  }
  function observeSections() {
    observer?.disconnect();
    if (!active) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        if (['main', 'projects', 'stack', 'about', 'invoice-feature'].includes(id))
          trackOnce('section_viewed', { section_id: id as 'main' | 'projects' | 'stack' | 'about' | 'invoice-feature' });
      }
    }, { root, rootMargin: '-8% 0px -35% 0px', threshold: 0.05 });
    document.querySelectorAll('#main,#projects,#stack,#about,#invoice-feature').forEach(section => observer!.observe(section));
  }
  onAnalyticsChange(enabled => {
    if (active === enabled) return;
    active = enabled;
    seconds = 0;
    lastTick = lastActivity = performance.now();
    counts.clear();
    lastControl.clear();
    observeSections();
    if (active) scrollDepth();
  });
  const timer = window.setInterval(() => {
    const now = performance.now();
    if (active && !document.hidden && document.hasFocus() && now - lastActivity <= 60000)
      seconds += Math.min(2, (now - lastTick) / 1000);
    lastTick = now;
    for (const milestone of [30, 60, 180] as const)
      if (active && seconds >= milestone) trackOnce('active_time_milestone', { seconds: milestone });
  }, 1000);
  function activity() { lastActivity = performance.now(); }
  document.addEventListener('pointerdown', activity, options);
  document.addEventListener('keydown', activity, options);
  (root ?? window).addEventListener('scroll', () => {
    activity();
    if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(scrollDepth); }
  }, { ...options, passive: true });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link) return;
    const source = linkSource(link);
    if (link.closest('.language-bar')) {
      const language = link.lang;
      if ((language === 'en' || language === 'es') && language !== pageContext().language)
        trackEvent('language_changed', { target_language: language });
      return;
    }
    if (link.matches('.cv-download')) { trackEvent('cv_download_clicked', { source: 'profile' }); return; }
    if (link.matches('.email')) { trackEvent('contact_clicked', { source: 'profile', method: 'chooser' }); return; }
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin) {
      const project = projectRoutes[url.pathname];
      if (project && url.pathname !== location.pathname) trackEvent('project_opened', { project_id: project, source, action: 'navigate' });
    } else if (url.protocol === 'https:' || url.protocol === 'http:') {
      const destination = url.hostname === 'www.linkedin.com' || url.hostname === 'linkedin.com' ? 'linkedin'
        : url.hostname === 'mail.google.com' ? 'gmail' : url.hostname === 'outlook.live.com' ? 'outlook' : 'other';
      trackEvent('external_link_clicked', { destination, source });
      if (destination === 'linkedin') trackEvent('linkedin_clicked', { source: 'profile' });
      if (destination === 'gmail' || destination === 'outlook')
        trackEvent('contact_clicked', { source: 'email-options', method: destination });
    } else if (url.protocol === 'mailto:') trackEvent('contact_clicked', { source: 'email-options', method: 'email-app' });
  }, options);
  window.addEventListener('error', () => trackOnce('frontend_error_detected', { kind: 'runtime' }), options);
  window.addEventListener('unhandledrejection', () => trackOnce('frontend_error_detected', { kind: 'promise' }), options);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { observer?.disconnect(); clearInterval(timer); lifecycle.abort(); }
  }, options);
}
