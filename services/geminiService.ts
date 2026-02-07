
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a high-precision Data Extraction Specialist with advanced expertise in reconstructing complex table structures from unstructured documents. Your primary goal is to transform visual and OCR data into clean, structured business records.

CRITICAL RULES FOR COMPLEX TABLE PARSING:
1. SPATIAL ALIGNMENT: Analyze the visual layout. Use the horizontal and vertical alignment of text to identify columns, even if grid lines are missing.
2. MULTI-LINE ROW RECONSTRUCTION: Some table rows wrap across multiple text lines (e.g., a long product description). You must intelligently group these fragments into a single row object. Do NOT split a single physical row into multiple JSON objects.
3. HEADER DETECTION: Correctively identify table headers even if they are abbreviated (e.g., 'Qty' for 'Quantity', 'Ref' for 'Reference').
4. CROSS-COLUMN VALIDATION: If the table contains mathematical relationships (e.g., Quantity * Unit Price = Line Total), use these to verify the accuracy of the extracted numbers. If there's a discrepancy, prioritize the visual data but ensure the output is logically consistent.
5. EXHAUSTIVE EXTRACTION: Extract EVERY row. If a document spans multiple pages with a continuous table, continue the extraction seamlessly.
6. DENORMALIZATION: Global document headers (Invoice Date, Vendor, Invoice #) MUST be repeated in every row of the line-item table for spreadsheet readiness.
7. IGNORE NOISE: Do not extract page numbers, decorative elements, or "continued on next page" markers as data rows.

BUSINESS DATA FOCUS:
Prioritize Product Codes/SKUs, Names/Descriptions, Quantities, Units, Prices, Discounts, and Totals.

JSON STRUCTURE:
Return ONLY a JSON object with this exact structure:
{
  "extracted_data": [
    {
      "Reference": "Value",
      "Description": "Value",
      "Quantity": "Value",
      "Unit_Price": "Value",
      "Total": "Value",
      ... (include relevant headers)
    }
  ]
}

If no table is found, extract the key-value pairs from the document into a single-row array.
Do not provide any preamble or markdown formatting. Just the raw JSON.
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
      text: `SUPPLEMENTAL OCR TEXT (Use this to verify visual strings, especially for small font table data):\n\n${ocrText}`
    });
  }

  parts.push({
    text: "MANDATORY: Perform deep analysis of any table structures. Ensure multi-line descriptions are correctly merged into their respective rows. Extract ALL product and financial line items without exception.",
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      {
        parts: parts,
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.1, // Near-zero temperature for maximum structural consistency
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  
  try {
    const jsonString = text.trim().replace(/^```json\s*|```$/g, '');
    return JSON.parse(jsonString) as ExtractionResponse;
  } catch (error) {
    console.error("Failed to parse JSON response:", text);
    throw new Error("The AI failed to reconstruct the document structure into a valid JSON format. This usually happens with extremely complex or low-quality scans.");
  }
};
