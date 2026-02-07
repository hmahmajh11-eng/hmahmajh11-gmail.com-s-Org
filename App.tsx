
import React, { useState, useRef, useEffect } from 'react';
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
  Check,
  Settings2,
  Save,
  AlertTriangle,
  Briefcase,
  Zap
} from 'lucide-react';
import { ExtractionStatus, ExtractedItem, FileData } from './types';
import { extractDataFromDocument } from './services/geminiService';
import { downloadAsExcel } from './utils/excelUtils';
import { extractTextFromPdf, performImageOcr } from './utils/ocrUtils';

interface FileDataExtended extends FileData {
  ocrStatus?: 'idle' | 'running' | 'done' | 'skipped' | 'error';
}

const MappingModal: React.FC<{
  headers: string[];
  mapping: Record<string, string>;
  onSave: (newMapping: Record<string, string>) => void;
  onClose: () => void;
}> = ({ headers, mapping, onSave, onClose }) => {
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({ ...mapping });

  const handleChange = (original: string, updated: string) => {
    setLocalMapping(prev => ({ ...prev, [original]: updated }));
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings2 size={20} className="text-blue-500" />
              Column Mapping
            </h3>
            <p className="text-xs text-slate-500">Rename extracted headers for your final spreadsheet</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {headers.map(header => (
            <div key={header} className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Original: <span className="text-slate-600 font-mono lowercase">{header}</span>
              </label>
              <input
                type="text"
                value={localMapping[header] || header}
                onChange={(e) => handleChange(header, e.target.value)}
                placeholder={header}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-700"
              />
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(localMapping)}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 text-sm"
          >
            <Save size={18} />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = async (deviceId?: string) => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { ideal: deviceId } } 
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(err.message || "Could not access camera.");
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back')) || videoDevices[0];
        if (backCamera) setCurrentDevice(backCamera.deviceId);
        await startCamera(backCamera?.deviceId);
      } catch (err) {
        setCameraError("Failed to list camera devices.");
      }
    };
    init();
    return () => stream?.getTracks().forEach(track => track.stop());
  }, []);

  const switchCamera = async () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === currentDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    setCurrentDevice(nextDevice.deviceId);
    await startCamera(nextDevice.deviceId);
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
        <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md">
          <X size={20} />
        </button>
        {cameraError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <AlertTriangle size={32} className="text-red-500" />
            <h3 className="text-white text-lg font-bold">Camera Error</h3>
            <p className="text-slate-400 text-sm">{cameraError}</p>
            <button onClick={() => startCamera(currentDevice)} className="px-6 py-2 bg-blue-600 text-white rounded-full">Try Again</button>
          </div>
        ) : !capturedImage ? (
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6 px-4">
              {devices.length > 1 && (
                <button onClick={switchCamera} className="p-4 bg-white/10 text-white rounded-full backdrop-blur-md"><RotateCcw size={24} /></button>
              )}
              <button onClick={capture} className="w-16 h-16 bg-white rounded-full border-[4px] border-blue-500/50 flex items-center justify-center" />
              <div className="w-14" />
            </div>
          </div>
        ) : (
          <div className="relative flex-1 bg-black flex flex-col items-center justify-center">
            <img src={capturedImage} className="w-full h-full object-contain" alt="Captured" />
            <div className="absolute bottom-8 flex gap-4">
              <button onClick={() => setCapturedImage(null)} className="bg-slate-800 text-white px-6 py-3 rounded-full flex items-center gap-2"><RotateCcw size={18} /> Retake</button>
              <button onClick={confirmCapture} className="bg-blue-600 text-white px-8 py-3 rounded-full flex items-center gap-2"><Check size={18} /> Use Photo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [files, setFiles] = useState<FileDataExtended[]>([]);
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [data, setData] = useState<ExtractedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isOcrEnabled, setIsOcrEnabled] = useState<boolean>(false); // Disabled by default for speed
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);

  // Fix: Explicitly typing 'file' as 'File' to resolve TypeScript 'unknown' errors
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    Array.from(selectedFiles).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        addFileToQueue(base64, file.type, file.name);
      };
      reader.readAsDataURL(file);
    });
    setError(null);
    setStatus(ExtractionStatus.IDLE);
  };

  const addFileToQueue = (base64: string, mimeType: string, name: string) => {
    setFiles(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      base64,
      mimeType,
      name,
      status: 'pending',
      ocrStatus: 'idle'
    }]);
    setError(null);
  };

  const handleCameraCapture = (base64: string) => {
    const timestamp = new Date().toLocaleTimeString().replace(/:/g, '-');
    addFileToQueue(base64, 'image/jpeg', `Scan_${timestamp}.jpg`);
  };

  const processBatch = async () => {
    if (files.length === 0) return;
    setStatus(ExtractionStatus.PROCESSING);
    setError(null);

    // Run extractions in parallel for speed
    const extractionPromises = files.map(async (file, index) => {
      // Update local status to processing
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing' } : f));

      try {
        let ocrText = '';
        if (isOcrEnabled) {
          setFiles(prev => prev.map(f => f.id === file.id ? { ...f, ocrStatus: 'running' } : f));
          if (file.mimeType === 'application/pdf') {
            ocrText = await extractTextFromPdf(file.base64);
          } else if (file.mimeType.startsWith('image/')) {
            ocrText = await performImageOcr(file.base64, file.mimeType);
          }
          setFiles(prev => prev.map(f => f.id === file.id ? { ...f, ocrStatus: 'done' } : f));
        }

        const result = await extractDataFromDocument(file.base64, file.mimeType, ocrText);
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'completed' } : f));
        return result.extracted_data;
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error' } : f));
        return [];
      }
    });

    const results = await Promise.all(extractionPromises);
    const combinedData = results.flat();

    if (combinedData.length === 0 && files.length > 0) {
      setError("No data could be extracted. Please check the documents.");
      setStatus(ExtractionStatus.ERROR);
    } else {
      setData(combinedData);
      setStatus(ExtractionStatus.SUCCESS);
      
      if (combinedData.length > 0) {
        const keys = Object.keys(combinedData[0]);
        const initialMapping: Record<string, string> = {};
        keys.forEach(k => initialMapping[k] = k);
        setHeaderMapping(initialMapping);
      }
    }
  };

  const reset = () => {
    setFiles([]);
    setData([]);
    setStatus(ExtractionStatus.IDLE);
    setError(null);
    setHeaderMapping({});
  };

  const originalHeaders = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {showCamera && <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      {showMappingModal && (
        <MappingModal
          headers={originalHeaders}
          mapping={headerMapping}
          onSave={(newMapping) => { setHeaderMapping(newMapping); setShowMappingModal(false); }}
          onClose={() => setShowMappingModal(false)}
        />
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg"><Briefcase className="text-white w-5 h-5" /></div>
            <h1 className="text-xl font-bold text-slate-800">DocuExtract Pro</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 mr-4 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
               <span className={`text-[10px] font-bold px-1 ${isOcrEnabled ? 'text-blue-600' : 'text-slate-400'}`}>ADVANCED OCR</span>
               <button onClick={() => setIsOcrEnabled(!isOcrEnabled)} className={`w-10 h-5 rounded-full relative transition-all ${isOcrEnabled ? 'bg-blue-500' : 'bg-slate-300'}`}>
                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isOcrEnabled ? 'left-6' : 'left-1'}`} />
               </button>
            </div>
            {files.length > 0 && status !== ExtractionStatus.PROCESSING && (
               <button onClick={reset} className="text-slate-500 hover:text-red-500 px-3 py-2 rounded-lg font-medium transition-all"><Trash2 size={18} /></button>
            )}
            {data.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowMappingModal(true)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium border border-slate-200"><Settings2 size={18} /></button>
                <button onClick={() => downloadAsExcel(data)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium shadow-md flex items-center gap-2"><Download size={18} /> Export</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div className="flex-1"><p className="font-bold text-sm">Error</p><p className="text-xs">{error}</p></div>
            <button onClick={() => setError(null)}><X size={16} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Files size={20} className="text-blue-500" /> Document Queue</h2>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="relative h-24 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-all">
                  <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" accept="image/*,.pdf" multiple />
                  <FileUp size={16} className="mx-auto text-blue-500 mb-2" />
                  <p className="text-[11px] font-bold text-slate-600 uppercase">Upload</p>
                </div>
                <button onClick={() => setShowCamera(true)} className="h-24 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-all">
                  <Camera size={16} className="mx-auto text-blue-500 mb-2" />
                  <p className="text-[11px] font-bold text-slate-600 uppercase">Camera</p>
                </button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {files.map((file) => (
                  <div key={file.id} className={`flex items-center justify-between p-3 rounded-lg border ${file.status === 'processing' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      {file.status === 'processing' ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : file.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500" /> : file.status === 'error' ? <AlertCircle size={16} className="text-red-500" /> : <FileText size={16} className="text-slate-400" />}
                      <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                    </div>
                    {status !== ExtractionStatus.PROCESSING && <button onClick={() => setFiles(f => f.filter(x => x.id !== file.id))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>}
                  </div>
                ))}
              </div>

              {files.length > 0 && status !== ExtractionStatus.PROCESSING && (
                <button onClick={processBatch} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <Zap size={18} /> Parallel Extract
                </button>
              )}

              {status === ExtractionStatus.PROCESSING && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
                  <Loader2 size={24} className="animate-spin text-blue-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-blue-700 uppercase">Extracting {files.length} Docs in Parallel...</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-900 text-slate-300 p-6 rounded-2xl shadow-xl">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Zap size={18} className="text-yellow-400" /> High-Speed Mode</h3>
              <p className="text-[11px] leading-relaxed text-slate-400">Parallel processing & AI Vision enabled. Advanced OCR (slow) is disabled by default for 5x faster results.</p>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2"><TableIcon size={20} className="text-slate-500" /> Extracted Records</h2>
                {data.length > 0 && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{data.length} Rows</span>}
              </div>

              <div className="flex-1 overflow-auto bg-slate-50/30">
                {data.length > 0 ? (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-slate-200">
                        {originalHeaders.map(header => (
                          <th key={header} className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                            {headerMapping[header] || header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                          {originalHeaders.map(header => (
                            <td key={`${idx}-${header}`} className="px-6 py-4 text-slate-600 text-[13px] whitespace-nowrap">
                              {row[header] ?? <span className="text-slate-300">N/A</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400 text-center">
                    <TableIcon size={32} strokeWidth={1} className="opacity-20 mb-4" />
                    <p className="text-sm">Ready for high-speed extraction</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
