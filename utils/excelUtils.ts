
import * as XLSX from 'xlsx';
import { ExtractedItem } from '../types';

export const downloadAsExcel = (data: ExtractedItem[], fileName: string = 'extracted_data.xlsx') => {
  if (data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  XLSX.writeFile(workbook, fileName);
};
