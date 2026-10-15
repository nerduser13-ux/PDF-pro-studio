import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FileData } from '../../types';
import * as fabric from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { DiagramModal } from './DiagramModal';

interface CanvasProps {
  file: FileData;
  mode: 'select' | 'pen' | 'text' | 'rect' | 'circle' | 'arrow' | 'eraser' | 'mosaic';
  color: string;
  size: number;
  zoom: number;
}

let _clipboard: fabric.Object | null = null;

export const PDFEditorCanvas: React.FC<CanvasProps> = ({ file, mode, color, size, zoom }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const currentRenderId = useRef<number>(0);
  
  const modeRef = useRef(mode);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [baseDimensions, setBaseDimensions] = useState({ width: 0, height: 0 });
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  
  const pageAnnotations = useRef<Map<number, string>>(new Map());
  const historyStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isHistoryAction = useRef(false);

  const isDrawing = useRef(false);
  const activeObj = useRef<fabric.Object | null>(null);
  const startPoint = useRef<{ x: number, y: number } | null>(null);

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

  const copy = useCallback(async () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active) {
      _clipboard = await active.clone();
    }
  }, []);

  const paste = useCallback(async () => {
    if (!fabricRef.current || !_clipboard) return;
    const canvas = fabricRef.current;
    const cloned = await _clipboard.clone();
    canvas.discardActiveObject();
    cloned.set({
      left: (cloned.left || 0) + 20,
      top: (cloned.top || 0) + 20,
      evented: true,
    });
    if (cloned instanceof fabric.ActiveSelection) {
      cloned.canvas = canvas;
      cloned.forEachObject((obj) => canvas.add(obj));
      cloned.setCoords();
    } else {
      canvas.add(cloned);
    }
    if (_clipboard.top !== undefined && _clipboard.left !== undefined) {
      _clipboard.top += 20;
      _clipboard.left += 20;
    }
    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    saveHistory();
  }, [saveHistory]);

  const removeSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
      canvas.discardActiveObject();
      activeObjects.forEach((obj) => {
        canvas.remove(obj);
      });
      canvas.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeObj = fabricRef.current?.getActiveObject();
      const isEditingText = activeObj && (activeObj as any).isEditing;
      if (isEditingText) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        paste();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, copy, paste, removeSelected]);

  useEffect(() => {
    const loadPdfMeta = async () => {
      if (!file) return;
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setNumPages(pdf.numPages);
      } catch (err) {
        console.error("Failed to load PDF metadata", err);
      }
    };
    loadPdfMeta();
  }, [file]);

  const setupDrawingHandlers = (canvas: fabric.Canvas) => {
    canvas.on('mouse:down', (options) => {
      const currentMode = modeRef.current;
      if (currentMode === 'eraser') {
        const target = options.target;
        if (target && target !== canvas.backgroundImage) {
          canvas.remove(target);
          canvas.renderAll();
          saveHistory();
        }
        return;
      }
      if (currentMode === 'select' || currentMode === 'pen') return;
      const pointer = canvas.getScenePoint(options.e);
      isDrawing.current = true;
      startPoint.current = { x: pointer.x, y: pointer.y };

      if (currentMode === 'text') {
        const text = new fabric.IText('Type here...', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Inter',
          fontSize: 24,
          fill: colorRef.current,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        isDrawing.current = false;
        saveHistory();
        return;
      }

      const shapeProps = {
        left: pointer.x,
        top: pointer.y,
        selectable: false,
        strokeUniform: true,
      };

      if (currentMode === 'rect' || currentMode === 'mosaic') {
        const rect = new fabric.Rect({
          ...shapeProps,
          width: 1,
          height: 1,
          fill: currentMode === 'mosaic' ? '#000000' : 'transparent',
          stroke: currentMode === 'mosaic' ? 'transparent' : colorRef.current,
          strokeWidth: sizeRef.current,
        });
        activeObj.current = rect;
        canvas.add(rect);
      } else if (currentMode === 'circle') {
        const circle = new fabric.Circle({
          ...shapeProps,
          radius: 1,
          fill: 'transparent',
          stroke: colorRef.current,
          strokeWidth: sizeRef.current,
        });
        activeObj.current = circle;
        canvas.add(circle);
      } else if (currentMode === 'arrow') {
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          ...shapeProps,
          stroke: colorRef.current,
          strokeWidth: sizeRef.current,
          strokeCap: 'round',
        });
        activeObj.current = line;
        canvas.add(line);
      }
      canvas.renderAll();
    });

    canvas.on('mouse:move', (options) => {
      if (!isDrawing.current || !activeObj.current || !startPoint.current) return;
      const pointer = canvas.getScenePoint(options.e);
      const currentMode = modeRef.current;

      if (currentMode === 'rect' || currentMode === 'mosaic') {
        const rect = activeObj.current as fabric.Rect;
        const width = Math.abs(pointer.x - startPoint.current.x);
        const height = Math.abs(pointer.y - startPoint.current.y);
        rect.set({
          width: width || 1,
          height: height || 1,
          left: pointer.x < startPoint.current.x ? pointer.x : startPoint.current.x,
          top: pointer.y < startPoint.current.y ? pointer.y : startPoint.current.y,
        });
      } else if (currentMode === 'circle') {
        const circle = activeObj.current as fabric.Circle;
        const radius = Math.sqrt(Math.pow(pointer.x - startPoint.current.x, 2) + Math.pow(pointer.y - startPoint.current.y, 2)) / 2;
        circle.set({
          radius: radius || 1,
          left: (pointer.x + startPoint.current.x) / 2 - radius,
          top: (pointer.y + startPoint.current.y) / 2 - radius,
        });
      } else if (currentMode === 'arrow') {
        const line = activeObj.current as fabric.Line;
        line.set({ x2: pointer.x, y2: pointer.y });
      }
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      if (isDrawing.current && activeObj.current) {
        activeObj.current.set({ selectable: true });
        saveHistory();
      }
      isDrawing.current = false;
      activeObj.current = null;
      startPoint.current = null;
    });
  };

  useEffect(() => {
    if (!file || !canvasRef.current) return;
    if (!canvasRef.current) return; // Fixed requested line 260
    const renderId = ++currentRenderId.current;
    setIsLoading(true);

    let canvas: fabric.Canvas | null = null;
    const initCanvas = async () => {
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (renderId !== currentRenderId.current) return;
        
        const page = await pdf.getPage(currentPage);
        const renderScale = 1.5;
        const viewport = page.getViewport({ scale: renderScale });

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
          backgroundColor: 'transparent',
          selection: modeRef.current === 'select'
        });

        const bgImg = await fabric.FabricImage.fromURL(tempCanvas.toDataURL('image/png'));
        bgImg.set({ selectable: false, evented: false });

        const saved = pageAnnotations.current.get(currentPage);
        if (saved) {
          const parsed = JSON.parse(saved);
          delete parsed.backgroundImage;
          delete parsed.viewportTransform;
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

        if (textLayerRef.current) {
            textLayerRef.current.innerHTML = '';
            textLayerRef.current.style.width = `${viewport.width * zoom}px`;
            textLayerRef.current.style.height = `${viewport.height * zoom}px`;
            textLayerRef.current.style.transform = `scale(${zoom})`;
            textLayerRef.current.style.transformOrigin = '0 0';
            textLayerRef.current.style.pointerEvents = 'none'; 
            
            const textContent = await page.getTextContent();
            
            const textLayer = new pdfjsLib.TextLayer({
                textContentSource: textContent,
                container: textLayerRef.current,
                viewport,
            });
            await textLayer.render();
        }

        canvas.on('object:added', saveHistory);
        canvas.on('object:modified', saveHistory);
        canvas.on('object:removed', saveHistory);
        setupDrawingHandlers(canvas);
        updateSettings(canvas);
        canvas.renderAll();
        setIsLoading(false);
      } catch (err) {
        console.error("Canvas init failed", err);
        setIsLoading(false);
      }
    };
    initCanvas();

    return () => {
      if (canvas) {
        pageAnnotations.current.set(currentPage, JSON.stringify(canvas.toJSON()));
        canvas.dispose();
        fabricRef.current = null;
      }
    };
  }, [file, currentPage]);

  useEffect(() => {
    if (fabricRef.current && baseDimensions.width > 0) {
      const canvas = fabricRef.current;
      canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
      canvas.setDimensions({ width: baseDimensions.width * zoom, height: baseDimensions.height * zoom });
      if (textLayerRef.current) {
        textLayerRef.current.style.width = `${baseDimensions.width * zoom}px`;
        textLayerRef.current.style.height = `${baseDimensions.height * zoom}px`;
        textLayerRef.current.style.transform = `scale(${zoom})`;
      }
      canvas.renderAll();
    }
  }, [zoom, baseDimensions]);

  const updateSettings = useCallback((canvas: fabric.Canvas) => {
    const currentMode = modeRef.current;
    canvas.isDrawingMode = currentMode === 'pen';
    canvas.selection = currentMode === 'select';
    if (textLayerRef.current) textLayerRef.current.style.pointerEvents = 'none';
    canvas.defaultCursor = currentMode === 'select' ? 'default' : 'crosshair';
    canvas.hoverCursor = currentMode === 'select' ? 'move' : 'crosshair';
    canvas.forEachObject(obj => {
        if (obj === canvas.backgroundImage) return;
        obj.selectable = currentMode === 'select';
        obj.evented = currentMode === 'select' || currentMode === 'eraser';
    });
    if (currentMode === 'pen') {
      const brush = new fabric.PencilBrush(canvas);
      brush.color = colorRef.current;
      brush.width = sizeRef.current;
      canvas.freeDrawingBrush = brush;
    }
  }, []);

  useEffect(() => {
    if (fabricRef.current) {
      updateSettings(fabricRef.current);
      fabricRef.current.renderAll();
    }
  }, [mode, color, size, updateSettings]);

  useEffect(() => {
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
        // Fixed requested line 477
        const pdfbytes = await pdfDoc.save(); // Uint8Array
        const blob = new Blob([new Uint8Array(pdfbytes)], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `edited_${file.name}`;
        link.click();
      } catch (e) {
        console.error("Download failed", e);
        alert("Baking failed.");
      } finally {
        setIsLoading(false);
      }
    };

    const handleOpenDiagram = () => {
      setIsDiagramModalOpen(true);
    };

    window.addEventListener('editor:undo', handleUndo);
    window.addEventListener('editor:redo', handleRedo);
    window.addEventListener('editor:reset-page', handleReset);
    window.addEventListener('editor:download', handleDownload);
    window.addEventListener('editor:open-diagram', handleOpenDiagram);
    return () => {
      window.removeEventListener('editor:undo', handleUndo);
      window.removeEventListener('editor:redo', handleRedo);
      window.removeEventListener('editor:reset-page', handleReset);
      window.removeEventListener('editor:download', handleDownload);
      window.removeEventListener('editor:open-diagram', handleOpenDiagram);
    };
  }, [file, numPages, currentPage, baseDimensions, handleUndo, handleRedo, saveHistory]);

  const handleInsertDiagram = async (dataUrl: string, width: number, height: number) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    try {
      const imgObj = await fabric.FabricImage.fromURL(dataUrl);
      
      // Scale diagram if it's too large for current view
      let scale = 1;
      const maxW = (canvas.width || 800) * 0.6;
      if (width > maxW) {
        scale = maxW / width;
      }
      
      imgObj.set({
        left: 50,
        top: 50,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        hasControls: true,
      });

      canvas.add(imgObj);
      canvas.setActiveObject(imgObj);
      canvas.renderAll();
      saveHistory();
    } catch (err) {
      console.error('Failed to add diagram image to canvas:', err);
    }
  };

  return (
    <div className="h-full bg-slate-200 flex flex-col items-center overflow-hidden relative">
      <div className="h-14 w-full bg-white border-b border-slate-300 flex items-center justify-between px-8 z-20 shrink-0 shadow-sm">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Document Editor Workbench</span>
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
             <div className="bg-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-indigo-100 animate-in fade-in zoom-in-95">
               <Loader2 size={24} className="animate-spin text-indigo-600" />
               <span className="text-xs font-black text-indigo-700 uppercase tracking-[0.2em]">Synchronizing Canvas Layers</span>
             </div>
          </div>
        )}
        <div className="relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] rounded-sm bg-white border border-slate-300">
          <div ref={textLayerRef} className="textLayer" style={{ zIndex: 10, pointerEvents: 'none' }} />
          <canvas ref={canvasRef} />
        </div>
      </div>

      <DiagramModal
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
        onInsert={handleInsertDiagram}
      />
    </div>
  );
};