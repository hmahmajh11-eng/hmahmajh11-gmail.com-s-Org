
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are an elite, high-precision Data Extraction Specialist. Your mission is to perform EXHAUSTIVE extraction from documents (invoices, receipts, forms, reports) with 100% fidelity.

CRITICAL RULES FOR EXTRACTION:
1. NO OMISSIONS: You must extract EVERY single data point found. If an invoice has 50 line items, you must produce 50 rows. Do not summarize or say "See original".
2. DENORMALIZATION: For spreadsheets, every row must be self-contained. If a document has "header" info (e.g., Invoice Number, Date, Vendor Name, Total Amount) and multiple "line items", you MUST include the header info in EVERY object in the "extracted_data" array.
3. EXACT TEXT: Transfer text exactly as it appears. Do not fix typos found in the document, do not reformat dates unless they are ambiguous, and do not change currency symbols.
4. UNSTRUCTURED DATA: If you find relevant information in the margins, footers, or notes, create logical columns for them (e.g., "Notes", "Terms_and_Conditions").
5. OCR FUSION: If supplemental OCR text is provided, use it to cross-reference and verify visual findings. If an image is blurry but the OCR text provides a clear string, use the OCR string for accuracy.
6. MISSING DATA: Use "N/A" only if a specific field is absolutely not present in the document.

JSON STRUCTURE:
Return ONLY a JSON object with this exact structure:
{
  "extracted_data": [
    {
      "Global_Header_1": "Value",
      "Line_Item_Field_A": "Value",
      "Line_Item_Field_B": "Value"
    },
    ...
  ]
}

Ensure all column keys are descriptive and use snake_case or PascalCase consistently.
Do not provide any preamble, markdown code blocks, or post-extraction commentary. Just the JSON.
`;

export const extractDataFromDocument = async (
  base64Data: string,
  mimeType: string,
  ocrText?: string
): Promise<ExtractionResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    }
  ];

  if (ocrText && ocrText.trim()) {
    parts.push({
      text: `SUPPLEMENTAL OCR TEXT LAYER (FOR REFERENCE AND VERIFICATION):\n\n${ocrText}`
    });
  }

  parts.push({
    text: "MANDATORY: Extract ALL data from this document. Do not leave out any details, line items, or small-print information. Denormalize all global headers into every row of the line items.",
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Upgraded to Pro for maximum extraction accuracy
    contents: [
      {
        parts: parts,
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.1, // Low temperature for high precision
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  
  try {
    // Robust cleaning of the response string
    const jsonString = text.trim().replace(/^```json\s*|```$/g, '');
    return JSON.parse(jsonString) as ExtractionResponse;
  } catch (error) {
    console.error("Failed to parse JSON response:", text);
    throw new Error("The AI failed to generate a valid structured response. Please try with a higher-quality image or different document.");
  }
};
