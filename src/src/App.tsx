import React, { useState, useEffect, useRef, MouseEvent, WheelEvent } from 'react';
import { UploadCloud, Download, Image as ImageIcon, Trash2, Scissors, CheckCircle2, X, ZoomIn } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface SplitImage {
  id: string;
  dataUrl: string;
}

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [splitImages, setSplitImages] = useState<SplitImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [selectedImage, setSelectedImage] = useState<SplitImage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (selectedImage) {
      setZoomScale(1);
      setPanPos({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedImage]);

  const handleWheel = (e: WheelEvent) => {
    if (!selectedImage) return;
    e.stopPropagation();
    
    // Zoom relative to center right now for simplicity, or pointer if we do complex math
    const delta = e.deltaY * -0.002;
    const newScale = Math.min(Math.max(1, zoomScale + delta), 10); // clamp 1x to 10x
    setZoomScale(newScale);
    
    // reset pan if scale is back to 1
    if (newScale === 1) {
      setPanPos({ x: 0, y: 0 });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoomScale > 1) {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || zoomScale === 1) return;
    
    const dx = e.clientX - lastPanPos.x;
    const dy = e.clientY - lastPanPos.y;
    
    setPanPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPanPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImageSrc(null);
    setSplitImages([]);
  };

  React.useEffect(() => {
    if (imageSrc) {
      splitImage(imageSrc, rows, cols);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, rows, cols]);

  const splitImage = (src: string, r: number, c: number) => {
    setIsProcessing(true);
    const img = new Image();
    img.onload = () => {
      const sliceWidth = img.width / c;
      const sliceHeight = img.height / r;
      const parts: SplitImage[] = [];

      const canvas = document.createElement('canvas');
      canvas.width = sliceWidth;
      canvas.height = sliceHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      for (let row = 0; row < r; row++) {
        for (let col = 0; col < c; col++) {
          ctx.clearRect(0, 0, sliceWidth, sliceHeight);
          ctx.drawImage(
            img,
            col * sliceWidth, row * sliceHeight, sliceWidth, sliceHeight,
            0, 0, sliceWidth, sliceHeight
          );
          
          parts.push({
            id: `part_${row}_${col}`,
            dataUrl: canvas.toDataURL('image/png')
          });
        }
      }

      setSplitImages(parts);
      setIsProcessing(false);
    };
    img.src = src;
  };

  const downloadZip = async () => {
    if (splitImages.length === 0 || !imageFile) return;
    
    const zip = new JSZip();
    const originalName = imageFile.name.replace(/\.[^/.]+$/, "");
    
    splitImages.forEach((part, index) => {
      const base64Data = part.dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
      zip.file(`${index + 1}.png`, base64Data, { base64: true });
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${originalName}_九宫格.zip`);
    } catch (e) {
      console.error(e);
      alert('打包下载失败');
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-slate-900 font-sans selection:bg-slate-200 selection:text-slate-900 overflow-x-hidden relative">
      {/* Decorative background blobs - Liquid Glass effect */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden z-0 min-w-[100vw]">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-200/40 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }}></div>
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-200/40 blur-[140px] animate-pulse" style={{ animationDuration: '14s' }}></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-sky-200/40 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }}></div>
      </div>

      <header className="bg-white/30 backdrop-blur-3xl border-b border-white/80 shadow-[0_4px_30px_rgb(0,0,0,0.03)] py-4 sm:py-5 px-4 sm:px-8 sticky top-0 z-20 text-center sm:text-left">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 relative">
          <div className="flex items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">九宫格提取器</h1>
              <p className="text-[13px] text-slate-500 font-medium mt-0.5">本地智能切片工具</p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-8 xl:px-12 py-6 sm:py-10 pb-20 relative z-10">
        {!imageSrc ? (
          <div className="max-w-3xl mx-auto w-full">
            <div 
              className={`mt-6 sm:mt-12 border border-white/70 rounded-[2rem] sm:rounded-[2.5rem] p-8 sm:p-12 flex flex-col items-center justify-center transition-all duration-500 cursor-pointer group min-h-[320px] sm:min-h-[400px] relative overflow-hidden backdrop-blur-2xl shadow-[0_8px_32px_rgba(148,163,184,0.15)]
              ${isDragging ? 'bg-white/60 scale-[1.02] shadow-2xl shadow-slate-900/5 ring-8 ring-slate-500/10' : 'bg-white/30 hover:bg-white/40 hover:shadow-[0_16px_48px_rgba(148,163,184,0.2)]'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              {isDragging && (
                <div className="absolute inset-0 bg-slate-900/[0.02] animate-pulse pointer-events-none"></div>
              )}
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-6 sm:mb-8 transition-all duration-300 relative z-10
                ${isDragging ? 'bg-slate-800 text-white shadow-xl shadow-slate-500/20 scale-110 animate-bounce' : 'bg-white/60 text-slate-400 group-hover:bg-white/80 group-hover:text-slate-600 group-hover:scale-105 border border-white/60 shadow-sm'}`}>
                <UploadCloud className="w-10 h-10 sm:w-[40px] sm:h-[40px]" strokeWidth={1.5} />
              </div>
              <h3 className={`text-xl sm:text-[26px] font-bold mb-2 sm:mb-3 tracking-tight text-center transition-colors duration-300 relative z-10 ${isDragging ? 'text-slate-900' : 'text-slate-800'}`}>
                {isDragging ? '松开鼠标立即处理' : '拖拽图片至此或点击上传'}
              </h3>
              <p className={`text-center max-w-sm leading-relaxed text-sm sm:text-[15px] transition-colors duration-300 relative z-10 ${isDragging ? 'text-slate-600' : 'text-slate-500'}`}>
                {isDragging ? '支持 JPG, PNG 等高清图像。我们将为您无损提取' : (
                  <>支持 JPG, PNG 等高清图像。<br/> 智能等比切分引擎，默认输出 3×3 无损原图。</>
                )}
              </p>
              <input 
                id="file-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 animate-in fade-in zoom-in-95 duration-300 items-start justify-center max-w-[1600px] mx-auto">
            {/* Left Side: Original Image Info & Controls */}
            <div className="w-full lg:w-[320px] xl:w-[360px] lg:shrink-0 flex flex-col bg-white/30 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2rem] border border-white/70 shadow-[0_8px_32px_rgba(148,163,184,0.15)] overflow-hidden sticky top-24 sm:top-32 h-fit mb-6 lg:mb-0 p-4 sm:p-5 lg:p-6 gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest pl-1">源文件</h3>
                <button 
                  onClick={clearImage}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-red-500 hover:bg-white/60 transition-colors py-1.5 px-3 rounded-full"
                >
                  <Trash2 size={14} />
                  清空
                </button>
              </div>
              
              <div className="relative rounded-2xl bg-white/20 backdrop-blur-sm border border-white/60 shadow-[inset_0_2px_20px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center p-3 sm:p-4 gap-3">
                <div className="relative inline-block max-w-full">
                  <img src={imageSrc} alt="Original" className="w-auto h-auto max-w-full max-h-[160px] lg:max-h-[220px] opacity-90 block rounded pointer-events-none" />
                  
                  {/* Grid Overlay for visual effect */}
                  <div 
                    className="absolute inset-0 grid pointer-events-none opacity-40 mix-blend-difference overflow-hidden rounded"
                    style={{ 
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                    }}
                  >
                     {[...Array(rows * cols)].map((_, i) => (
                       <div key={i} className="border-white/80" style={{
                         borderRightWidth: ((i + 1) % cols === 0) ? 0 : '1px',
                         borderBottomWidth: (Math.floor(i / cols) === rows - 1) ? 0 : '1px',
                       }}></div>
                     ))}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600 bg-white/50 rounded-lg px-3 py-1.5 border border-white/80 w-full max-w-[240px] shadow-sm">
                  <ImageIcon size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate font-mono font-medium text-[11px] text-slate-500">{imageFile?.name}</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-3 sm:p-4 shadow-[0_2px_10px_rgba(148,163,184,0.05)] relative z-20">
                <span className="text-[13px] font-bold text-slate-500 ml-1">切分网格</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" min="1" max="20" 
                    value={rows} 
                    onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="bg-white/50 backdrop-blur-md border border-white/70 rounded-lg w-12 py-1.5 text-center text-[13px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all shadow-sm"
                  />
                  <span className="text-slate-400 font-medium text-sm px-0.5">×</span>
                  <input 
                    type="number" min="1" max="20" 
                    value={cols} 
                    onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="bg-white/50 backdrop-blur-md border border-white/70 rounded-lg w-12 py-1.5 text-center text-[13px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button 
                  onClick={downloadZip}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-900 text-white py-3.5 px-6 rounded-[14px] font-semibold hover:from-slate-700 hover:to-slate-800 hover:shadow-xl hover:shadow-slate-900/20 ring-1 ring-white/10 transition-all duration-300 active:scale-[0.98] text-[14px]"
                >
                  <Download size={16} />
                  导出 ZIP 
                  <span className="ml-1 opacity-80 font-normal">({rows * cols} 张)</span>
                </button>
              </div>
            </div>

            {/* Right Side: Split Results Grid */}
            <div className="flex-1 max-w-[1200px] w-full min-w-0 bg-white/30 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 lg:p-10 xl:p-12 border border-white/70 shadow-[0_8px_32px_rgba(148,163,184,0.15)] flex flex-col items-center h-fit sticky top-24 sm:top-32 transition-all">
              <div className="w-full">
                <div className="flex items-center justify-between mb-6 sm:mb-8 pl-1 sm:pl-2">
                  <h3 className="text-[14px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2.5">
                    <Scissors size={15} className="text-slate-300"/>
                    即时预览
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-slate-600 bg-white/60 px-3 py-1.5 rounded-lg border border-white/80 shadow-sm">{cols} × {rows}</span>
                  </div>
                </div>
                
                {isProcessing ? (
                  <div className="py-20 sm:py-32 flex items-center justify-center w-full bg-white/20 backdrop-blur-md rounded-2xl sm:rounded-[2rem] border border-white/60 shadow-[inset_0_2px_20px_rgba(255,255,255,0.2)]">
                    <div className="flex flex-col items-center gap-4 sm:gap-5">
                      <div className="relative">
                         <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                         <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-slate-600 relative z-10"></div>
                      </div>
                      <span className="text-[15px] font-medium text-slate-600 animate-pulse tracking-wide">引擎切分中...</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex justify-center">
                    <div className="relative border border-white/40 shadow-sm max-w-full rounded-xl overflow-hidden bg-white/20 p-2 backdrop-blur-md">
                      {/* Ghost Image to enforce constraint & aspect ratio adaptively */}
                      <img 
                        src={imageSrc} 
                        className="w-auto h-auto max-w-full max-h-[50vh] xl:max-h-[60vh] opacity-0 block pointer-events-none" 
                        aria-hidden="true" 
                        alt="Ghost"
                      />
                      <div 
                        className="absolute inset-[8px] grid bg-slate-300/40 gap-[1px] rounded-lg overflow-hidden"
                        style={{ 
                          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                        }}
                      >
                        {splitImages.map((part, index) => {
                          return (
                          <div 
                            key={part.id} 
                            className="relative group overflow-hidden bg-white/20 w-full h-full flex cursor-pointer"
                            onClick={() => {
                              setSelectedImage(part);
                              setSelectedIndex(index);
                            }}
                          >
                            <img 
                              src={part.dataUrl} 
                              alt={`part ${index + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out block"
                            />
                            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors duration-300 flex items-center justify-center pointer-events-none">
                              <div className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-600 rounded-full p-2.5 shadow-xl shadow-slate-900/5 backdrop-blur-xl translate-y-3 group-hover:translate-y-0 transition-all duration-300">
                                <ZoomIn size={18} strokeWidth={2.5} />
                              </div>
                              <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-black/40 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-md shadow-sm backdrop-blur-md transition-all duration-300">
                                {index + 1}
                              </span>
                            </div>
                          </div>
                        )})}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-2xl animate-in fade-in duration-300 touch-none overflow-hidden"
          onClick={() => { setSelectedImage(null); setSelectedIndex(null); }}
          onWheel={handleWheel}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-2.5 z-[110] backdrop-blur-md"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setSelectedIndex(null); }}
          >
            <X size={24} />
          </button>
          
          <div 
            className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-200"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img 
              src={selectedImage.dataUrl} 
              alt={`Preview preview`} 
              className={`max-w-[90vw] max-h-[90vh] object-contain shadow-2xl select-none ${isPanning ? '' : 'transition-transform duration-75 ease-out'}`}
              style={{
                transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomScale})`,
                cursor: zoomScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in'
              }}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl border border-white/20 px-5 py-2.5 rounded-full text-white text-sm font-medium shadow-2xl flex items-center gap-3 pointer-events-none z-[110]">
            <span>片段 {selectedIndex !== null ? selectedIndex + 1 : ''}</span>
            {zoomScale > 1 && <span className="opacity-70 border-l border-white/20 pl-3">{Math.round(zoomScale * 100)}%</span>}
          </div>
        </div>
      )}
    </div>
  );
}
