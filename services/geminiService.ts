
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a precise Data Extraction Specialist. Your goal is to analyze uploaded files (images, PDFs, documents) and extract specific information with 100% accuracy for spreadsheet organization.

Task:
1. Analyze the provided document thoroughly.
2. Identify key data points such as dates, names, amounts, invoice numbers, or any recurring table data.
3. Handle "unstructured" text by categorizing it into the most logical column headers.
4. If data is missing or illegible, return "N/A" for that field.

Supplemental Information:
You may be provided with an OCR (Optical Character Recognition) text layer extracted from the document. Use this text to verify and "anchor" your visual findings. If the visual quality is low but the OCR text is clear, prioritize the OCR text for spelling and exact numbers.

Output Format:
You must output the data ONLY in a valid JSON format. This allows the application to easily convert your response into an .xlsx file. Use the following structure:
{
  "extracted_data": [
    {
      "column_header_1": "value",
      "column_header_2": "value"
    }
  ]
}

Rules:
- Do not include any conversational text, pleasantries, or explanations.
- Only output the JSON block.
- Maintain the original data types (e.g., do not turn "100.00" into "one hundred").
- If multiple items exist (like line items on a receipt), create a separate object in the array for each item.
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
      text: `SUPPLEMENTAL OCR TEXT LAYER (FOR REFERENCE):\n\n${ocrText}`
    });
  }

  parts.push({
    text: "Extract all structured information from this document as per your instructions. Use the supplemental OCR text to improve accuracy if provided.",
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: parts,
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  
  try {
    const jsonString = text.trim().replace(/^```json\s*|```$/g, '');
    return JSON.parse(jsonString) as ExtractionResponse;
  } catch (error) {
    console.error("Failed to parse JSON response:", text);
    throw new Error("Invalid response format from AI. Please try again with a clearer document.");
  }
};
