/** Field values and rectangles come exclusively from the worker's recognised text. */
export type InvoiceField = 'supplier' | 'date' | 'total';
export type Box = {x0:number; y0:number; x1:number; y1:number};
export type Word = {text:string; confidence:number; bbox:Box};
export type Line = Word & {words:Word[]};
export type OcrPage = {text:string; confidence:number; blocks?:{paragraphs:{lines:Line[]}[]}[]};
export type Evidence = {text:string; value:string; confidence:number; bbox:Box};
export type ExtractedInvoice = {
  text:string;
  confidence:number;
  currency:'EUR'|null;
  fields:Record<InvoiceField,Evidence|null>;
};

function evidence(line:Line, text:string, value=text):Evidence {
  const words = line.words.filter(word => text.includes(word.text.trim()) || word.text.trim().includes(text));
  const boxes = words.length ? words.map(word => word.bbox) : [line.bbox];
  return {
    text, value,
    confidence:Math.round(words.length ? words.reduce((sum,word) => sum + word.confidence,0) / words.length : line.confidence),
    bbox:{x0:Math.min(...boxes.map(box=>box.x0)), y0:Math.min(...boxes.map(box=>box.y0)), x1:Math.max(...boxes.map(box=>box.x1)), y1:Math.max(...boxes.map(box=>box.y1))},
  };
}

export function extractInvoice(page:OcrPage):ExtractedInvoice {
  const lines = (page.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines));
  const fields:ExtractedInvoice['fields'] = {supplier:null,date:null,total:null};
  const marker = lines.findIndex(line => /PROVEEDOR|SUPPLIER/i.test(line.text));
  if (marker >= 0 && lines[marker+1]) {
    const line = lines[marker+1];
    if (line.bbox.y0 > lines[marker].bbox.y0 && line.text.trim()) fields.supplier = evidence(line,line.text.trim());
  }
  for (const line of lines) {
    const date = line.text.match(/\b(\d{2})[/.\-](\d{2})[/.\-](\d{4})\b/);
    if (!fields.date && date) {
      const [,day,month,year] = date;
      const iso = `${year}-${month}-${day}`;
      const parsed = new Date(`${iso}T00:00:00Z`);
      if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === iso) fields.date = evidence(line,date[0],iso);
    }
    if (/^\s*TOTAL\b/i.test(line.text)) {
      const amount = line.text.match(/\b\d{1,3}(?:[. ]\d{3})*,\d{2}\b|\b\d+[.,]\d{2}\b/);
      if (amount) {
        const normalized = amount[0].includes(',') ? amount[0].replace(/[. ]/g,'').replace(',','.') : amount[0];
        if (Number.isFinite(Number(normalized))) fields.total = evidence(line,amount[0],Number(normalized).toFixed(2));
      }
    }
  }
  const totalLine = lines.find(line => /^\s*TOTAL\b/i.test(line.text));
  return {text:page.text, confidence:page.confidence, currency:totalLine && /\bEUR\b|€/.test(totalLine.text) ? 'EUR' : null, fields};
}
