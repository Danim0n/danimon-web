// Inert, bounded production verification. Never sends a valid counter event or a PDF GET.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origins=['https://danimon.party','https://danimon-web.pages.dev'];
const rows=[];
for (const origin of origins) {
  for (const [path,status] of [['/',200],['/es/',200],['/demo/facturas/',200],
    ['/cv/daniel-rosell-martin.pdf',200],['/api/interactions',405],['/api/stats',404],['/security-check-not-found/',404]]) {
    const response=await fetch(origin+path,{method:'HEAD',signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,status);
    assert.equal(response.headers.has('set-cookie'),false);
    rows.push({url:origin+path,method:'HEAD',status:response.status,headers:Object.fromEntries(response.headers)});
  }
  for (const [name,headers,body,status] of [
    ['foreign origin',{Origin:'https://example.invalid','Content-Type':'application/json'},'[]',403],
    ['invalid JSON',{Origin:origin,'Content-Type':'application/json'},'{',400],
    ['closed schema',{Origin:origin,'Content-Type':'application/json'},'[{"unknown":"security-fixture"}]',400],
  ]) {
    const response=await fetch(origin+'/api/interactions',{method:'POST',headers,body,signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,status);
    assert.equal((await response.text()).length,0);
    assert.equal(response.headers.has('access-control-allow-origin'),false);
    assert.equal(response.headers.get('cache-control'),'no-store');
    rows.push({url:origin+'/api/interactions',name,method:'POST',status:response.status,headers:Object.fromEntries(response.headers)});
  }
}
await mkdir('output/qa/security-audit',{recursive:true});
await writeFile('output/qa/security-audit/public-checks.json',JSON.stringify({at:new Date().toISOString(),rows},null,2));
console.log(`${rows.length} bounded public checks passed; no valid event, PDF GET, scan or load test sent.`);
