import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import mermaid from 'mermaid';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Connection,
  Edge as RFEdge,
  Node as RFNode,
  reconnectEdge,
  Background,
  BackgroundVariant,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Square,
  Circle,
  Diamond,
  Database,
  Layers,
  Type,
  Trash2,
  Plus,
  Download,
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
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import {
  DiagramDocument,
  DiagramNode,
  DiagramEdge,
  ShapeType,
  ArrowStyle,
  RoutingType,
} from '../diagram/types';
import { DIAGRAM_TEMPLATES, TemplateDefinition } from '../diagram/templates';
import { parseMermaidToDocument, exportDocumentToMermaid } from '../diagram/mermaidConverter';
import { downloadPng, downloadSvg, downloadNativeJson } from '../diagram/exportUtils';
import { loadActiveDiagram, saveActiveDiagram } from '../diagram/persistence';
import { CustomDiagramNodeComponent, CustomNodeData } from '../diagram/CustomNode';
import { CustomDiagramEdgeComponent, CustomEdgeData } from '../diagram/CustomEdge';
import { documentNodesToReactFlow, documentEdgesToReactFlow, reactFlowToDocument } from '../diagram/rfAdapter';

const COLOR_PRESETS = [
  '#4f46e5', '#2563eb', '#0284c7', '#0d9488',
  '#059669', '#16a34a', '#84cc16', '#d97706',
  '#f97316', '#e11d48', '#ec4899', '#9333ea',
  '#8b5cf6', '#475569', '#0f172a', '#ffffff',
  '#f8fafc', '#ecfdf5', '#eff6ff', '#fef3c7', '#fff1f2'
];

const nodeTypes = {
  custom: CustomDiagramNodeComponent,
};

const edgeTypes = {
  custom: CustomDiagramEdgeComponent,
};

// Internal Canvas Component within ReactFlowProvider
const DiagramStudioCanvas: React.FC = () => {
  // Base document persistence
  const [docBase, setDocBase] = useState<DiagramDocument>(() => loadActiveDiagram());

  // React Flow state hooks
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode<CustomNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge<CustomEdgeData>>([]);
  const { fitView, zoomIn, zoomOut, setViewport, getViewport, screenToFlowPosition } = useReactFlow();

  // Undo / Redo Stacks
  const historyStack = useRef<DiagramDocument[]>([docBase]);
  const redoStack = useRef<DiagramDocument[]>([]);
  const isUndoRedoAction = useRef(false);

  // Tab & UI state
  const [activeTab, setActiveTab] = useState<'visual' | 'mermaid'>('visual');
  const [currentZoom, setCurrentZoom] = useState<number>(100);

  // Selection
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Modals & Panels
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('All');
  const [importNotification, setImportNotification] = useState<string | null>(null);

  // Mermaid editor state
  const [mermaidText, setMermaidText] = useState<string>('');
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync RF elements when docBase changes externally
  const loadDocIntoCanvas = useCallback((newDoc: DiagramDocument) => {
    setDocBase(newDoc);
    const rfNodes = documentNodesToReactFlow(newDoc.nodes, {
      onNodeChange: (id, updates) => {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...updates } } : n));
      },
      onAddCol: (id) => {
        setNodes(nds => nds.map(n => {
          if (n.id !== id) return n;
          const currFields = n.data.fields || [];
          const newH = ((n.style?.height as number) || n.data.height || 160) + 26;
          return {
            ...n,
            style: { ...n.style, height: newH },
            data: {
              ...n.data,
              height: newH,
              fields: [...currFields, { id: `f-${Date.now()}`, name: 'new_col', type: 'varchar(100)' }]
            }
          };
        }));
      },
      onRemoveCol: (id, colIdx) => {
        setNodes(nds => nds.map(n => {
          if (n.id !== id) return n;
          const currFields = n.data.fields || [];
          const newH = Math.max(90, ((n.style?.height as number) || n.data.height || 160) - 26);
          return {
            ...n,
            style: { ...n.style, height: newH },
            data: {
              ...n.data,
              height: newH,
              fields: currFields.filter((_, i) => i !== colIdx)
            }
          };
        }));
      }
    });
    const rfEdges = documentEdgesToReactFlow(newDoc.edges);
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [setNodes, setEdges]);

  // Initial load
  useEffect(() => {
    loadDocIntoCanvas(docBase);
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 150);
  }, []);

  // Sync back to Document and LocalStorage
  const getLatestDocument = useCallback((): DiagramDocument => {
    return reactFlowToDocument(docBase, nodes, edges);
  }, [docBase, nodes, edges]);

  // Auto-save debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentDoc = getLatestDocument();
      saveActiveDiagram(currentDoc);
    }, 400);
    return () => clearTimeout(timer);
  }, [nodes, edges, getLatestDocument]);

  // Record history
  const commitHistory = useCallback(() => {
    if (isUndoRedoAction.current) return;
    const currentDoc = getLatestDocument();
    historyStack.current.push(currentDoc);
    if (historyStack.current.length > 50) historyStack.current.shift();
    redoStack.current = [];
  }, [getLatestDocument]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyStack.current.length <= 1) return;
    isUndoRedoAction.current = true;
    const current = historyStack.current.pop();
    if (current) redoStack.current.push(current);
    const prev = historyStack.current[historyStack.current.length - 1];
    loadDocIntoCanvas(prev);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    isUndoRedoAction.current = false;
  }, [loadDocIntoCanvas]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    isUndoRedoAction.current = true;
    const next = redoStack.current.pop();
    if (next) {
      historyStack.current.push(next);
      loadDocIntoCanvas(next);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
    }
    isUndoRedoAction.current = false;
  }, [loadDocIntoCanvas]);

  // Viewport updates
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 250 });
  }, [fitView]);

  const handleResetZoom = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
  }, [setViewport]);

  // Edge Connection Handling
  const onConnect = useCallback((params: Connection) => {
    const newEdge: RFEdge<CustomEdgeData> = {
      ...params,
      id: `edge-${Date.now().toString().slice(-4)}`,
      type: 'custom',
      data: {
        from: params.source,
        to: params.target,
        routing: 'orthogonal',
        style: 'solid',
        strokeColor: '#4f46e5',
        strokeWidth: 2,
        arrowEnd: 'arrow',
        label: 'relates to',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4f46e5',
      },
    };
    setEdges(eds => addEdge(newEdge, eds));
    setSelectedEdgeId(newEdge.id);
    commitHistory();
  }, [setEdges, commitHistory]);

  const onReconnect = useCallback((oldEdge: RFEdge, newConnection: Connection) => {
    setEdges(els => reconnectEdge(oldEdge, newConnection, els));
    commitHistory();
  }, [setEdges, commitHistory]);

  // Selection change
  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: RFNode[]; edges: RFEdge[] }) => {
    setSelectedNodeIds(selNodes.map(n => n.id));
    setSelectedEdgeId(selEdges.length > 0 ? selEdges[0].id : null);
  }, []);

  // Add new Shape Node from palette
  const handleAddShape = (type: ShapeType) => {
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

    // Place near center of current viewport
    const vp = getViewport();
    const centerX = (-vp.x + 400) / vp.zoom;
    const centerY = (-vp.y + 300) / vp.zoom;

    const newNode: RFNode<CustomNodeData> = {
      id,
      type: 'custom',
      position: { x: Math.round(centerX - width / 2), y: Math.round(centerY - height / 2) },
      style: { width, height },
      data: {
        id,
        type,
        x: Math.round(centerX - width / 2),
        y: Math.round(centerY - height / 2),
        width,
        height,
        text,
        fillColor,
        strokeColor,
        strokeWidth: 2,
        textColor: type === 'er-table' ? '#ffffff' : '#1e293b',
        fontSize: 13,
        fontBold: type === 'er-table' || type === 'uml-class' || type === 'card',
        cornerRadius: type === 'rounded' ? 16 : cornerRadius,
        fields,
        umlMembers,
      },
    };

    setNodes(nds => [...nds, newNode]);
    setSelectedNodeIds([id]);
    setSelectedEdgeId(null);
    commitHistory();
  };

  // Drag and Drop from left palette onto React Flow Canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const shapeType = event.dataTransfer.getData('application/reactflow') as ShapeType;
      if (!shapeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = `node-${Date.now().toString().slice(-4)}`;
      let width = 180;
      let height = 80;
      let text = 'New Shape';
      let cornerRadius = 8;
      let fillColor = '#eff6ff';
      let strokeColor = '#2563eb';

      if (shapeType === 'circle') {
        width = 100; height = 100; text = 'State'; fillColor = '#ecfdf5'; strokeColor = '#059669';
      } else if (shapeType === 'diamond') {
        width = 140; height = 100; text = 'Decision?'; fillColor = '#fef3c7'; strokeColor = '#d97706';
      } else if (shapeType === 'card') {
        width = 260; height = 150; text = '• Information item 1\n• Information item 2'; fillColor = '#3b82f6'; strokeColor = '#2563eb';
      }

      const newNode: RFNode<CustomNodeData> = {
        id,
        type: 'custom',
        position: { x: Math.round(position.x - width / 2), y: Math.round(position.y - height / 2) },
        style: { width, height },
        data: {
          id,
          type: shapeType,
          x: Math.round(position.x - width / 2),
          y: Math.round(position.y - height / 2),
          width,
          height,
          text,
          fillColor,
          strokeColor,
          strokeWidth: 2,
          textColor: '#1e293b',
          fontSize: 13,
          cornerRadius,
        },
      };

      setNodes(nds => [...nds, newNode]);
      setSelectedNodeIds([id]);
      setSelectedEdgeId(null);
      commitHistory();
    },
    [screenToFlowPosition, setNodes, commitHistory]
  );

  // Sync Mermaid preview on code changes
  useEffect(() => {
    if (activeTab !== 'mermaid') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const id = `mermaid-rf-render-${Date.now()}`;
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
    const currentDoc = getLatestDocument();
    const generated = exportDocumentToMermaid(currentDoc);
    setMermaidText(generated);
    setActiveTab('mermaid');
  };

  // Import Mermaid code into native document and React Flow canvas
  const handleImportMermaidToCanvas = () => {
    const res = parseMermaidToDocument(mermaidText);
    if (!res.success || !res.document) {
      setMermaidError(res.error || 'Failed to parse Mermaid code');
      return;
    }
    loadDocIntoCanvas(res.document);
    commitHistory();
    setActiveTab('visual');
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setImportNotification(`Successfully imported ${res.diagramType || 'diagram'} with ${res.document.nodes.length} nodes and ${res.document.edges.length} connectors into React Flow canvas!`);
    setTimeout(() => {
      setImportNotification(null);
      handleFitView();
    }, 4000);
  };

  // Load a template
  const handleApplyTemplate = (tmpl: TemplateDefinition) => {
    const newDoc = tmpl.createDocument();
    loadDocIntoCanvas(newDoc);
    commitHistory();
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setIsTemplateModalOpen(false);
    setTimeout(handleFitView, 150);
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
          loadDocIntoCanvas(parsed);
          commitHistory();
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
          setTimeout(handleFitView, 150);
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

  // Currently selected active node / edge
  const activeNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    return nodes.find(n => n.id === selectedNodeIds[0]);
  }, [selectedNodeIds, nodes]);

  const activeEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return edges.find(e => e.id === selectedEdgeId);
  }, [selectedEdgeId, edges]);

  // Update active node properties
  const updateActiveNodeData = (updates: Partial<DiagramNode>) => {
    if (!activeNode) return;
    setNodes(nds => nds.map(n => {
      if (n.id !== activeNode.id) return n;
      return {
        ...n,
        data: {
          ...n.data,
          ...updates,
        },
      };
    }));
    commitHistory();
  };

  // Update active edge properties
  const updateActiveEdgeData = (updates: Partial<DiagramEdge>) => {
    if (!activeEdge) return;
    setEdges(eds => eds.map(e => {
      if (e.id !== activeEdge.id) return e;
      const nextData = { ...e.data, ...updates };
      let markerEnd = e.markerEnd;
      if (updates.arrowEnd !== undefined) {
        markerEnd = updates.arrowEnd === 'arrow' ? { type: MarkerType.ArrowClosed, color: nextData.strokeColor || '#475569' } : undefined;
      }
      return {
        ...e,
        data: nextData,
        markerEnd,
      };
    }));
    commitHistory();
  };

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
              <span className="text-xs font-black uppercase tracking-widest text-slate-800">{docBase.title}</span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 uppercase">React Flow Canvas</span>
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
            onClick={() => downloadNativeJson(getLatestDocument())}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
            title="Save .diagram.json Project"
          >
            <Save size={16} />
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <button
            onClick={() => downloadPng(getLatestDocument(), 2)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-xl text-xs font-black shadow-md shadow-cyan-600/20 hover:bg-cyan-700 transition-all"
            title="Export full resolution PNG"
          >
            <Download size={14} />
            Export PNG
          </button>
          <button
            onClick={() => downloadSvg(getLatestDocument())}
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
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'rectangle')}
                    onClick={() => handleAddShape('rectangle')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-700 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <Square size={18} className="text-slate-500" />
                    <span className="text-[10px] font-bold">Process</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'diamond')}
                    onClick={() => handleAddShape('diamond')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-700 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <Diamond size={18} className="text-amber-500" />
                    <span className="text-[10px] font-bold">Decision</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'parallelogram')}
                    onClick={() => handleAddShape('parallelogram')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 text-slate-700 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <div className="w-5 h-4 border-2 border-purple-500 -skew-x-12" />
                    <span className="text-[10px] font-bold">Data I/O</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'stadium')}
                    onClick={() => handleAddShape('stadium')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <div className="w-6 h-3 rounded-full border-2 border-emerald-500" />
                    <span className="text-[10px] font-bold">Terminal</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'cylinder')}
                    onClick={() => handleAddShape('cylinder')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-700 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <Database size={18} className="text-slate-500" />
                    <span className="text-[10px] font-bold">Database</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'card')}
                    onClick={() => handleAddShape('card')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <div className="w-5 h-4 border-2 border-blue-500 rounded-sm flex flex-col"><div className="h-1 bg-blue-500" /></div>
                    <span className="text-[10px] font-bold">Info Card</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-3">Structured Entities</span>
                <div className="space-y-2">
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'er-table')}
                    onClick={() => handleAddShape('er-table')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-950 font-bold text-xs transition-all shadow-sm cursor-grab active:cursor-grabbing"
                  >
                    <Layers size={18} className="text-indigo-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-black">ER Database Table</div>
                      <div className="text-[10px] text-indigo-600 font-medium">Columns, PK/FK tags & relations</div>
                    </div>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'uml-class')}
                    onClick={() => handleAddShape('uml-class')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-400 text-slate-800 font-bold text-xs transition-all cursor-grab active:cursor-grabbing"
                  >
                    <Layout size={18} className="text-slate-600 shrink-0" />
                    <div className="text-left">
                      <div className="font-black">UML Class Box</div>
                      <div className="text-[10px] text-slate-500 font-medium">Fields, methods & visibility</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Viewport Scale & Fit-to-screen Controls */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Canvas Zoom</span>
                  <button
                    onClick={handleFitView}
                    className="text-[10px] font-bold text-cyan-600 hover:underline flex items-center gap-1"
                  >
                    <Maximize2 size={11} />
                    Fit Screen
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <button
                    onClick={() => zoomOut({ duration: 150 })}
                    className="p-1 hover:bg-white rounded text-slate-500"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-600">
                    {Math.round(getViewport().zoom * 100)}%
                  </span>
                  <button
                    onClick={() => zoomIn({ duration: 150 })}
                    className="p-1 hover:bg-white rounded text-slate-500"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="p-1 hover:bg-white rounded text-slate-500 text-[10px] font-bold"
                    title="Reset Zoom to 100%"
                  >
                    100%
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>{nodes.length} Elements</span>
              <span>{edges.length} Connectors</span>
            </div>
          </div>

          {/* Central React Flow Canvas */}
          <div className="flex-1 relative w-full h-full bg-slate-100">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onSelectionChange={onSelectionChange}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              snapToGrid
              snapGrid={[15, 15]}
              defaultEdgeOptions={{
                type: 'custom',
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: '#475569',
                },
              }}
              className="bg-slate-100"
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#cbd5e1" />
            </ReactFlow>
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
                      value={activeNode.data.text}
                      onChange={(e) => updateActiveNodeData({ text: e.target.value })}
                      rows={2}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none resize-none"
                    />
                  </div>

                  {activeNode.data.type === 'card' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Card Header Title</label>
                      <input
                        value={activeNode.data.headerText || ''}
                        onChange={(e) => updateActiveNodeData({ headerText: e.target.value })}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                      />
                    </div>
                  )}

                  {/* Typography Controls */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Typography</label>
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 mb-2">
                      <button
                        onClick={() => updateActiveNodeData({ fontBold: !activeNode.data.fontBold })}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.data.fontBold ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Bold"
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        onClick={() => updateActiveNodeData({ fontItalic: !activeNode.data.fontItalic })}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.data.fontItalic ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Italic"
                      >
                        <Italic size={14} />
                      </button>
                      <button
                        onClick={() => updateActiveNodeData({ fontUnderline: !activeNode.data.fontUnderline })}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.data.fontUnderline ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Underline"
                      >
                        <Underline size={14} />
                      </button>
                      <div className="h-4 w-px bg-slate-200 mx-1" />
                      <button
                        onClick={() => updateActiveNodeData({ textAlign: 'left' })}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.data.textAlign === 'left' ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Align Left"
                      >
                        <AlignLeft size={14} />
                      </button>
                      <button
                        onClick={() => updateActiveNodeData({ textAlign: 'center' })}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.data.textAlign === 'center' || !activeNode.data.textAlign ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
                        title="Align Center"
                      >
                        <AlignCenter size={14} />
                      </button>
                      <button
                        onClick={() => updateActiveNodeData({ textAlign: 'right' })}
                        className={`p-1.5 rounded-lg text-xs font-bold ${activeNode.data.textAlign === 'right' ? 'bg-white shadow text-cyan-600' : 'text-slate-500'}`}
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
                        value={activeNode.data.fontSize || 13}
                        onChange={(e) => updateActiveNodeData({ fontSize: parseInt(e.target.value) })}
                        className="flex-1 accent-cyan-600"
                      />
                      <span className="text-[10px] font-bold text-slate-600">{activeNode.data.fontSize || 13}px</span>
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
                          onClick={() => updateActiveNodeData({ fillColor: c, strokeColor: c === '#ffffff' ? '#cbd5e1' : c })}
                          style={{ backgroundColor: c }}
                          className="h-6 rounded-md border border-slate-200 shadow-sm flex items-center justify-center transition-transform hover:scale-110"
                        >
                          {activeNode.data.fillColor === c && <Check size={11} className={c === '#ffffff' || c === '#f8fafc' ? 'text-slate-800' : 'text-white'} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delete Element Button */}
                  <button
                    onClick={() => {
                      setNodes(nds => nds.filter(n => n.id !== activeNode.id));
                      setEdges(eds => eds.filter(e => e.source !== activeNode.id && e.target !== activeNode.id));
                      setSelectedNodeIds([]);
                      commitHistory();
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
                      value={activeEdge.data?.label || ''}
                      onChange={(e) => updateActiveEdgeData({ label: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Routing Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['orthogonal', 'curved', 'straight'] as RoutingType[]).map(rm => (
                        <button
                          key={rm}
                          onClick={() => updateActiveEdgeData({ routing: rm })}
                          className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                            activeEdge.data?.routing === rm ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-600 border-slate-200'
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
                          onClick={() => updateActiveEdgeData({ style: st })}
                          className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                            activeEdge.data?.style === st ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEdges(eds => eds.filter(ed => ed.id !== activeEdge.id));
                      setSelectedEdgeId(null);
                      commitHistory();
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
              <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider block mb-1">React Flow Canvas</span>
              <p className="text-[10px] text-cyan-700 leading-relaxed">
                Drag from any anchor port to connect. Drag nodes smoothly. Use selection rectangle or Shift+click for multi-selection.
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
                onClick={() => setMermaidText(exportDocumentToMermaid(getLatestDocument()))}
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

export const DiagramStudio: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DiagramStudioCanvas />
    </ReactFlowProvider>
  );
};
