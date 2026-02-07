
import React, { useState, useCallback } from 'react';
import { 
  FileUp, 
  Download, 
  Loader2, 
  Table as TableIcon, 
  AlertCircle, 
  Trash2, 
  CheckCircle2,
  FileText
} from 'lucide-react';
import { ExtractionStatus, ExtractedItem, FileData } from './types';
import { extractDataFromDocument } from './services/geminiService';
import { downloadAsExcel } from './utils/excelUtils';

const App: React.FC = () => {
  const [file, setFile] = useState<FileData | null>(null);
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [data, setData] = useState<ExtractedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setFile({
        base64,
        mimeType: selectedFile.type,
        name: selectedFile.name
      });
      setError(null);
      setData([]);
      setStatus(ExtractionStatus.IDLE);
    };
    reader.readAsDataURL(selectedFile);
  };

  const processFile = async () => {
    if (!file) return;

    setStatus(ExtractionStatus.PROCESSING);
    setError(null);

    try {
      const result = await extractDataFromDocument(file.base64, file.mimeType);
      setData(result.extracted_data);
      setStatus(ExtractionStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to extract data. Please try again.");
      setStatus(ExtractionStatus.ERROR);
    }
  };

  const reset = () => {
    setFile(null);
    setData([]);
    setStatus(ExtractionStatus.IDLE);
    setError(null);
  };

  // Get unique keys for table headers
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">DocuExtract Pro</h1>
          </div>
          {data.length > 0 && (
            <button
              onClick={() => downloadAsExcel(data, `Extracted_${file?.name || 'Data'}.xlsx`)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm"
            >
              <Download size={18} />
              Export to Excel
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Upload & Preview */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileUp size={20} className="text-blue-500" />
                Upload Document
              </h2>
              
              {!file ? (
                <div className="relative group">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    accept="image/*,.pdf"
                  />
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center group-hover:border-blue-400 transition-colors bg-slate-50">
                    <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                      <FileUp size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-600">Click or drag document here</p>
                    <p className="text-xs text-slate-400 mt-1">Images or PDFs supported</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="text-blue-600 shrink-0" size={20} />
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 uppercase">{file.mimeType.split('/')[1]}</p>
                      </div>
                    </div>
                    <button 
                      onClick={reset}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {status === ExtractionStatus.IDLE && (
                    <button
                      onClick={processFile}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
                    >
                      Extract Data
                    </button>
                  )}

                  {status === ExtractionStatus.PROCESSING && (
                    <div className="flex items-center justify-center py-3 gap-3 text-blue-600 bg-blue-50 rounded-xl font-medium border border-blue-100">
                      <Loader2 size={20} className="animate-spin" />
                      Analyzing Document...
                    </div>
                  )}

                  {status === ExtractionStatus.SUCCESS && (
                    <div className="flex items-center justify-center py-3 gap-2 text-green-700 bg-green-50 rounded-xl font-medium border border-green-100">
                      <CheckCircle2 size={20} />
                      Extraction Complete
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700">
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-semibold">Processing Error</p>
                  <p className="text-xs opacity-90">{error}</p>
                </div>
              </div>
            )}

            <div className="bg-slate-800 text-slate-300 p-6 rounded-2xl shadow-lg">
              <h3 className="text-white font-semibold mb-3">Pro Tips</h3>
              <ul className="text-sm space-y-2 list-disc list-inside">
                <li>High resolution images work best.</li>
                <li>Ensure text is well-lit and legible.</li>
                <li>Multiple items are automatically listed in rows.</li>
                <li>Check the preview for any corrections.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Results Table */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TableIcon size={20} className="text-slate-500" />
                  Extraction Results
                </h2>
                {data.length > 0 && (
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                    {data.length} records found
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {status === ExtractionStatus.IDLE && !file && (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <TableIcon size={32} strokeWidth={1.5} />
                    </div>
                    <p className="text-lg font-medium">Ready for data</p>
                    <p className="text-sm">Upload a document to start extracting information.</p>
                  </div>
                )}

                {status === ExtractionStatus.PROCESSING && (
                  <div className="h-full flex flex-col items-center justify-center p-12 space-y-4">
                    <Loader2 size={40} className="animate-spin text-blue-500" />
                    <div className="text-center">
                      <p className="text-lg font-medium text-slate-700">Extracting Knowledge</p>
                      <p className="text-sm text-slate-400">The AI is mapping unstructured content to table fields...</p>
                    </div>
                  </div>
                )}

                {status === ExtractionStatus.SUCCESS && data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {headers.map(header => (
                            <th key={header} className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                              {header.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                            {headers.map(header => (
                              <td key={`${idx}-${header}`} className="px-6 py-4 text-slate-700 whitespace-nowrap">
                                {row[header] === 'N/A' || row[header] === null ? (
                                  <span className="text-slate-300 italic">N/A</span>
                                ) : (
                                  row[header]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : status === ExtractionStatus.SUCCESS && data.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400">
                    <p className="text-lg font-medium">No Data Extracted</p>
                    <p className="text-sm">The AI couldn't find structured fields in this document.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
