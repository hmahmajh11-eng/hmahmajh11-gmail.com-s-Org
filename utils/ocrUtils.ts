
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Setup PDF.js worker using a compatible CDN source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extracts text from a PDF file using its built-in text layer.
 */
export const extractTextFromPdf = async (base64: string): Promise<string> => {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return fullText;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '';
  }
};

/**
 * Performs OCR on an image file using Tesseract.js.
 */
export const performImageOcr = async (base64: string, mimeType: string): Promise<string> => {
  try {
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const result = await Tesseract.recognize(dataUrl, 'eng');
    return result.data.text;
  } catch (error) {
    console.error('Error performing OCR:', error);
    return '';
  }
};
