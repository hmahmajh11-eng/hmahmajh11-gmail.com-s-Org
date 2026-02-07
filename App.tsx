
import React, { useState, useCallback } from 'react';
import { 
  FileUp, 
  Download, 
  Loader2, 
  Table as TableIcon, 
  AlertCircle, 
  Trash2, 
  CheckCircle2,
  FileText,
  Files,
  X,
  Scan
} from 'lucide-react';
import { ExtractionStatus, ExtractedItem, FileData } from './types';
import { extractDataFromDocument } from './services/geminiService';
import { downloadAsExcel } from './utils/excelUtils';
import { extractTextFromPdf, performImageOcr } from './utils/ocrUtils';

interface FileDataExtended extends FileData {
  ocrStatus?: 'idle' | 'running' | 'done' | 'skipped' | 'error';
}

const App: React.FC = () => {
  const [files, setFiles] = useState<FileDataExtended[]>([]);
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [data, setData] = useState<ExtractedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  const [isOcrEnabled, setIsOcrEnabled] = useState<boolean>(true);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const fileArray = Array.from(selectedFiles) as File[];

    fileArray.forEach((selectedFile) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const fileData: FileDataExtended = {
          id: Math.random().toString(36).substr(2, 9),
          base64,
          mimeType: selectedFile.type,
          name: selectedFile.name,
          status: 'pending',
          ocrStatus: 'idle'
        };
        setFiles(prev => [...prev, fileData]);
      };
      reader.readAsDataURL(selectedFile);
    });
    
    setError(null);
    setStatus(ExtractionStatus.IDLE);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (files.length <= 1) {
      setData([]);
      setStatus(ExtractionStatus.IDLE);
    }
  };

  const processBatch = async () => {
    if (files.length === 0) return;

    setStatus(ExtractionStatus.PROCESSING);
    setError(null);
    const allExtractedData: ExtractedItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

      try {
        let ocrText = '';
        if (isOcrEnabled) {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, ocrStatus: 'running' } : f));
          
          try {
            if (files[i].mimeType === 'application/pdf') {
              ocrText = await extractTextFromPdf(files[i].base64);
            } else if (files[i].mimeType.startsWith('image/')) {
              ocrText = await performImageOcr(files[i].base64, files[i].mimeType);
            }
            setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, ocrStatus: 'done' } : f));
          } catch (ocrErr) {
            console.warn('OCR Step Failed, continuing with visual analysis only:', ocrErr);
            setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, ocrStatus: 'error' } : f));
          }
        } else {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, ocrStatus: 'skipped' } : f));
        }

        const result = await extractDataFromDocument(files[i].base64, files[i].mimeType, ocrText);
        
        const rowsWithMetadata = result.extracted_data.map(item => ({
          ...item,
          'Source_File': files[i].name
        }));
        
        allExtractedData.push(...rowsWithMetadata);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'completed' } : f));
      } catch (err: any) {
        console.error(`Error processing ${files[i].name}:`, err);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error' } : f));
      }
    }

    setData(allExtractedData);
    setStatus(ExtractionStatus.SUCCESS);
    setCurrentFileIndex(-1);
  };

  const reset = () => {
    setFiles([]);
    setData([]);
    setStatus(ExtractionStatus.IDLE);
    setError(null);
    setCurrentFileIndex(-1);
  };

  const headers = data.length > 0 
    ? Array.from(new Set(['Source_File', ...Object.keys(data[0]).filter(k => k !== 'Source_File')])) 
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-sm shadow-blue-200">
              <FileText className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">DocuExtract Pro</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 mr-4 bg-slate-100 p-1.5 rounded-lg border border-slate-200 group transition-all hover:border-blue-200">
               <span className={`text-[10px] font-bold px-1 transition-colors ${isOcrEnabled ? 'text-blue-600' : 'text-slate-400'}`}>OCR ENGINE</span>
               <button 
                onClick={() => setIsOcrEnabled(!isOcrEnabled)}
                className={`w-10 h-5 rounded-full relative transition-all shadow-inner ${isOcrEnabled ? 'bg-blue-500' : 'bg-slate-300'}`}
               >
                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isOcrEnabled ? 'left-6' : 'left-1'}`} />
               </button>
            </div>

            {files.length > 0 && status !== ExtractionStatus.PROCESSING && (
               <button
               onClick={reset}
               className="flex items-center gap-2 text-slate-500 hover:text-red-500 px-3 py-2 rounded-lg font-medium transition-all"
             >
               <Trash2 size={18} />
               Clear
             </button>
            )}
            {data.length > 0 && (
              <button
                onClick={() => downloadAsExcel(data, `Batch_Extraction_${new Date().toISOString().split('T')[0]}.xlsx`)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md active:shadow-sm"
              >
                <Download size={18} />
                Export
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Files size={20} className="text-blue-500" />
                Document Queue
              </h2>
              
              <div className="relative group mb-6">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  accept="image/*,.pdf"
                  multiple
                />
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center group-hover:border-blue-400 transition-colors bg-slate-50 group-hover:bg-blue-50/30">
                  <div className="mx-auto w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <FileUp size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Drop or Add Files</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">PDF, PNG, JPG, WEBP</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {files.map((file, idx) => (
                  <div 
                    key={file.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      idx === currentFileIndex 
                        ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' 
                        : file.status === 'completed' 
                        ? 'bg-green-50/50 border-green-100'
                        : file.status === 'error'
                        ? 'bg-red-50 border-red-100'
                        : 'bg-white border-slate-100 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {file.status === 'processing' ? (
                        <div className="relative">
                           <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />
                           {file.ocrStatus === 'running' && (
                             <Scan size={10} className="absolute inset-0 m-auto text-blue-700" />
                           )}
                        </div>
                      ) : file.status === 'completed' ? (
                        <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                      ) : file.status === 'error' ? (
                        <AlertCircle size={18} className="text-red-500 shrink-0" />
                      ) : (
                        <FileText size={18} className="text-slate-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                        <div className="flex items-center gap-2">
                           <p className="text-[10px] text-slate-400 uppercase font-mono">{file.mimeType.split('/')[1]}</p>
                           {file.ocrStatus === 'running' && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded animate-pulse font-bold tracking-tighter">OCR PHASE</span>}
                           {file.ocrStatus === 'done' && <span className="text-[9px] text-green-600 font-bold flex items-center gap-0.5 tracking-tighter"><Scan size={8}/> OCR READY</span>}
                           {file.ocrStatus === 'error' && <span className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5 tracking-tighter"><AlertCircle size={8}/> OCR FAILED</span>}
                        </div>
                      </div>
                    </div>
                    {status !== ExtractionStatus.PROCESSING && (
                      <button 
                        onClick={() => removeFile(file.id)}
                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors rounded"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {files.length === 0 && (
                  <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Files className="mx-auto w-8 h-8 text-slate-300 mb-2 opacity-50" />
                    <p className="text-slate-400 text-sm italic">Queue is currently empty</p>
                  </div>
                )}
              </div>

              {files.length > 0 && status !== ExtractionStatus.PROCESSING && (
                <button
                  onClick={processBatch}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group"
                >
                  <Scan size={18} className="group-hover:rotate-12 transition-transform" />
                  Extract from {files.length} {files.length === 1 ? 'Doc' : 'Docs'}
                </button>
              )}

              {status === ExtractionStatus.PROCESSING && (
                <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs font-bold text-blue-600 uppercase tracking-wide">
                    <span>{files[currentFileIndex]?.ocrStatus === 'running' ? 'Running OCR Engine...' : 'Gemini AI Analysis...'}</span>
                    <span>{currentFileIndex + 1} / {files.length}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      style={{ width: `${((currentFileIndex + (files[currentFileIndex]?.ocrStatus === 'running' ? 0.3 : 0.8)) / files.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-center text-slate-400 italic">
                    Reading: {files[currentFileIndex]?.name}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-900 text-slate-300 p-6 rounded-2xl shadow-xl">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Scan size={18} className="text-blue-400" />
                OCR Enhancement
              </h3>
              <p className="text-xs mb-4 text-slate-400 leading-relaxed">
                By integrating a dedicated OCR library, we extract text layers from digital PDFs and perform deep scans on images before AI analysis.
              </p>
              <ul className="text-[11px] space-y-2 list-none text-slate-300">
                <li className="flex items-start gap-2">
                   <CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" />
                   <span>Resolves ambiguities in blurry dates & numbers.</span>
                </li>
                <li className="flex items-start gap-2">
                   <CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" />
                   <span>Extracts invisible text metadata from PDFs.</span>
                </li>
                <li className="flex items-start gap-2">
                   <CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" />
                   <span>Perfect spelling for handwritten or unique names.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TableIcon size={20} className="text-slate-500" />
                  Consolidated Spreadsheet
                </h2>
                {data.length > 0 && (
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 uppercase">
                    {data.length} Extracted Rows
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto bg-slate-50/30">
                {status === ExtractionStatus.IDLE && files.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400">
                    <div className="w-16 h-16 bg-white rounded-2xl border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
                      <TableIcon size={32} strokeWidth={1.2} className="opacity-30" />
                    </div>
                    <p className="text-lg font-medium text-slate-600">Queue is empty</p>
                    <p className="text-sm max-w-xs text-center">Add documents to start the multi-stage OCR and extraction process.</p>
                  </div>
                )}

                {status === ExtractionStatus.PROCESSING && data.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center p-12 space-y-5">
                    <div className="relative p-4 bg-white rounded-full shadow-lg border border-slate-100">
                      <Loader2 size={48} className="animate-spin text-blue-500" />
                      <Scan size={24} className="absolute inset-0 m-auto text-blue-600 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800">Advanced Data Extraction</p>
                      <p className="text-sm text-slate-500 font-medium">Running Tesseract OCR & Gemini AI Vision...</p>
                    </div>
                  </div>
                )}

                {data.length > 0 ? (
                  <div className="overflow-x-auto relative">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {headers.map(header => (
                            <th key={header} className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap text-[10px] bg-slate-50/95 backdrop-blur-sm">
                              {header.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                            {headers.map(header => (
                              <td key={`${idx}-${header}`} className="px-6 py-4 text-slate-600 whitespace-nowrap text-[13px]">
                                {header === 'Source_File' ? (
                                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                                    <FileText size={14} className="text-blue-500 opacity-60" />
                                    {row[header]}
                                  </div>
                                ) : (
                                  row[header] === 'N/A' || row[header] === null ? (
                                    <span className="text-slate-300 italic opacity-60">N/A</span>
                                  ) : (
                                    row[header]
                                  )
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default App;
