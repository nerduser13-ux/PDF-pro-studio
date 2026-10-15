import React, { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import {
  Square,
  Circle,
  Diamond,
  Database,
  Layers,
  Type,
  Move,
  Trash2,
  Plus,
  Download,
  Copy,
  Sparkles,
  RotateCcw,
  Palette,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCode,
  Layout,
  Workflow,
  Check,
  Sliders,
  CornerDownRight,
  MousePointer2,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Eye,
  Grid,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import {
  DiagramDocument,
  DiagramNode,
  DiagramEdge,
  ShapeType,
  ArrowStyle,
  ArrowHead,
  RoutingType,
  AnchorPosition,
  ViewportTransform
} from '../diagram/types';
import { getNodeAnchorPoint, computeEdgePath } from '../diagram/geometry';
import { DIAGRAM_TEMPLATES, TemplateDefinition } from '../diagram/templates';
import { parseMermaidToDocument, exportDocumentToMermaid } from '../diagram/mermaidConverter';
import { downloadPng, downloadSvg, downloadNativeJson } from '../diagram/exportUtils';
import { loadActiveDiagram, saveActiveDiagram } from '../diagram/persistence';
import { ShapeRenderer } from '../diagram/ShapeRenderer';

const COLOR_PRESETS = [
  '#4f46e5', '#2563eb', '#0284c7', '#0d9488',
  '#059669', '#16a34a', '#84cc16', '#d97706',
  '#f97316', '#e11d48', '#ec4899', '#9333ea',
  '#8b5cf6', '#475569', '#0f172a', '#ffffff',
  '#f8fafc', '#ecfdf5', '#eff6ff', '#fef3c7', '#fff1f2'
];

export const DiagramStudio: React.FC = () => {
  // Primary Diagram State (Single source of truth with LocalStorage persistence)
  const [doc, setDoc] = useState<DiagramDocument>(() => loadActiveDiagram());

  // Autosave whenever document changes
  useEffect(() => {
    saveActiveDiagram(doc);
  }, [doc]);

  // Undo / Redo History Stack
  const historyStack = useRef<DiagramDocument[]>([doc]);
  const redoStack = useRef<DiagramDocument[]>([]);
  const isUndoRedoAction = useRef(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'visual' | 'mermaid'>('visual');

  // Viewport / Pan & Zoom
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection & Interactions
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Dragging Nodes
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragPointerStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Resizing Node
  const [isResizing, setIsResizing] = useState(false);
  const resizeNodeId = useRef<string | null>(null);
  const resizeInitial = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
  const resizeHandle = useRef<string>('se');

  // Interactive Connector Creation
  const [isConnecting, setIsConnecting] = useState(false);
  const connectingSource = useRef<{ nodeId: string; anchor: AnchorPosition } | null>(null);
  const [connectionPointer, setConnectionPointer] = useState<{ x: number; y: number } | null>(null);

  // Selection Box
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Inline Label Editing
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('All');

  // Mermaid Tab
  const [mermaidText, setMermaidText] = useState<string>('');
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  // Canvas Reference
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save history commit
  const commitToHistory = useCallback((newDoc: DiagramDocument) => {
    if (isUndoRedoAction.current) return;
    historyStack.current.push(newDoc);
    if (historyStack.current.length > 50) historyStack.current.shift();
    redoStack.current = [];
  }, []);

  const updateDoc = useCallback((updater: (prev: DiagramDocument) => DiagramDocument, recordHistory = true) => {
    setDoc(prev => {
      const next = updater(prev);
      if (recordHistory) {
        commitToHistory(next);
      }
      return next;
    });
  }, [commitToHistory]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (historyStack.current.length <= 1) return;
    isUndoRedoAction.current = true;
    const current = historyStack.current.pop();
    if (current) redoStack.current.push(current);
    const prev = historyStack.current[historyStack.current.length - 1];
    setDoc(prev);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    isUndoRedoAction.current = false;
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    isUndoRedoAction.current = true;
    const next = redoStack.current.pop();
    if (next) {
      historyStack.current.push(next);
      setDoc(next);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    }
    isUndoRedoAction.current = false;
  }, []);

  // Fit diagram to screen
  const handleFitToScreen = useCallback(() => {
    if (doc.nodes.length === 0 || !canvasRef.current) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const padding = 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    doc.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const w = maxX - minX + padding * 2;
    const h = maxY - minY + padding * 2;
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;

    const scale = Math.min(2.0, Math.max(0.3, Math.min(cw / w, ch / h)));
    const centerX = (cw - w * scale) / 2 - (minX - padding) * scale;
    const centerY = (ch - h * scale) / 2 - (minY - padding) * scale;

    setViewport({ x: centerX, y: centerY, zoom: scale });
  }, [doc.nodes]);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (clientY - rect.top - viewport.y) / viewport.zoom;
    return { x, y };
  }, [viewport]);

  // Sync Mermaid preview on code changes
  useEffect(() => {
    if (activeTab !== 'mermaid') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const id = `mermaid-render-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidText);
        if (!cancelled) {
          setMermaidSvg(svg);
          setMermaidError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMermaidError(err?.message || 'Syntax error in Mermaid specification');
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mermaidText, activeTab]);

  // Switch to Mermaid tab
  const handleSwitchToMermaid = () => {
    const generated = exportDocumentToMermaid(doc);
    setMermaidText(generated);
    setActiveTab('mermaid');
  };

  // Import Mermaid code into native document
  const handleImportMermaidToCanvas = () => {
    const res = parseMermaidToDocument(mermaidText);
    if (!res.success || !res.document) {
      setMermaidError(res.error || 'Failed to parse Mermaid code');
      return;
    }
    setDoc(res.document);
    commitToHistory(res.document);
    setActiveTab('visual');
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setImportNotification(`Successfully imported ${res.diagramType || 'diagram'} with ${res.document.nodes.length} nodes and ${res.document.edges.length} connectors into the canvas!`);
    setTimeout(() => {
      setImportNotification(null);
      handleFitToScreen();
    }, 4000);
  };

  // Add new Shape Node from palette
  const handleAddShape = (type: ShapeType) => {
    const centerWorld = screenToWorld(
      (canvasRef.current?.clientWidth || 800) / 2,
      (canvasRef.current?.clientHeight || 600) / 2
    );

    const id = `node-${Date.now().toString().slice(-4)}`;
    let width = 180;
    let height = 80;
    let text = 'New Shape';
    let cornerRadius = 8;
    let fillColor = '#eff6ff';
    let strokeColor = '#2563eb';
    let fields = undefined;
    let umlMembers = undefined;

    if (type === 'circle') {
      width = 100; height = 100; text = 'State'; fillColor = '#ecfdf5'; strokeColor = '#059669';
    } else if (type === 'diamond') {
      width = 140; height = 100; text = 'Decision?'; fillColor = '#fef3c7'; strokeColor = '#d97706';
    } else if (type === 'parallelogram') {
      width = 160; height = 80; text = 'Data I/O'; fillColor = '#f3e8ff'; strokeColor = '#9333ea';
    } else if (type === 'stadium') {
      width = 150; height = 65; text = 'Terminal'; fillColor = '#f0fdf4'; strokeColor = '#16a34a'; cornerRadius = 30;
    } else if (type === 'cylinder') {
      width = 150; height = 110; text = 'Database Storage'; fillColor = '#f0fdf4'; strokeColor = '#16a34a';
    } else if (type === 'sticky') {
      width = 160; height = 120; text = 'Note / Idea'; fillColor = '#fef9c3'; strokeColor = '#ca8a04';
    } else if (type === 'card') {
      width = 260; height = 150; text = '• Information item 1\n• Information item 2'; fillColor = '#3b82f6'; strokeColor = '#2563eb';
    } else if (type === 'text') {
      width = 140; height = 50; text = 'Text block'; fillColor = 'transparent'; strokeColor = 'transparent';
    } else if (type === 'swimlane') {
      width = 240; height = 450; text = 'CONTAINER'; fillColor = '#f8fafc'; strokeColor = '#cbd5e1';
    } else if (type === 'uml-class') {
      width = 220; height = 130; text = 'ClassName'; fillColor = '#f8fafc'; strokeColor = '#334155';
      umlMembers = [
        { id: 'm1', visibility: '+' as const, name: 'id', type: 'UUID' },
        { id: 'm2', visibility: '+' as const, name: 'process()', type: 'void', isMethod: true }
      ];
    } else if (type === 'er-table') {
      width = 250; height = 180; text = 'NEW_TABLE'; fillColor = '#4f46e5'; strokeColor = '#312e81';
      fields = [
        { id: 'f1', name: 'id', type: 'uuid', isPk: true },
        { id: 'f2', name: 'name', type: 'varchar(100)' },
        { id: 'f3', name: 'created_at', type: 'timestamp' }
      ];
    }

    const newNode: DiagramNode = {
      id,
      type,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
      width,
      height,
      text,
      fillColor,
      strokeColor,
      strokeWidth: 2,
      textColor: type === 'er-table' ? '#ffffff' : '#1e293b',
      fontSize: 12,
      fontBold: type === 'er-table' || type === 'uml-class' || type === 'card',
      cornerRadius: type === 'rounded' ? 16 : cornerRadius,
      fields,
      umlMembers,
    };

    updateDoc(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNodeIds([id]);
    setSelectedEdgeId(null);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedNodeIds.length > 0) {
          updateDoc(prev => ({
            ...prev,
            nodes: prev.nodes.filter(n => !selectedNodeIds.includes(n.id)),
            edges: prev.edges.filter(ed => !selectedNodeIds.includes(ed.from) && !selectedNodeIds.includes(ed.to)),
          }));
          setSelectedNodeIds([]);
        } else if (selectedEdgeId) {
          updateDoc(prev => ({
            ...prev,
            edges: prev.edges.filter(ed => ed.id !== selectedEdgeId),
          }));
          setSelectedEdgeId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedNodeIds(doc.nodes.map(n => n.id));
      } else if (e.key === 'Escape') {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setIsConnecting(false);
        setEditingNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, selectedEdgeId, doc.nodes, handleUndo, handleRedo, updateDoc]);

  // Pointer Down on Canvas (Pan, Selection box, or Deselect)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.buttons === 4) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setEditingNodeId(null);
      const wPoint = screenToWorld(e.clientX, e.clientY);
      setSelectionBox({
        startX: wPoint.x,
        startY: wPoint.y,
        currentX: wPoint.x,
        currentY: wPoint.y
      });
    }
  };

  // Pointer Move on Canvas
  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setViewport(v => ({
        ...v,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    if (isConnecting) {
      const wPoint = screenToWorld(e.clientX, e.clientY);
      setConnectionPointer(wPoint);
      return;
    }

    if (selectionBox) {
      const wPoint = screenToWorld(e.clientX, e.clientY);
      setSelectionBox(sb => sb ? { ...sb, currentX: wPoint.x, currentY: wPoint.y } : null);
      return;
    }

    if (isResizing && resizeNodeId.current) {
      const wPoint = screenToWorld(e.clientX, e.clientY);
      const init = resizeInitial.current;
      const handle = resizeHandle.current;

      let newWidth = init.width;
      let newHeight = init.height;
      let newX = init.x;
      let newY = init.y;

      if (handle.includes('e')) newWidth = Math.max(60, wPoint.x - init.x);
      if (handle.includes('s')) newHeight = Math.max(40, wPoint.y - init.y);
      if (handle.includes('w')) {
        const dx = wPoint.x - init.x;
        newWidth = Math.max(60, init.width - dx);
        newX = init.x + (init.width - newWidth);
      }
      if (handle.includes('n')) {
        const dy = wPoint.y - init.y;
        newHeight = Math.max(40, init.height - dy);
        newY = init.y + (init.height - newHeight);
      }

      setDoc(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === resizeNodeId.current ? { ...n, x: newX, y: newY, width: newWidth, height: newHeight } : n)
      }));
      return;
    }

    if (isDraggingNode && selectedNodeIds.length > 0) {
      const dx = (e.clientX - dragPointerStart.current.x) / viewport.zoom;
      const dy = (e.clientY - dragPointerStart.current.y) / viewport.zoom;

      setDoc(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => {
          const initPos = dragStartPositions.current.get(n.id);
          if (!initPos) return n;
          return {
            ...n,
            x: Math.round(initPos.x + dx),
            y: Math.round(initPos.y + dy),
          };
        }),
      }));
    }
  };

  // Pointer Up on Canvas
  const handleCanvasPointerUp = () => {
    if (isPanning) setIsPanning(false);

    if (isDraggingNode) {
      setIsDraggingNode(false);
      commitToHistory(doc);
    }

    if (isResizing) {
      setIsResizing(false);
      resizeNodeId.current = null;
      commitToHistory(doc);
    }

    if (selectionBox) {
      const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
      const x2 = Math.max(selectionBox.startX, selectionBox.currentX);
      const y1 = Math.min(selectionBox.startY, selectionBox.currentY);
      const y2 = Math.max(selectionBox.startY, selectionBox.currentY);

      const enclosed = doc.nodes
        .filter(n => n.x >= x1 && n.x + n.width <= x2 && n.y >= y1 && n.y + n.height <= y2)
        .map(n => n.id);

      setSelectedNodeIds(enclosed);
      setSelectionBox(null);
    }

    if (isConnecting) {
      setIsConnecting(false);
      connectingSource.current = null;
      setConnectionPointer(null);
    }
  };

  // Node Pointer Down
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    if (isConnecting) return;

    if (e.shiftKey) {
      setSelectedNodeIds(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
    } else {
      if (!selectedNodeIds.includes(nodeId)) {
        setSelectedNodeIds([nodeId]);
      }
    }
    setSelectedEdgeId(null);

    setIsDraggingNode(true);
    dragPointerStart.current = { x: e.clientX, y: e.clientY };
    const map = new Map<string, { x: number; y: number }>();
    doc.nodes.forEach(n => {
      if (selectedNodeIds.includes(n.id) || n.id === nodeId) {
        map.set(n.id, { x: n.x, y: n.y });
      }
    });
    dragStartPositions.current = map;
  };

  // Start connector drag from node handle
  const handleStartConnect = (e: React.PointerEvent, nodeId: string, anchor: AnchorPosition) => {
    e.stopPropagation();
    setIsConnecting(true);
    connectingSource.current = { nodeId, anchor };
    const wPoint = screenToWorld(e.clientX, e.clientY);
    setConnectionPointer(wPoint);
  };

  // Drop connector on target node
  const handleDropConnect = (e: React.PointerEvent, targetNodeId: string, targetAnchor: AnchorPosition) => {
    e.stopPropagation();
    if (!isConnecting || !connectingSource.current) return;
    const source = connectingSource.current;
    if (source.nodeId === targetNodeId) {
      setIsConnecting(false);
      return;
    }

    const newEdge: DiagramEdge = {
      id: `edge-${Date.now().toString().slice(-4)}`,
      from: source.nodeId,
      to: targetNodeId,
      fromAnchor: source.anchor,
      toAnchor: targetAnchor,
      style: 'solid',
      routing: 'orthogonal',
      strokeColor: '#4f46e5',
      strokeWidth: 2,
      arrowEnd: 'arrow',
      label: 'relates to',
    };

    updateDoc(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));

    setIsConnecting(false);
    connectingSource.current = null;
    setConnectionPointer(null);
    setSelectedEdgeId(newEdge.id);
  };

  // Start resize from handle
  const handleStartResize = (e: React.PointerEvent, nodeId: string, handle: string) => {
    e.stopPropagation();
    const node = doc.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setIsResizing(true);
    resizeNodeId.current = nodeId;
    resizeHandle.current = handle;
    resizeInitial.current = { x: node.x, y: node.y, width: node.width, height: node.height };
  };

  // Load a template
  const handleApplyTemplate = (tmpl: TemplateDefinition) => {
    const newDoc = tmpl.createDocument();
    setDoc(newDoc);
    commitToHistory(newDoc);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setIsTemplateModalOpen(false);
    setTimeout(handleFitToScreen, 100);
  };

  // Open Native JSON file
  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.nodes && parsed.edges) {
          setDoc(parsed);
          commitToHistory(parsed);
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
          setTimeout(handleFitToScreen, 100);
        } else {
          alert('Invalid diagram file format.');
        }
      } catch (err) {
        alert('Failed to read file: invalid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Active elements for inspector
  const activeNode = selectedNodeIds.length === 1 ? doc.nodes.find(n => n.id === selectedNodeIds[0]) : null;
  const activeEdge = selectedEdgeId ? doc.edges.find(e => e.id === selectedEdgeId) : null;

  // Filter templates
  const filteredTemplates = DIAGRAM_TEMPLATES.filter(t => {
    const matchesCat = templateCategory === 'All' || t.category === templateCategory;
    const matchesSearch = t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(templateSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden font-sans select-none">
      {/* Top Main Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/30">
            <Workflow size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-800">{doc.title}</span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 uppercase">Draw.io Platform</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold">Architecture, ERD, and Mermaid Diagram Studio</p>
          </div>
        </div>

        {/* View Switcher: Visual Canvas vs Mermaid Code */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'visual' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layout size={14} />
            Visual Canvas
          </button>
          <button
            onClick={handleSwitchToMermaid}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'mermaid' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode size={14} />
            Mermaid.js Code
          </button>
        </div>

        {/* Top Action Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all border border-indigo-200 shadow-sm"
            title="Browse pre-built diagram templates"
          >
            <Sparkles size={14} />
            Templates
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <button
            onClick={handleUndo}
            disabled={historyStack.current.length <= 1}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.current.length === 0}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-all"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleOpenFile}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
            title="Open Native Diagram JSON"
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={() => downloadNativeJson(doc)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
            title="Save .diagram.json Project"
          >
            <Save size={16} />
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <button
            onClick={() => downloadPng(doc, 2)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-xl text-xs font-black shadow-md shadow-cyan-600/20 hover:bg-cyan-700 transition-all"
            title="Export full resolution PNG"
          >
            <Download size={14} />
            Export PNG
          </button>
          <button
            onClick={() => downloadSvg(doc)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200"
            title="Export editable Vector SVG"
          >
            SVG
          </button>
        </div>
      </div>

      {/* Import Notification Banner */}
      {importNotification && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{importNotification}</span>
          </div>
          <button onClick={() => setImportNotification(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Studio Viewport */}
      {activeTab === 'visual' ? (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Shape Palette */}
          <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar z-10">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-3">Core Flow & Shapes</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAddShape('rectangle')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-700 transition-all"
                  >
                    <Square size={18} className="text-slate-500" />
                    <span className="text-[10px] font-bold">Process</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('diamond')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-700 transition-all"
                  >
                    <Diamond size={18} className="text-amber-500" />
                    <span className="text-[10px] font-bold">Decision</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('parallelogram')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 text-slate-700 transition-all"
                  >
                    <div className="w-5 h-4 border-2 border-purple-500 -skew-x-12" />
                    <span className="text-[10px] font-bold">Data I/O</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('stadium')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 transition-all"
                  >
                    <div className="w-6 h-3 rounded-full border-2 border-emerald-500" />
                    <span className="text-[10px] font-bold">Terminal</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('cylinder')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-700 transition-all"
                  >
                    <Database size={18} className="text-slate-500" />
                    <span className="text-[10px] font-bold">Database</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('card')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 transition-all"
                  >
                    <div className="w-5 h-4 border-2 border-blue-500 rounded-sm flex flex-col"><div className="h-1 bg-blue-500" /></div>
                    <span className="text-[10px] font-bold">Info Card</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-3">Structured Entities</span>
                <div className="space-y-2">
                  <button
                    onClick={() => handleAddShape('er-table')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-950 font-bold text-xs transition-all shadow-sm"
                  >
                    <Layers size={18} className="text-indigo-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-black">ER Database Table</div>
                      <div className="text-[10px] text-indigo-600 font-medium">Columns, PK/FK tags & relations</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddShape('uml-class')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-400 text-slate-800 font-bold text-xs transition-all"
                  >
                    <Layout size={18} className="text-slate-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-black">UML Class Box</div>
                      <div className="text-[10px] text-slate-500 font-medium">Fields, methods & visibility</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Viewport Scale & Fit-to-screen */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Canvas Zoom</span>
                  <button
                    onClick={handleFitToScreen}
                    className="text-[10px] font-bold text-cyan-600 hover:underline flex items-center gap-1"
                  >
                    <Maximize2 size={11} />
                    Fit Screen
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setViewport(v => ({ ...v, zoom: Math.max(0.3, v.zoom - 0.1) }))}
                    className="p-1 hover:bg-white rounded text-slate-500"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-600">{Math.round(viewport.zoom * 100)}%</span>
                  <button
                    onClick={() => setViewport(v => ({ ...v, zoom: Math.min(2.5, v.zoom + 0.1) }))}
                    className="p-1 hover:bg-white rounded text-slate-500"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
                    className="p-1 hover:bg-white rounded text-slate-500 text-[10px] font-bold"
                    title="Reset Zoom"
                  >
                    100%
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>{doc.nodes.length} Elements</span>
              <span>{doc.edges.length} Connectors</span>
            </div>
          </div>

          {/* Central Pannable / Interactive World Canvas */}
          <div
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className="flex-1 relative overflow-hidden bg-slate-100 cursor-default"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
              backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
              backgroundPosition: `${viewport.x}px ${viewport.y}px`
            }}
          >
            {/* World Container transformed by pan and zoom */}
            <div
              className="absolute inset-0 origin-top-left pointer-events-none"
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              }}
            >
              {/* SVG Edges Layer */}
              <svg className="absolute inset-0 w-[6000px] h-[6000px] pointer-events-none overflow-visible z-0">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#475569" />
                  </marker>
                  <marker id="crowfoot" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M 1 2 L 10 6 L 1 10 M 10 2 L 10 10" stroke="#475569" strokeWidth="1.5" fill="none" />
                  </marker>
                  <marker id="circle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <circle cx="5" cy="5" r="4" fill="#0ea5e9" />
                  </marker>
                </defs>

                {doc.edges.map(e => {
                  const fromNode = doc.nodes.find(n => n.id === e.from);
                  const toNode = doc.nodes.find(n => n.id === e.to);
                  if (!fromNode || !toNode) return null;

                  const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
                  const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

                  const start = getNodeAnchorPoint(fromNode, e.fromAnchor || 'auto', toCenter);
                  const end = getNodeAnchorPoint(toNode, e.toAnchor || 'auto', fromCenter);

                  const { pathData, labelPoint } = computeEdgePath(start, end, e.routing || 'orthogonal', e.waypoints);
                  const isSelected = selectedEdgeId === e.id;
                  const dash = e.style === 'dashed' ? '6,4' : e.style === 'dotted' ? '2,4' : undefined;
                  const marker = e.arrowEnd === 'crowfoot' ? 'url(#crowfoot)' : e.arrowEnd === 'circle' ? 'url(#circle)' : 'url(#arrow)';

                  return (
                    <g
                      key={e.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedEdgeId(e.id);
                        setSelectedNodeIds([]);
                      }}
                    >
                      <path
                        d={pathData}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                      />
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isSelected ? '#06b6d4' : e.strokeColor}
                        strokeWidth={isSelected ? e.strokeWidth + 2 : e.strokeWidth}
                        strokeDasharray={dash}
                        markerEnd={marker}
                      />
                      {e.label && (
                        <g transform={`translate(${labelPoint.x}, ${labelPoint.y})`}>
                          <rect
                            x={-35}
                            y={-12}
                            width={70}
                            height={24}
                            rx={4}
                            fill="#ffffff"
                            stroke={isSelected ? '#06b6d4' : '#cbd5e1'}
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={4}
                            fontSize={10}
                            fontWeight="bold"
                            fontFamily="Inter, sans-serif"
                            fill="#334155"
                            textAnchor="middle"
                          >
                            {e.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Connecting Line Preview */}
                {isConnecting && connectingSource.current && connectionPointer && (() => {
                  const srcNode = doc.nodes.find(n => n.id === connectingSource.current?.nodeId);
                  if (!srcNode) return null;
                  const start = getNodeAnchorPoint(srcNode, connectingSource.current.anchor, connectionPointer);
                  const { pathData } = computeEdgePath(start, connectionPointer, 'orthogonal');
                  return (
                    <path
                      d={pathData}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      strokeDasharray="4,4"
                      markerEnd="url(#arrow)"
                    />
                  );
                })()}
              </svg>

              {/* Nodes Layer */}
              {doc.nodes.map(n => {
                const isSelected = selectedNodeIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    onPointerDown={(e) => handleNodePointerDown(e, n.id)}
                    style={{
                      transform: `translate3d(${n.x}px, ${n.y}px, 0)`,
                      width: n.width,
                      minHeight: n.height,
                    }}
                    className={`absolute pointer-events-auto rounded-xl transition-shadow cursor-move group select-none ${
                      isSelected ? 'ring-2 ring-cyan-500 shadow-2xl z-20' : 'shadow-md hover:shadow-lg z-10'
                    }`}
                  >
                    {/* Anchor Connection Points */}
                    {(['top', 'bottom', 'left', 'right'] as AnchorPosition[]).map(anchor => {
                      const posClass =
                        anchor === 'top' ? '-top-2 left-1/2 -translate-x-1/2' :
                        anchor === 'bottom' ? '-bottom-2 left-1/2 -translate-x-1/2' :
                        anchor === 'left' ? 'top-1/2 -left-2 -translate-y-1/2' :
                        'top-1/2 -right-2 -translate-y-1/2';
                      return (
                        <div
                          key={anchor}
                          onPointerDown={(e) => handleStartConnect(e, n.id, anchor)}
                          onPointerUp={(e) => handleDropConnect(e, n.id, anchor)}
                          className={`absolute ${posClass} w-3.5 h-3.5 bg-white border-2 border-cyan-500 rounded-full cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:scale-125 hover:bg-cyan-500`}
                          title={`Connect from ${anchor}`}
                        />
                      );
                    })}

                    {/* Clean Shape Renderer */}
                    <ShapeRenderer
                      node={n}
                      isEditing={editingNodeId === n.id}
                      onTextChange={(val) => {
                        updateDoc(prev => ({
                          ...prev,
                          nodes: prev.nodes.map(item => item.id === n.id ? { ...item, text: val } : item)
                        }), false);
                      }}
                      onBlur={() => {
                        setEditingNodeId(null);
                        commitToHistory(doc);
                      }}
                      onAddCol={() => {
                        updateDoc(prev => ({
                          ...prev,
                          nodes: prev.nodes.map(item => {
                            if (item.id !== n.id) return item;
                            return {
                              ...item,
                              height: item.height + 26,
                              fields: [...(item.fields || []), { id: `f-${Date.now()}`, name: 'new_col', type: 'varchar(100)' }]
                            };
                          })
                        }));
                      }}
                      onRemoveCol={(idx) => {
                        updateDoc(prev => ({
                          ...prev,
                          nodes: prev.nodes.map(item => {
                            if (item.id !== n.id || !item.fields) return item;
                            return {
                              ...item,
                              height: Math.max(90, item.height - 26),
                              fields: item.fields.filter((_, i) => i !== idx)
                            };
                          })
                        }));
                      }}
                    />

                    {/* Resize Handles */}
                    {isSelected && (
                      <>
                        <div
                          onPointerDown={(e) => handleStartResize(e, n.id, 'se')}
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-600 rounded-sm cursor-se-resize z-40"
                        />
                        <div
                          onPointerDown={(e) => handleStartResize(e, n.id, 'sw')}
                          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-600 rounded-sm cursor-sw-resize z-40"
                        />
                      </>
                    )}
                  </div>
                );
              })}

              {/* Rubber Band Selection Rectangle */}
              {selectionBox && (
                <div
                  className="absolute border border-cyan-500 bg-cyan-500/10 pointer-events-none z-50"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                    width: Math.abs(selectionBox.currentX - selectionBox.startX),
                    height: Math.abs(selectionBox.currentY - selectionBox.startY),
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Inspector / Styling Config Pane */}
          <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar z-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Object Inspector</span>
                <Sliders size={14} className="text-slate-400" />
              </div>

              {activeNode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Entity Label</label>
                    <textarea
                      value={activeNode.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDoc(prev => ({
                          ...prev,
                          nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, text: val } : n)
                        }));
                      }}
                      rows={2}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none resize-none"
                    />
                  </div>

                  {activeNode.type === 'card' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Card Header Title</label>
                      <input
                        value={activeNode.headerText || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateDoc(prev => ({
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, headerText: val } : n)
                          }));
                        }}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                      />
                    </div>
                  )}

                  {/* Typography Controls */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Typography</label>
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 mb-2">
                      <button
                        onClick={() => {
                          updateDoc(prev => ({
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, fontBold: !n.fontBold } : n)
                          }));
                        }}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.fontBold ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Bold"
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        onClick={() => {
                          updateDoc(prev => ({
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, fontItalic: !n.fontItalic } : n)
                          }));
                        }}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.fontItalic ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Italic"
                      >
                        <Italic size={14} />
                      </button>
                      <div className="h-4 w-px bg-slate-200 mx-1" />
                      <button
                        onClick={() => {
                          updateDoc(prev => ({
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, textAlign: 'left' } : n)
                          }));
                        }}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.textAlign === 'left' ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Align Left"
                      >
                        <AlignLeft size={14} />
                      </button>
                      <button
                        onClick={() => {
                          updateDoc(prev => ({
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, textAlign: 'center' } : n)
                          }));
                        }}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.textAlign === 'center' || !activeNode.textAlign ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Align Center"
                      >
                        <AlignCenter size={14} />
                      </button>
                      <button
                        onClick={() => {
                          updateDoc(prev => ({
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, textAlign: 'right' } : n)
                          }));
                        }}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.textAlign === 'right' ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Align Right"
                      >
                        <AlignRight size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">Size:</span>
                      <input
                        type="range"
                        min="10"
                        max="24"
                        value={activeNode.fontSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          updateDoc(prev => ({
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, fontSize: val } : n)
                          }));
                        }}
                        className="flex-1 accent-cyan-600"
                      />
                      <span className="text-[10px] font-bold text-slate-600">{activeNode.fontSize}px</span>
                    </div>
                  </div>

                  {/* Preset Colors */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 flex items-center gap-1">
                      <Palette size={12} />
                      Theme Color
                    </label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c}
                          onClick={() => {
                            updateDoc(prev => ({
                              ...prev,
                              nodes: prev.nodes.map(n => n.id === activeNode.id ? { ...n, fillColor: c, strokeColor: c === '#ffffff' ? '#cbd5e1' : c } : n)
                            }));
                          }}
                          style={{ backgroundColor: c }}
                          className="h-6 rounded-md border border-slate-200 shadow-sm flex items-center justify-center transition-transform hover:scale-110"
                        >
                          {activeNode.fillColor === c && <Check size={11} className={c === '#ffffff' || c === '#f8fafc' ? 'text-slate-800' : 'text-white'} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delete Element Button */}
                  <button
                    onClick={() => {
                      updateDoc(prev => ({
                        ...prev,
                        nodes: prev.nodes.filter(n => n.id !== activeNode.id),
                        edges: prev.edges.filter(e => e.from !== activeNode.id && e.to !== activeNode.id)
                      }));
                      setSelectedNodeIds([]);
                    }}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    Delete Element
                  </button>
                </div>
              ) : activeEdge ? (
                /* Active Edge Inspector */
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Relationship Label</label>
                    <input
                      value={activeEdge.label || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDoc(prev => ({
                          ...prev,
                          edges: prev.edges.map(ed => ed.id === activeEdge.id ? { ...ed, label: val } : ed)
                        }));
                      }}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Routing Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['orthogonal', 'curved', 'straight'] as RoutingType[]).map(rm => (
                        <button
                          key={rm}
                          onClick={() => {
                            updateDoc(prev => ({
                              ...prev,
                              edges: prev.edges.map(ed => ed.id === activeEdge.id ? { ...ed, routing: rm } : ed)
                            }));
                          }}
                          className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                            activeEdge.routing === rm ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {rm}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Line Pattern</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['solid', 'dashed', 'dotted'] as ArrowStyle[]).map(st => (
                        <button
                          key={st}
                          onClick={() => {
                            updateDoc(prev => ({
                              ...prev,
                              edges: prev.edges.map(ed => ed.id === activeEdge.id ? { ...ed, style: st } : ed)
                            }));
                          }}
                          className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                            activeEdge.style === st ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      updateDoc(prev => ({
                        ...prev,
                        edges: prev.edges.filter(ed => ed.id !== activeEdge.id)
                      }));
                      setSelectedEdgeId(null);
                    }}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    Delete Relationship Line
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 font-medium">Select any shape node or relationship line on the canvas to customize properties.</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-cyan-50/70 rounded-2xl border border-cyan-100">
              <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider block mb-1">Canvas Shortcuts</span>
              <p className="text-[10px] text-cyan-700 leading-relaxed">
                Hover over any node to see connection anchors. Drag an anchor to another node to connect. Double-click to edit text.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Mermaid.js Code Tab */
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 p-6 flex flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">Mermaid.js Code Editor</span>
              <button
                onClick={() => setMermaidText(exportDocumentToMermaid(doc))}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                title="Regenerate code from the visual canvas"
              >
                <RotateCcw size={12} />
                Sync From Canvas
              </button>
            </div>
            <textarea
              value={mermaidText}
              onChange={(e) => setMermaidText(e.target.value)}
              className="flex-1 w-full bg-slate-950 font-mono text-xs p-4 rounded-2xl border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500 custom-scrollbar resize-none leading-relaxed"
              placeholder="Write flowchart, erDiagram, or classDiagram syntax..."
            />
            {mermaidError && (
              <div className="mt-3 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>{mermaidError}</span>
              </div>
            )}
          </div>

          <div className="w-1/2 p-6 flex flex-col justify-between bg-slate-50">
            <div className="flex-1 flex flex-col min-h-0">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-3">Live Diagram Preview</span>
              <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-auto flex items-center justify-center">
                {mermaidSvg ? (
                  <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} className="max-w-full" />
                ) : (
                  <span className="text-xs text-slate-400">Rendering preview...</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleImportMermaidToCanvas}
                disabled={Boolean(mermaidError) || !mermaidText.trim()}
                className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Import & Edit on Visual Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Gallery Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">Diagram Template Gallery</h3>
                <p className="text-xs text-slate-400 font-medium">Select a battle-tested template to instantly launch an editable diagram.</p>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                {['All', 'Business & Strategy', 'Engineering & Database', 'Flowchart & Process', 'Project & Planning'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setTemplateCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      templateCategory === cat ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-4">
              {filteredTemplates.map(tmpl => (
                <div
                  key={tmpl.id}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-cyan-500 hover:shadow-xl bg-white cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-600 tracking-wider block mb-1">{tmpl.category}</span>
                    <h4 className="text-sm font-black text-slate-800 group-hover:text-cyan-600 transition-colors mb-2">{tmpl.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">{tmpl.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex gap-1.5">
                      {tmpl.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">#{tag}</span>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-cyan-600 group-hover:translate-x-1 transition-transform">Use Template →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
