import {extractInvoice, type OcrPage} from './extract';

export type OcrProgress = {status:string; progress:number};

/**
 * Small adapter to the bundled, pinned Tesseract.js 7 worker protocol.
 * Owning the Worker directly also releases it if initial model loading fails,
 * times out or is cancelled. No CDN defaults and no persistent model database.
 */
export async function readSample(onProgress:(progress:OcrProgress)=>void, signal:AbortSignal) {
  signal.throwIfAborted();
  const worker = new Worker('/invoice-ocr/worker.min.js');
  const pending = new Map<string,{resolve:(data:unknown)=>void; reject:(error:Error)=>void}>();
  let sequence = 0;
  const fail = (error:Error) => {
    for (const job of pending.values()) job.reject(error);
    pending.clear();
  };
  const onAbort = () => {worker.terminate(); fail(new DOMException('Reading cancelled','AbortError'));};
  signal.addEventListener('abort',onAbort,{once:true});
  worker.onerror = () => fail(new Error('OCR worker failed'));
  worker.onmessageerror = () => fail(new Error('Invalid OCR worker response'));
  worker.onmessage = ({data:message}) => {
    if (message.status === 'progress') {
      const {status,progress} = message.data as OcrProgress;
      onProgress({status,progress:Math.max(0,Math.min(1,progress))});
      return;
    }
    const job = pending.get(message.jobId);
    if (!job) return;
    pending.delete(message.jobId);
    if (message.status === 'resolve') job.resolve(message.data);
    else job.reject(new Error(String(message.data)));
  };
  const send = <T>(action:string,payload:unknown):Promise<T> => {
    signal.throwIfAborted();
    const jobId = `invoice-${++sequence}`;
    return new Promise<T>((resolve,reject) => {
      pending.set(jobId,{resolve:data=>resolve(data as T),reject});
      worker.postMessage({workerId:'invoice-demo',jobId,action,payload});
    });
  };
  const timeout = window.setTimeout(()=>{worker.terminate();fail(new Error('OCR timeout'));},120_000);
  try {
    const response = await fetch('/invoice-demo/factura-ficticia.png',{signal});
    if (!response.ok) throw new Error(`Invoice image unavailable: ${response.status}`);
    const image = new Uint8Array(await response.arrayBuffer());
    const localAssets = new URL('/invoice-ocr/',window.location.href).href;
    await send('load',{options:{lstmOnly:true,corePath:localAssets,logging:false}});
    await send('loadLanguage',{langs:'eng',options:{langPath:localAssets,cacheMethod:'none',gzip:true,lstmOnly:true}});
    await send('initialize',{langs:'eng',oem:1,config:{}});
    await send('setParameters',{params:{tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'150'}});
    const page = await send<OcrPage>('recognize',{image,options:{},output:{text:true,blocks:true}});
    return extractInvoice(page);
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener('abort',onAbort);
    worker.terminate();
    pending.clear();
  }
}
