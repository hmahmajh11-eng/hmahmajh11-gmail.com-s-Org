
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a precise Data Extraction Specialist. Your goal is to analyze uploaded files (images, PDFs, documents) and extract specific information with 100% accuracy for spreadsheet organization.

Task:
1. Analyze the provided document thoroughly.
2. Identify key data points such as dates, names, amounts, invoice numbers, or any recurring table data.
3. Handle "unstructured" text by categorizing it into the most logical column headers.
4. If data is missing or illegible, return "N/A" for that field.

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
  mimeType: string
): Promise<ExtractionResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "Extract all structured information from this document as per your instructions.",
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      // Note: responseSchema is omitted here because dynamic column headers (keys) 
      // are not easily defined in a fixed schema where Type.OBJECT requires non-empty properties.
      // Gemini 3 Flash is highly proficient at following the prompt's JSON structure.
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  
  try {
    // Basic sanitization in case the model wraps JSON in markdown blocks despite instructions
    const jsonString = text.trim().replace(/^```json\s*|```$/g, '');
    return JSON.parse(jsonString) as ExtractionResponse;
  } catch (error) {
    console.error("Failed to parse JSON response:", text);
    throw new Error("Invalid response format from AI. Please try again with a clearer document.");
  }
};
