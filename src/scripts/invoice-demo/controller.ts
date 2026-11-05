import { recordInteraction } from '../../lib/analytics/instrument';
import { trackOnce } from '../../lib/analytics';
import {invoiceCopy, type InvoiceLanguage} from './copy';
import type {ExtractedInvoice, InvoiceField, Evidence} from './extract';

const STORAGE_KEY = 'danimon.invoice-demo.review.v1';
const fields:InvoiceField[] = ['supplier','date','total'];
type Values = Record<InvoiceField,string>;
type Review = {
  schema:'invoice-demo/v1'; document:'fictional-invoice-fn-2026-042';
  savedAt:string; reviewed:{supplier:string;date:string;total:number;currency:'EUR'|null};
  ocr:ExtractedInvoice; corrections:{field:InvoiceField;original:string|null;reviewed:string}[];
};

function initialise(root:HTMLElement) {
  if (root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const lang:InvoiceLanguage = root.dataset.lang === 'es' ? 'es' : 'en';
  const t = invoiceCopy[lang];
  const get = <T extends HTMLElement>(selector:string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Invoice control missing: ${selector}`);
    return element;
  };
  const start = get<HTMLButtonElement>('[data-start]');
  const cancel = get<HTMLButtonElement>('[data-cancel]');
  const status = get<HTMLElement>('[data-status]');
  const progress = get<HTMLProgressElement>('[data-progress]');
  const form = get<HTMLFormElement>('[data-review-form]');
  const fieldset = get<HTMLFieldSetElement>('[data-fields]');
  const save = get<HTMLButtonElement>('[data-save]');
  const download = get<HTMLButtonElement>('[data-download]');
  const clear = get<HTMLButtonElement>('[data-clear]');
  const highlight = get<HTMLElement>('[data-highlight]');
  const sourceExcerpt = get<HTMLElement>('[data-source-excerpt]');
  const raw = get<HTMLElement>('[data-raw-ocr]');
  const inputs = Object.fromEntries(fields.map(field=>[field,get<HTMLInputElement>(`[name=${field}]`)])) as Record<InvoiceField,HTMLInputElement>;
  const sourceButtons = Object.fromEntries(fields.map(field=>[field,get<HTMLButtonElement>(`[data-source=${field}]`)])) as Record<InvoiceField,HTMLButtonElement>;
  const lifecycle = new AbortController();
  const eventOptions = {signal:lifecycle.signal};
  let result:ExtractedInvoice|null = null;
  let active:AbortController|null = null;
  let hasRead = false;
  let selected:InvoiceField|null = null;
  let downloadUrl:string|null = null;
  let revokeTimer:number|undefined;
  let lastPercentage = -1;

  function announce(message:string,error=false) {
    status.textContent = message;
    status.toggleAttribute('data-error',error);
  }
  function values():Values {return {supplier:inputs.supplier.value.trim(),date:inputs.date.value,total:inputs.total.value};}
  function updateFieldStates() {
    for (const field of fields) {
      const original = result?.fields[field]?.value ?? '';
      const current = inputs[field].value;
      const same = field === 'total' && current && original ? Number(current) === Number(original) : current === original;
      get<HTMLElement>(`[data-field-state=${field}]`).textContent = !current ? '' : same && result?.fields[field] ? t.unchanged : t.corrected;
    }
  }
  function setBusy(busy:boolean) {
    start.disabled = busy;
    start.textContent = busy ? t.working : hasRead ? t.retry : t.start;
    cancel.hidden = !busy;
    progress.hidden = !busy;
    fieldset.disabled = busy || !result;
    save.disabled = busy || !result;
    download.disabled = busy || !result;
    clear.disabled = busy;
    form.setAttribute('aria-busy',String(busy));
  }
  function selectSource(field:InvoiceField) {
    selected = field;
    for (const name of fields) sourceButtons[name].setAttribute('aria-pressed',String(name===field));
    const item = result?.fields[field];
    highlight.hidden = !item;
    if (!item) {sourceExcerpt.textContent = t.sourceMissing;return;}
    const {x0,y0,x1,y1} = item.bbox;
    // Coordinates use the actual 1000 × 1200 source image, not viewport pixels.
    highlight.style.left = `${Math.max(0,x0-7)/10}%`;
    highlight.style.top = `${Math.max(0,y0-7)/12}%`;
    highlight.style.width = `${Math.min(1000,x1-x0+14)/10}%`;
    highlight.style.height = `${Math.min(1200,y1-y0+14)/12}%`;
    sourceExcerpt.textContent = `${t.sourcePrefix}: “${item.text}” · ${t.confidence}: ${item.confidence}%.`;
  }
  function populate(ocr:ExtractedInvoice,reviewed?:Values) {
    result = ocr;
    for (const field of fields) inputs[field].value = reviewed?.[field] ?? ocr.fields[field]?.value ?? '';
    raw.textContent = ocr.text;
    setBusy(false);
    updateFieldStates();
    if (selected) selectSource(selected);
  }
  function review():Review|null {
    inputs.supplier.setCustomValidity(inputs.supplier.value.trim() ? '' : lang === 'es' ? 'Introduce el proveedor.' : 'Enter the supplier.');
    if (!result || !form.reportValidity()) return null;
    const current = values();
    return {
      schema:'invoice-demo/v1', document:'fictional-invoice-fn-2026-042', savedAt:new Date().toISOString(),
      reviewed:{supplier:current.supplier,date:current.date,total:Number(current.total),currency:result.currency},
      ocr:result,
      corrections:fields.filter(field => {
        const old = result?.fields[field]?.value;
        return field === 'total' && old ? Number(old) !== Number(current[field]) : old !== current[field];
      }).map(field=>({field,original:result?.fields[field]?.value ?? null,reviewed:current[field]})),
    };
  }
  // Validate this demo's own stored record; never inspect other storage keys.
  function validEvidence(item:unknown):item is Evidence|null {
    if (item === null) return true;
    if (!item || typeof item !== 'object') return false;
    const value = item as Evidence;
    return typeof value.text === 'string' && value.text.length < 500 && typeof value.value === 'string' && value.value.length < 150
      && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 100
      && !!value.bbox && ['x0','y0','x1','y1'].every(key=>Number.isFinite(value.bbox[key as keyof Evidence['bbox']]))
      && value.bbox.x0 >= 0 && value.bbox.x1 <= 1000 && value.bbox.y0 >= 0 && value.bbox.y1 <= 1200
      && value.bbox.x1 > value.bbox.x0 && value.bbox.y1 > value.bbox.y0;
  }
  function restore() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored || stored.length > 100_000) return;
      const value = JSON.parse(stored) as Review;
      if (value.schema !== 'invoice-demo/v1' || value.document !== 'fictional-invoice-fn-2026-042'
        || !value.reviewed || !value.ocr?.fields || typeof value.ocr.text !== 'string' || value.ocr.text.length > 20_000
        || typeof value.reviewed.supplier !== 'string' || !value.reviewed.supplier.trim() || value.reviewed.supplier.length > 120
        || typeof value.reviewed.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.reviewed.date)
        || !Number.isFinite(value.reviewed.total) || value.reviewed.total < 0 || value.reviewed.total > 999999999.99
        || !Number.isFinite(value.ocr.confidence) || !fields.every(field=>validEvidence(value.ocr.fields[field]))
        || ![null,'EUR'].includes(value.ocr.currency)) return;
      populate(value.ocr,{supplier:value.reviewed.supplier,date:value.reviewed.date,total:value.reviewed.total.toFixed(2)});
      clear.hidden = false;
      announce(t.restored);
    } catch { /* Restricted or invalid storage never blocks OCR or download. */ }
  }

  start.disabled = false;
  restore();
  start.addEventListener('click',async () => {
    if (active) return;
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {announce(t.unsupported,true);return;}
    recordInteraction('invoice-reader', 'read');
    const run = new AbortController();
    active = run;
    lastPercentage = -1;
    progress.value = 0;
    setBusy(true);
    announce(t.loading);
    try {
      const {readSample} = await import('./ocr');
      const extracted = await readSample(({status:stage,progress:amount})=>{
        if (run.signal.aborted) return;
        const percentage = Math.round(amount*100);
        if (stage === 'recognizing text') {
          progress.value = .4 + amount*.6;
          // Limit live-region updates while leaving progress continuous.
          if (Math.floor(percentage/20) !== lastPercentage) {
            lastPercentage = Math.floor(percentage/20);
            announce(`${t.recognizing}: ${percentage}%.`);
          }
        } else if (stage === 'loading language traineddata') {progress.value = .2 + amount*.2;announce(t.model);}
        else {progress.value = amount*.15;}
      },run.signal);
      if (run.signal.aborted) return;
      hasRead = true;
      populate(extracted);
      selectSource('supplier');
      announce(fields.every(field=>extracted.fields[field]) ? t.complete : t.missing);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') announce(t.cancelled);
      else {announce(t.error,true);hasRead = true;}
    } finally {
      if (active === run) {active = null;setBusy(false);}
    }
  },eventOptions);
  cancel.addEventListener('click',()=>{if(active)recordInteraction('invoice-reader','cancel');active?.abort();},eventOptions);
  for (const field of fields) {
    inputs[field].addEventListener('focus',()=>selectSource(field),eventOptions);
    inputs[field].addEventListener('input',()=>{inputs[field].setCustomValidity('');updateFieldStates();announce(t.edited);},eventOptions);
    sourceButtons[field].addEventListener('click',()=>{
      recordInteraction('invoice-reader','source');
      selectSource(field);
      if (window.matchMedia('(max-width:760px)').matches) get<HTMLElement>('#invoice-source').scrollIntoView({block:'center',behavior:'instant'});
    },eventOptions);
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const value = review();
    if (!value) return;
    try {
      localStorage.setItem(STORAGE_KEY,JSON.stringify(value));
      clear.hidden = false;
      announce(t.saved);
      recordInteraction('invoice-reader','save');
      trackOnce('interactive_experience_completed', { experience: 'invoice-reader', outcome: 'review-saved' });
    } catch {announce(t.saveError,true);}
  },eventOptions);
  download.addEventListener('click',()=>{
    const value = review();
    if (!value) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    window.clearTimeout(revokeTimer);
    downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'invoice-demo-reviewed.json';
    anchor.click();
    recordInteraction('invoice-reader','export');
    revokeTimer = window.setTimeout(()=>{if (downloadUrl) URL.revokeObjectURL(downloadUrl);downloadUrl=null;},10_000);
    announce(t.downloaded);
  },eventOptions);
  clear.addEventListener('click',()=>{
    try {localStorage.removeItem(STORAGE_KEY);recordInteraction('invoice-reader','clear');clear.hidden = true;announce(t.cleared);}
    catch {announce(t.saveError,true);}
  },eventOptions);
  window.addEventListener('pagehide',()=>{
    active?.abort();
    window.clearTimeout(revokeTimer);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  },eventOptions);
  document.addEventListener('astro:before-swap',()=>{
    active?.abort();lifecycle.abort();
    window.clearTimeout(revokeTimer);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  },{once:true,signal:lifecycle.signal});
}

document.querySelectorAll<HTMLElement>('[data-invoice-demo]').forEach(initialise);
document.addEventListener('astro:page-load',()=>document.querySelectorAll<HTMLElement>('[data-invoice-demo]').forEach(initialise));
