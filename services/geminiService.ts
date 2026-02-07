
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a high-precision Data Extraction Specialist with advanced expertise in reconstructing complex table structures from unstructured documents. Your primary goal is to transform visual and OCR data into clean, structured business records.

CRITICAL RULES FOR COMPLEX TABLE PARSING:
1. SPATIAL ALIGNMENT: Analyze the visual layout. Use text alignment to identify columns.
2. MULTI-LINE ROW RECONSTRUCTION: Intelligently group multi-line text fragments (e.g., long descriptions) into a single logical row.
3. HEADER DETECTION: Identify table headers even if abbreviated.
4. CROSS-COLUMN VALIDATION: Verify mathematical relationships (Qty * Price = Total) to ensure extraction accuracy.
5. EXHAUSTIVE EXTRACTION: Extract EVERY row found in the document.
6. DENORMALIZATION: Repeat global headers (Date, Vendor, Invoice #) in every line-item row.
7. IGNORE NOISE: Skip page numbers and decorative elements.

BUSINESS DATA FOCUS:
Prioritize Product Codes/SKUs, Names/Descriptions, Quantities, Units, Prices, and Totals.

JSON STRUCTURE:
Return ONLY a JSON object with this exact structure:
{
  "extracted_data": [
    {
      "Reference": "Value",
      "Description": "Value",
      "Quantity": "Value",
      "Unit_Price": "Value",
      "Total": "Value"
    }
  ]
}

Do not provide any preamble or markdown formatting. Just the raw JSON.
`;

export const extractDataFromDocument = async (
  base64Data: string,
  mimeType: string,
  ocrText?: string
): Promise<ExtractionResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("Gemini API Key is missing. Please check your environment variables.");
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

  if (ocrText && ocrText.trim()) {
    parts.push({
      text: `SUPPLEMENTAL OCR TEXT:\n\n${ocrText}`
    });
  }

  parts.push({
    text: "MANDATORY: Extract all business records and product line items. Ensure multi-line descriptions are merged correctly. Return strictly valid JSON.",
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("The AI returned an empty response.");
    
    // Clean up potential markdown blocks
    const jsonString = text.trim().replace(/^```json\s*|```$/g, '');
    const parsed = JSON.parse(jsonString);
    
    if (!parsed.extracted_data || !Array.isArray(parsed.extracted_data)) {
      throw new Error("Invalid response format: 'extracted_data' array missing.");
    }

    return parsed as ExtractionResponse;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "An unexpected error occurred during data extraction.");
  }
};
