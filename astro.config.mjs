import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { generateSecurityHeaders } from './tools/security-headers.mjs';
export default defineConfig({
  site:'https://danimon.party',output:'static',trailingSlash:'always',
  integrations:[{
    name:'security-response-headers',
    hooks:{'astro:build:done':async ({dir})=>{ await generateSecurityHeaders(fileURLToPath(dir)); }},
  }],
});
