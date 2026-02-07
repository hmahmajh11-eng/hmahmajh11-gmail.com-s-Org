
import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Scan,
  Camera,
  RotateCcw,
  Check
} from 'lucide-react';
import { ExtractionStatus, ExtractedItem, FileData } from './types';
import { extractDataFromDocument } from './services/geminiService';
import { downloadAsExcel } from './utils/excelUtils';
import { extractTextFromPdf, performImageOcr } from './utils/ocrUtils';

interface FileDataExtended extends FileData {
  ocrStatus?: 'idle' | 'running' | 'done' | 'skipped' | 'error';
}

const CameraModal: React.FC<{
  onCapture: (base64: string) => void;
  onClose: () => void;
}> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDevice, setCurrentDevice] = useState<string>('');

  useEffect(() => {
    const initCamera = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        
        // Prefer back camera on mobile
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back')) || videoDevices[0];
        if (backCamera) setCurrentDevice(backCamera.deviceId);

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: backCamera ? { exact: backCamera.deviceId } : undefined,
            facingMode: backCamera ? undefined : 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        setStream(newStream);
        if (videoRef.current) videoRef.current.srcObject = newStream;
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    initCamera();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const switchCamera = async () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === currentDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    setCurrentDevice(nextDevice.deviceId);

    stream?.getTracks().forEach(track => track.stop());
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: nextDevice.deviceId } }
    });
    setStream(newStream);
    if (videoRef.current) videoRef.current.srcObject = newStream;
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(base64);
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage.split(',')[1]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 aspect-[3/4] sm:aspect-video flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-colors"
        >
          <X size={20} />
        </button>

        {!capturedImage ? (
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Scanning overlay */}
            <div className="absolute inset-0 border-[2px] border-white/20 m-12 rounded-xl flex items-center justify-center pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
              <div className="w-full h-[2px] bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan" />
            </div>
            
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6 px-4">
              {devices.length > 1 && (
                <button 
                  onClick={switchCamera}
                  className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
                >
                  <RotateCcw size={24} />
                </button>
              )}
              <button 
                onClick={capture}
                className="w-16 h-16 bg-white rounded-full border-[4px] border-blue-500/50 flex items-center justify-center group active:scale-95 transition-all shadow-lg"
              >
                <div className="w-12 h-12 bg-white rounded-full border-[2px] border-slate-200 group-hover:bg-slate-50 transition-colors" />
              </button>
              <div className="w-14" /> {/* Spacer to center the capture button if switch exists */}
            </div>
          </div>
        ) : (
          <div className="relative flex-1 bg-black flex flex-col items-center justify-center">
            <img src={capturedImage} className="w-full h-full object-contain" alt="Captured document" />
            <div className="absolute bottom-8 flex gap-4">
              <button 
                onClick={() => setCapturedImage(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 transition-all shadow-lg"
              >
                <RotateCcw size={18} />
                Retake
              </button>
              <button 
                onClick={confirmCapture}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-semibold flex items-center gap-2 transition-all shadow-lg"
              >
                <Check size={18} />
                Use Photo
              </button>
            </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      
      <p className="mt-4 text-white/60 text-sm font-medium">Position your document within the frame</p>

      <style>{`
        @keyframes scan {
          0% { top: 10%; }
          100% { top: 90%; }
        }
        .animate-scan {
          position: absolute;
          animation: scan 3s linear infinite alternate;
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [files, setFiles] = useState<FileDataExtended[]>([]);
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [data, setData] = useState<ExtractedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  const [isOcrEnabled, setIsOcrEnabled] = useState<boolean>(true);
  const [showCamera, setShowCamera] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const fileArray = Array.from(selectedFiles) as File[];

    fileArray.forEach((selectedFile) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        addFileToQueue(base64, selectedFile.type, selectedFile.name);
      };
      reader.readAsDataURL(selectedFile);
    });
    
    setError(null);
    setStatus(ExtractionStatus.IDLE);
  };

  const addFileToQueue = (base64: string, mimeType: string, name: string) => {
    const fileData: FileDataExtended = {
      id: Math.random().toString(36).substr(2, 9),
      base64,
      mimeType,
      name,
      status: 'pending',
      ocrStatus: 'idle'
    };
    setFiles(prev => [...prev, fileData]);
    setError(null);
    setStatus(ExtractionStatus.IDLE);
  };

  const handleCameraCapture = (base64: string) => {
    const timestamp = new Date().toLocaleTimeString().replace(/:/g, '-');
    addFileToQueue(base64, 'image/jpeg', `Camera_Scan_${timestamp}.jpg`);
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
      {showCamera && (
        <CameraModal 
          onCapture={handleCameraCapture} 
          onClose={() => setShowCamera(false)} 
        />
      )}

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
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="relative group">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    accept="image/*,.pdf"
                    multiple
                  />
                  <div className="h-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-center group-hover:border-blue-400 transition-all bg-slate-50 group-hover:bg-blue-50/30">
                    <div className="mx-auto w-8 h-8 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <FileUp size={16} />
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Upload Files</p>
                  </div>
                </div>

                <button 
                  onClick={() => setShowCamera(true)}
                  className="group h-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-blue-400 transition-all bg-slate-50 hover:bg-blue-50/30"
                >
                  <div className="mx-auto w-8 h-8 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Camera size={16} />
                  </div>
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Scan via Camera</p>
                </button>
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
                    <p className="text-sm max-w-xs text-center">Add documents or scan via camera to start the multi-stage OCR and extraction process.</p>
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
