
export interface ExtractedItem {
  [key: string]: string | number | null;
}

export interface ExtractionResponse {
  extracted_data: ExtractedItem[];
}

export interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

export enum ExtractionStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
