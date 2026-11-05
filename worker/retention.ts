import implementation from './index';
// Separate portfolio-only scheduled Worker; no public statistics endpoint.
export default {
  scheduled: implementation.scheduled,
  fetch() { return new Response(null, { status: 404 }); },
};
