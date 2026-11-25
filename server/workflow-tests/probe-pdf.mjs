import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseQuoteText } from '../lib/quoteParser.js';

for (const f of ['tests/fixtures/test-audit-quote.pdf', 'tests/fixtures/test-audit-air-filter-quote.pdf']) {
  const data = new Uint8Array(readFileSync(f));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).filter(Boolean).join(' ') + '\n';
  }
  console.log('===', f, '| pages:', pdf.numPages, '| chars:', text.trim().length);
  console.log(text.trim().slice(0, 900));
  const r = parseQuoteText(text);
  console.log('parse success:', r.success, '| confidence:', r.confidence, '| reason:', r.reason || '-', '| total:', r.result?.quote_total_inc_gst ?? r.quote_total_inc_gst ?? '-');
  console.log();
}
