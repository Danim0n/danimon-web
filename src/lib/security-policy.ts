// Shared by generated static headers and the Pages Worker; no runtime network calls.
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  // Host only: deliberately excludes includeSubDomains and preload.
  'Strict-Transport-Security': 'max-age=2592000',
};

// Functions return empty API responses or the fixed PDF, never executable HTML.
export const inertResponseCsp = "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
