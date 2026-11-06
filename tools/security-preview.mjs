import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { builtAssets } from './serve-built-assets.mjs';

const port=Number(process.env.SECURITY_PREVIEW_PORT || 4325);
const directory=process.env.SECURITY_PREVIEW_DIR || 'dist';
const reportOnly=process.env.SECURITY_CSP_REPORT_ONLY === 'true';
await mkdir('output/qa/security-audit',{recursive:true});
const persist=await mkdtemp(resolve('output/qa/security-audit/d1-local-'));
const runtime=new Miniflare({...convertV4MiniflareOptions({
  modules:true,scriptPath:'output/pages-worker/index.js',compatibilityDate:'2026-08-06',
  host:'127.0.0.1',port,d1Databases:['COUNTERS'],d1Persist:persist,
  bindings:{PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,COUNTERS_ENABLED:'true'},
  serviceBindings:{ASSETS:await builtAssets(directory,{reportOnly})},
}),resourcePersistencePath:persist});
const db=await runtime.getD1Database('COUNTERS');
await db.prepare(await readFile('migrations/0001_counters.sql','utf8')).run();
console.log(`Security QA: ${await runtime.ready}, CSP ${reportOnly?'Report-Only':'enforced'}, isolated local D1.`);
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await runtime.dispose();process.exit(0);});
