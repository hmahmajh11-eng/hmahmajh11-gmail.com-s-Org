
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a high-speed Data Extraction Specialist. 
TASK: Convert the provided document into a structured JSON array of business line items.

EXTRACTION RULES:
1. TABULAR DATA: Identify columns (Product, Ref, Qty, Price, Total). 
2. ROW MERGING: Combine multi-line descriptions into a single row.
3. DATA ONLY: Extract business data (SKUs, Names, Quantities, Totals). Ignore file metadata.
4. FORMAT: Return ONLY a valid JSON object with the structure: {"extracted_data": [{"Field": "Value"}]}.
5. NO PREAMBLE: Do not explain your reasoning. Just output JSON.
`;

export const extractDataFromDocument = async (
  base64Data: string,
  mimeType: string,
  ocrText?: string
): Promise<ExtractionResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    }
  ];

  if (ocrText?.trim()) {
    parts.push({ text: `OCR CONTEXT: ${ocrText}` });
  }

  parts.push({ text: "Extract line items as JSON. Be fast and precise." });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0, // Lower temperature is faster and more deterministic
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    
    const jsonString = text.trim().replace(/^```json\s*|```$/g, '');
    const parsed = JSON.parse(jsonString);
    
    if (!parsed.extracted_data) throw new Error("Invalid structure");
    return parsed as ExtractionResponse;
  } catch (error: any) {
    console.error("Extraction failed:", error);
    throw new Error(error.message || "Extraction error");
  }
};
