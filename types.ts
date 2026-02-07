
export interface ExtractedItem {
  [key: string]: string | number | null;
}

export interface ExtractionResponse {
  extracted_data: ExtractedItem[];
}

export interface FileData {
  id: string;
  base64: string;
  mimeType: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export enum ExtractionStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
