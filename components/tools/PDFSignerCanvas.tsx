import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FileData } from '../../types';
import * as fabric from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface SignerCanvasProps {
  file: FileData;
  zoom: number;
  activeSignature: string | null;
}

// Global clipboard for signer
let _signerClipboard: any = null;

export const PDFSignerCanvas: React.FC<SignerCanvasProps> = ({ file, zoom, activeSignature }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const currentRenderId = useRef<number>(0);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [baseDimensions, setBaseDimensions] = useState({ width: 0, height: 0 });
  
  const pageAnnotations = useRef<Map<number, string>>(new Map());
  const historyStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isHistoryAction = useRef(false);

  useEffect(() => {
    const loadPdf = async () => {
      if (!file) return;
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setNumPages(pdf.numPages);
      } catch (err) {
        console.error(err);
      }
    };
    loadPdf();
  }, [file]);

  const saveHistory = useCallback(() => {
    if (isHistoryAction.current || !fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    if (historyStack.current.length === 0 || historyStack.current[historyStack.current.length - 1] !== json) {
      historyStack.current.push(json);
      redoStack.current = [];
      if (historyStack.current.length > 50) historyStack.current.shift();
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (historyStack.current.length <= 1 || !fabricRef.current) return;
    isHistoryAction.current = true;
    const currentState = historyStack.current.pop();
    if (currentState) redoStack.current.push(currentState);
    const prevState = historyStack.current[historyStack.current.length - 1];
    const canvas = fabricRef.current;
    const bg = canvas.backgroundImage;
    await canvas.loadFromJSON(JSON.parse(prevState));
    canvas.backgroundImage = bg;
    canvas.renderAll();
    isHistoryAction.current = false;
  }, []);

  const handleRedo = useCallback(async () => {
    if (redoStack.current.length === 0 || !fabricRef.current) return;
    isHistoryAction.current = true;
    const nextState = redoStack.current.pop();
    if (nextState) {
        historyStack.current.push(nextState);
        const canvas = fabricRef.current;
        const bg = canvas.backgroundImage;
        await canvas.loadFromJSON(JSON.parse(nextState));
        canvas.backgroundImage = bg;
        canvas.renderAll();
    }
    isHistoryAction.current = false;
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (activeObject) {
      _signerClipboard = await activeObject.clone();
    }
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    if (!fabricRef.current || !_signerClipboard) return;
    const canvas = fabricRef.current;
    const clonedObj = await _signerClipboard.clone();
    canvas.discardActiveObject();
    clonedObj.set({
      left: (clonedObj.left || 0) + 20,
      top: (clonedObj.top || 0) + 20,
      evented: true,
    });
    if (clonedObj instanceof fabric.ActiveSelection) {
      clonedObj.canvas = canvas;
      clonedObj.forEachObject((obj: fabric.Object) => canvas.add(obj));
      clonedObj.setCoords();
    } else {
      canvas.add(clonedObj);
    }
    _signerClipboard.top += 20;
    _signerClipboard.left += 20;
    canvas.setActiveObject(clonedObj);
    canvas.requestRenderAll();
    saveHistory();
  }, [saveHistory]);

  useEffect(() => {
    if (!file || !canvasRef.current) return;
    if (!canvasRef.current) return; // Fixed requested line 143
    const renderId = ++currentRenderId.current;
    setIsLoading(true);
    historyStack.current = [];
    redoStack.current = [];
    let canvas: fabric.Canvas | null = null;
    const initPage = async () => {
        try {
            const arrayBuffer = await file.blob.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            if (renderId !== currentRenderId.current) return;
            const page = await pdf.getPage(currentPage);
            const viewport = page.getViewport({ scale: 1.5 });
            const tempCanvas = document.createElement('canvas');
            const tempContext = tempCanvas.getContext('2d');
            if (!tempContext) return;
            tempCanvas.height = viewport.height;
            tempCanvas.width = viewport.width;
            await page.render({ canvasContext: tempContext, viewport, canvas: tempCanvas }).promise;
            if (renderId !== currentRenderId.current) return;
            setBaseDimensions({ width: viewport.width, height: viewport.height });
            if (fabricRef.current) fabricRef.current.dispose();
            canvas = new fabric.Canvas(canvasRef.current!, {
                height: viewport.height,
                width: viewport.width,
                backgroundColor: '#ffffff',
                uniformScaling: true,
            });
            const bgImg = await fabric.FabricImage.fromURL(tempCanvas.toDataURL('image/png'));
            bgImg.set({ selectable: false, evented: false });
            const saved = pageAnnotations.current.get(currentPage);
            if (saved) {
                const parsed = JSON.parse(saved);
                delete parsed.viewportTransform;
                delete parsed.backgroundImage; 
                await canvas.loadFromJSON(parsed);
            }
            canvas.backgroundImage = bgImg;
            if (renderId !== currentRenderId.current) {
                canvas.dispose();
                return;
            }
            fabricRef.current = canvas;
            canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
            canvas.setDimensions({ width: viewport.width * zoom, height: viewport.height * zoom });
            canvas.on('object:added', saveHistory);
            canvas.on('object:modified', saveHistory);
            canvas.on('object:removed', saveHistory);
            saveHistory();
            canvas.renderAll();
            setIsLoading(false);
        } catch (err) {
            console.error("Signer Canvas init failed", err);
            setIsLoading(false);
        }
    };
    initPage();
    return () => {
        if (canvas) {
            pageAnnotations.current.set(currentPage, JSON.stringify(canvas.toJSON()));
            canvas.dispose();
            fabricRef.current = null;
        }
    }
  }, [file, currentPage]); 

  useEffect(() => {
    if (fabricRef.current && baseDimensions.width > 0) {
      const canvas = fabricRef.current;
      canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
      canvas.setDimensions({ width: baseDimensions.width * zoom, height: baseDimensions.height * zoom });
      canvas.renderAll();
    }
  }, [zoom, baseDimensions]);

  useEffect(() => {
    const handleAdd = async (e: CustomEvent) => {
        if (!fabricRef.current) return;
        const { image } = e.detail;
        const canvas = fabricRef.current;
        const centerX = baseDimensions.width / 2;
        const centerY = baseDimensions.height / 2;
        const img = await fabric.FabricImage.fromURL(image);
        img.set({
            left: centerX,
            top: centerY,
            originX: 'center',
            originY: 'center',
            scaleX: 0.5,
            scaleY: 0.5,
            lockScalingFlip: true,
            lockSkewingX: true,
            lockSkewingY: true,
            transparentCorners: false,
            cornerColor: 'rgba(244, 63, 94, 0.7)',
            cornerStrokeColor: '#ffffff',
            cornerStyle: 'circle',
            hasBorders: false,
            borderColor: 'transparent',
            borderOpacity: 0,
            padding: 15
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveHistory();
    };

    const handleSync = async (e: CustomEvent) => {
        if (!fabricRef.current) return;
        const activeObj = fabricRef.current.getActiveObject();
        if (!activeObj) {
            alert("Please select a signature on the canvas first.");
            return;
        }
        const { mode, range } = e.detail;
        let targets: number[] = [];
        if (mode === 'all') {
            for (let i = 1; i <= numPages; i++) targets.push(i);
        } else {
            targets = parsePageRange(range, numPages);
        }
        const relX = activeObj.left / baseDimensions.width;
        const relY = activeObj.top / baseDimensions.height;
        const relWidth = (activeObj.width * activeObj.scaleX) / baseDimensions.width;
        pageAnnotations.current.set(currentPage, JSON.stringify(fabricRef.current.toJSON()));
        setIsLoading(true);
        try {
            const arrayBuffer = await file.blob.arrayBuffer();
            const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (const pageIdx of targets) {
                if (pageIdx === currentPage) continue;
                const targetPage = await pdfJsDoc.getPage(pageIdx);
                const targetViewport = targetPage.getViewport({ scale: 1.5 });
                const existingJson = pageAnnotations.current.get(pageIdx) || '{"version":"6.6.1","objects":[]}';
                const parsed = JSON.parse(existingJson);
                const clonedState = await activeObj.clone();
                const newLeft = relX * targetViewport.width;
                const newTop = relY * targetViewport.height;
                const newScale = (relWidth * targetViewport.width) / activeObj.width;
                clonedState.set({
                    left: newLeft,
                    top: newTop,
                    scaleX: newScale,
                    scaleY: newScale,
                    originX: activeObj.originX,
                    originY: activeObj.originY
                });
                parsed.objects.push(clonedState.toObject());
                pageAnnotations.current.set(pageIdx, JSON.stringify(parsed));
            }
            alert(`Propagated signature across ${targets.length} pages.`);
        } catch (err) {
            console.error("Propagation failed", err);
            alert("Failed to propagate signature.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
      if (!fabricRef.current) return;
      const bg = fabricRef.current.backgroundImage;
      fabricRef.current.clear();
      fabricRef.current.backgroundImage = bg;
      fabricRef.current.renderAll();
      saveHistory();
    };

    const handleDownload = async () => {
      if (!file || !fabricRef.current) return;
      pageAnnotations.current.set(currentPage, JSON.stringify(fabricRef.current.toJSON()));
      setIsLoading(true);
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const exportMultiplier = 3;
        for (let i = 1; i <= numPages; i++) {
          const json = pageAnnotations.current.get(i);
          if (!json) continue;
          const jsPage = await pdfJsDoc.getPage(i);
          const viewport = jsPage.getViewport({ scale: 1.5 });
          const page = pdfDoc.getPages()[i - 1];
          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = viewport.width * exportMultiplier;
          exportCanvas.height = viewport.height * exportMultiplier;
          const exportFabric = new fabric.Canvas(exportCanvas, { backgroundColor: 'rgba(0,0,0,0)' });
          const parsed = JSON.parse(json);
          delete parsed.backgroundImage;
          delete parsed.viewportTransform;
          await exportFabric.loadFromJSON(parsed);
          exportFabric.setViewportTransform([exportMultiplier, 0, 0, exportMultiplier, 0, 0]);
          exportFabric.discardActiveObject();
          exportFabric.backgroundImage = undefined; 
          exportFabric.backgroundColor = 'rgba(0,0,0,0)'; 
          exportFabric.renderAll();
          const pngData = exportCanvas.toDataURL('image/png', 1.0);
          const png = await pdfDoc.embedPng(pngData);
          page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
          exportFabric.dispose();
        }
        // Fixed requested line 325
        const pdfbytes = await pdfDoc.save(); // Uint8Array
        const blob = new Blob([new Uint8Array(pdfbytes)], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `signed_${file.name}`;
        link.click();
      } catch (e) {
        console.error(e);
        alert("Baking failed.");
      } finally {
        setIsLoading(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fabricRef.current) return;
      const canvas = fabricRef.current;
      const activeObject = canvas.getActiveObject();
      const isEditing = activeObject && (activeObject as any).isEditing;
      if (isEditing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copyToClipboard();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteFromClipboard();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeObject) {
            canvas.remove(...canvas.getActiveObjects());
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            saveHistory();
        }
      } else if (e.key === 'Escape') {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    };

    window.addEventListener('signer:undo', handleUndo);
    window.addEventListener('signer:redo', handleRedo);
    window.addEventListener('signer:add-to-page' as any, handleAdd as any);
    window.addEventListener('signer:sync-selection' as any, handleSync as any);
    window.addEventListener('signer:reset-canvas', handleReset);
    window.addEventListener('signer:download', handleDownload);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('signer:undo', handleUndo);
      window.removeEventListener('signer:redo', handleRedo);
      window.removeEventListener('signer:add-to-page' as any, handleAdd as any);
      window.removeEventListener('signer:sync-selection' as any, handleSync as any);
      window.removeEventListener('signer:reset-canvas', handleReset);
      window.removeEventListener('signer:download', handleDownload);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [file, numPages, currentPage, baseDimensions, handleUndo, handleRedo, saveHistory, copyToClipboard, pasteFromClipboard]);

  return (
    <div className="h-full bg-slate-200 flex flex-col items-center overflow-hidden relative">
      <div className="h-14 w-full bg-white border-b border-slate-300 flex items-center justify-between px-8 z-20 shrink-0 shadow-sm">
        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Digital Signatory Module v2.9</span>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-20 transition-all"><ChevronLeft size={20} /></button>
            <span className="text-xs font-black text-slate-800 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">{currentPage} <span className="text-slate-400 font-bold ml-1">/ {numPages}</span></span>
            <button disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-20 transition-all"><ChevronRight size={20} /></button>
          </div>
        </div>
        <div className="w-32" />
      </div>

      <div ref={containerRef} className="flex-1 w-full overflow-auto custom-scrollbar p-16 flex flex-col items-center gap-8 relative bg-slate-200/50">
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-md flex items-center justify-center">
             <div className="bg-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-rose-100 animate-in fade-in zoom-in-95">
               <Loader2 size={24} className="animate-spin text-rose-600" />
               <span className="text-xs font-black text-rose-700 uppercase tracking-[0.2em]">Synchronizing Document State</span>
             </div>
          </div>
        )}
        <div className="shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] rounded-sm bg-white border border-slate-300">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};

function parsePageRange(range: string, total: number): number[] {
    const res: number[] = [];
    if (!range) return [];
    const parts = range.split(',').map(p => p.trim());
    parts.forEach(p => {
        if (p.includes('-')) {
            const [s, e] = p.split('-').map(Number);
            for (let i = s; i <= e && i <= total; i++) if (i > 0) res.push(i);
        } else {
            const n = Number(p);
            if (n > 0 && n <= total) res.push(n);
        }
    });
    return [...new Set(res)];
}