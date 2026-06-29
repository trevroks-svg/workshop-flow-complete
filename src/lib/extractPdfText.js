import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfText(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => item.str)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) pages.push(text);
  }

  return pages.join('\n').trim();
}

export async function extractPdfTextFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch PDF (${response.status})`);
  }

  const blob = await response.blob();
  return extractPdfText(blob);
}
