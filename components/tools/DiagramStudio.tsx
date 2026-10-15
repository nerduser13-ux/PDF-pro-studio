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
  Code, 
  Check, 
  Sliders, 
  CornerDownRight, 
  MousePointer2, 
  FileCode,
  Layout,
  Workflow
} from 'lucide-react';

export type ShapeType = 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'cylinder' | 'er-table';
export type ArrowStyle = 'solid' | 'dashed' | 'dotted';
export type ArrowHead = 'arrow' | 'crowfoot' | 'circle' | 'none';

export interface DiagramNode {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  textColor: string;
  fontSize: number;
  cornerRadius: number;
  // ER Table specific fields:
  fields?: { name: string; type: string; isPk?: boolean; isFk?: boolean }[];
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: ArrowStyle;
  strokeColor: string;
  strokeWidth: number;
  arrowStart?: ArrowHead;
  arrowEnd: ArrowHead;
}

const PRESET_COLORS = [
  '#4f46e5', '#2563eb', '#0284c7', '#0d9488', 
  '#059669', '#16a34a', '#d97706', '#ea580c', 
  '#e11d48', '#9333ea', '#475569', '#0f172a'
];

const SAMPLE_MERMAID_CODE = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    CUSTOMER }|..|{ DELIVERY_ADDRESS : uses

    CUSTOMER {
        string id PK
        string full_name
        string email
    }
    ORDER {
        int order_no PK
        string user_id FK
        decimal amount
    }
    LINE_ITEM {
        int id PK
        int order_no FK
        int quantity
    }`;

export const DiagramStudio: React.FC = () => {
  // Modes: visual editor or Mermaid code editor
  const [activeTab, setActiveTab] = useState<'visual' | 'mermaid'>('visual');
  const [zoom, setZoom] = useState(1);

  // Nodes & Edges
  const [nodes, setNodes] = useState<DiagramNode[]>([
    {
      id: 'node-1',
      type: 'er-table',
      x: 80,
      y: 100,
      width: 240,
      height: 180,
      text: 'USERS',
      fillColor: '#4f46e5',
      strokeColor: '#312e81',
      strokeWidth: 2,
      textColor: '#ffffff',
      fontSize: 13,
      cornerRadius: 12,
      fields: [
        { name: 'id', type: 'uuid', isPk: true },
        { name: 'email', type: 'varchar(255)' },
        { name: 'full_name', type: 'varchar(100)' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      id: 'node-2',
      type: 'er-table',
      x: 440,
      y: 100,
      width: 240,
      height: 180,
      text: 'ORDERS',
      fillColor: '#059669',
      strokeColor: '#065f46',
      strokeWidth: 2,
      textColor: '#ffffff',
      fontSize: 13,
      cornerRadius: 12,
      fields: [
        { name: 'id', type: 'uuid', isPk: true },
        { name: 'user_id', type: 'uuid', isFk: true },
        { name: 'total_amount', type: 'decimal(10,2)' },
        { name: 'status', type: 'varchar(30)' }
      ]
    },
    {
      id: 'node-3',
      type: 'cylinder',
      x: 760,
      y: 130,
      width: 160,
      height: 120,
      text: 'PostgreSQL DB',
      fillColor: '#0284c7',
      strokeColor: '#0369a1',
      strokeWidth: 2,
      textColor: '#ffffff',
      fontSize: 14,
      cornerRadius: 0
    }
  ]);

  const [edges, setEdges] = useState<DiagramEdge[]>([
    {
      id: 'edge-1',
      from: 'node-1',
      to: 'node-2',
      label: 'places (1:N)',
      style: 'solid',
      strokeColor: '#4f46e5',
      strokeWidth: 2,
      arrowEnd: 'crowfoot'
    },
    {
      id: 'edge-2',
      from: 'node-2',
      to: 'node-3',
      label: 'persists to',
      style: 'dashed',
      strokeColor: '#0284c7',
      strokeWidth: 2,
      arrowEnd: 'arrow'
    }
  ]);

  // Selected object state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-1');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mermaid tab state
  const [mermaidText, setMermaidText] = useState<string>(SAMPLE_MERMAID_CODE);
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);

  // Canvas container ref
  const boardRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });
  }, []);

  // Sync Mermaid preview
  useEffect(() => {
    if (activeTab !== 'mermaid') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const id = `mermaid-studio-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidText);
        if (!cancelled) {
          setMermaidSvg(svg);
          setMermaidError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMermaidError(err?.message || 'Mermaid parsing error');
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mermaidText, activeTab]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  // Node Drag handlers
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setDraggingNodeId(id);
    const node = nodes.find(n => n.id === id);
    if (node) {
      setDragOffset({
        x: (e.clientX / zoom) - node.x,
        y: (e.clientY / zoom) - node.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId) return;
    const newX = Math.round((e.clientX / zoom) - dragOffset.x);
    const newY = Math.round((e.clientY / zoom) - dragOffset.y);
    setNodes(prev =>
      prev.map(n => (n.id === draggingNodeId ? { ...n, x: Math.max(10, newX), y: Math.max(10, newY) } : n))
    );
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Add standard shapes
  const addShape = (type: ShapeType) => {
    const id = `node-${Date.now().toString().slice(-4)}`;
    const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    let width = 160;
    let height = 90;
    let text = 'New Block';
    let fields: any = undefined;

    if (type === 'circle') {
      width = 120;
      height = 120;
      text = 'State';
    } else if (type === 'diamond') {
      width = 140;
      height = 100;
      text = 'Decision?';
    } else if (type === 'cylinder') {
      width = 150;
      height = 110;
      text = 'Database';
    } else if (type === 'er-table') {
      width = 240;
      height = 180;
      text = 'NEW_TABLE';
      fields = [
        { name: 'id', type: 'uuid', isPk: true },
        { name: 'name', type: 'varchar(100)' },
        { name: 'status', type: 'varchar(50)' }
      ];
    }

    const newNode: DiagramNode = {
      id,
      type,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
      width,
      height,
      text,
      fillColor: randomColor,
      strokeColor: '#1e293b',
      strokeWidth: 2,
      textColor: '#ffffff',
      fontSize: 13,
      cornerRadius: type === 'rounded' ? 16 : 8,
      fields
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  // Delete node
  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setEdges(prev => prev.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId));
    setSelectedNodeId(null);
  };

  // Add Edge connection
  const addEdge = (targetId: string) => {
    if (!selectedNodeId || selectedNodeId === targetId) return;
    const id = `edge-${Date.now().toString().slice(-4)}`;
    const newEdge: DiagramEdge = {
      id,
      from: selectedNodeId,
      to: targetId,
      label: 'relates to',
      style: 'solid',
      strokeColor: '#4f46e5',
      strokeWidth: 2,
      arrowEnd: 'arrow'
    };
    setEdges(prev => [...prev, newEdge]);
    setSelectedEdgeId(id);
  };

  // Delete edge
  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges(prev => prev.filter(e => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  };

  // Update selected node props
  const updateSelectedNode = (props: Partial<DiagramNode>) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => (n.id === selectedNodeId ? { ...n, ...props } : n)));
  };

  // Update selected edge props
  const updateSelectedEdge = (props: Partial<DiagramEdge>) => {
    if (!selectedEdgeId) return;
    setEdges(prev => prev.map(e => (e.id === selectedEdgeId ? { ...e, ...props } : e)));
  };

  // ER Table columns manipulation
  const addTableField = (nodeId: string) => {
    setNodes(prev =>
      prev.map(n => {
        if (n.id !== nodeId || !n.fields) return n;
        return {
          ...n,
          height: n.height + 28,
          fields: [...n.fields, { name: 'new_col', type: 'varchar' }]
        };
      })
    );
  };

  const removeTableField = (nodeId: string, index: number) => {
    setNodes(prev =>
      prev.map(n => {
        if (n.id !== nodeId || !n.fields) return n;
        return {
          ...n,
          height: Math.max(120, n.height - 28),
          fields: n.fields.filter((_, idx) => idx !== index)
        };
      })
    );
  };

  // Export options (Draw.io style)
  const generateSvgContent = (): string => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 600; maxY = 400; }
    const padding = 60;
    const totalW = maxX - minX + padding * 2;
    const totalH = maxY - minY + padding * 2;
    const offsetX = minX - padding;
    const offsetY = minY - padding;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#475569" />
        </marker>
        <marker id="crowfoot" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 1 2 L 10 6 L 1 10 M 10 2 L 10 10" stroke="#475569" stroke-width="1.5" fill="none" />
        </marker>
        <filter id="shadow" x="-8%" y="-8%" width="116%" height="116%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="#ffffff" />
    `;

    // Edges
    edges.forEach(e => {
      const fromNode = nodes.find(n => n.id === e.from);
      const toNode = nodes.find(n => n.id === e.to);
      if (!fromNode || !toNode) return;

      const sx = fromNode.x + fromNode.width / 2 - offsetX;
      const sy = fromNode.y + fromNode.height / 2 - offsetY;
      const tx = toNode.x + toNode.width / 2 - offsetX;
      const ty = toNode.y + toNode.height / 2 - offsetY;

      const dx = tx - sx;
      const dy = ty - sy;
      const cx1 = sx + dx * 0.5;
      const cy1 = sy;
      const cx2 = sx + dx * 0.5;
      const cy2 = ty;

      const dashAttr = e.style === 'dashed' ? 'stroke-dasharray="6,4"' : e.style === 'dotted' ? 'stroke-dasharray="2,4"' : '';
      const markerAttr = e.arrowEnd === 'crowfoot' ? 'marker-end="url(#crowfoot)"' : 'marker-end="url(#arrow)"';

      svg += `
        <path d="M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}"
          fill="none" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}" ${dashAttr} ${markerAttr} />
      `;
      if (e.label) {
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        svg += `
          <rect x="${mx - 40}" y="${my - 12}" width="80" height="22" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
          <text x="${mx}" y="${my + 3}" font-family="Inter, sans-serif" font-size="10" font-weight="bold" fill="#334155" text-anchor="middle">${e.label}</text>
        `;
      }
    });

    // Nodes
    nodes.forEach(n => {
      const x = n.x - offsetX;
      const y = n.y - offsetY;

      svg += `<g filter="url(#shadow)">`;

      if (n.type === 'er-table') {
        const headerH = 38;
        svg += `
          <rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="${n.cornerRadius}" fill="#ffffff" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />
          <rect x="${x}" y="${y}" width="${n.width}" height="${headerH}" rx="${n.cornerRadius}" fill="${n.fillColor}" />
          <rect x="${x}" y="${y + headerH - 8}" width="${n.width}" height="8" fill="${n.fillColor}" />
          <text x="${x + 14}" y="${y + 24}" font-family="Inter, sans-serif" font-size="${n.fontSize}" font-weight="900" fill="${n.textColor}" letter-spacing="0.5">${n.text}</text>
        `;
        n.fields?.forEach((f, idx) => {
          const rowY = y + headerH + idx * 26 + 18;
          svg += `
            <text x="${x + 14}" y="${rowY}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#1e293b">${f.name}</text>
            <text x="${x + n.width - 14}" y="${rowY}" font-family="Inter, sans-serif" font-size="10" font-weight="bold" fill="${f.isPk ? '#ef4444' : f.isFk ? '#6366f1' : '#94a3b8'}" text-anchor="end">${f.isPk ? 'PK ' : f.isFk ? 'FK ' : ''}${f.type}</text>
          `;
        });
      } else if (n.type === 'circle') {
        const r = n.width / 2;
        svg += `
          <circle cx="${x + r}" cy="${y + r}" r="${r}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />
          <text x="${x + r}" y="${y + r + 5}" font-family="Inter, sans-serif" font-size="${n.fontSize}" font-weight="bold" fill="${n.textColor}" text-anchor="middle">${n.text}</text>
        `;
      } else if (n.type === 'diamond') {
        const mx = x + n.width / 2;
        const my = y + n.height / 2;
        svg += `
          <polygon points="${mx},${y} ${x + n.width},${my} ${mx},${y + n.height} ${x},${my}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />
          <text x="${mx}" y="${my + 4}" font-family="Inter, sans-serif" font-size="${n.fontSize}" font-weight="bold" fill="${n.textColor}" text-anchor="middle">${n.text}</text>
        `;
      } else if (n.type === 'cylinder') {
        svg += `
          <rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="16" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />
          <text x="${x + n.width / 2}" y="${y + n.height / 2 + 5}" font-family="Inter, sans-serif" font-size="${n.fontSize}" font-weight="bold" fill="${n.textColor}" text-anchor="middle">${n.text}</text>
        `;
      } else {
        svg += `
          <rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="${n.cornerRadius}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />
          <text x="${x + n.width / 2}" y="${y + n.height / 2 + 5}" font-family="Inter, sans-serif" font-size="${n.fontSize}" font-weight="bold" fill="${n.textColor}" text-anchor="middle">${n.text}</text>
        `;
      }

      svg += `</g>`;
    });

    svg += `</svg>`;
    return svg;
  };

  const handleDownloadSvg = () => {
    const svgStr = generateSvgContent();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagram.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const svgStr = generateSvgContent();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'diagram.png';
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleExportJson = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.drawio.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden font-sans">
      {/* Top Studio Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/30">
            <Workflow size={18} />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest text-slate-800">Diagram Studio</h1>
            <p className="text-[10px] text-slate-400 font-semibold">Draw.io Architecture & ER Model Workbench</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'visual' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layout size={14} />
            Visual Canvas (Draw.io)
          </button>
          <button
            onClick={() => setActiveTab('mermaid')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'mermaid' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode size={14} />
            Mermaid.js Code
          </button>
        </div>

        {/* Export Dropdown / Save Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPng}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-xl text-xs font-black shadow-md shadow-cyan-600/20 hover:bg-cyan-700 transition-all"
            title="Download PNG Image"
          >
            <Download size={14} />
            Save PNG
          </button>
          <button
            onClick={handleDownloadSvg}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200"
            title="Export as Vector SVG"
          >
            SVG
          </button>
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200"
            title="Save JSON Model"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      {activeTab === 'visual' ? (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Tool Palette (Shapes & Components) */}
          <div className="w-60 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-3">Add Shapes & Nodes</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addShape('rectangle')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-slate-100 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-600 transition-all group"
                  >
                    <Square size={20} className="text-slate-400 group-hover:text-cyan-600" />
                    <span className="text-[10px] font-bold">Rectangle</span>
                  </button>
                  <button
                    onClick={() => addShape('rounded')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-slate-100 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-600 transition-all group"
                  >
                    <div className="w-5 h-5 rounded-lg border-2 border-slate-400 group-hover:border-cyan-600" />
                    <span className="text-[10px] font-bold">Rounded</span>
                  </button>
                  <button
                    onClick={() => addShape('circle')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-slate-100 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-600 transition-all group"
                  >
                    <Circle size={20} className="text-slate-400 group-hover:text-cyan-600" />
                    <span className="text-[10px] font-bold">Circle</span>
                  </button>
                  <button
                    onClick={() => addShape('diamond')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-slate-100 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-600 transition-all group"
                  >
                    <Diamond size={20} className="text-slate-400 group-hover:text-cyan-600" />
                    <span className="text-[10px] font-bold">Decision</span>
                  </button>
                  <button
                    onClick={() => addShape('cylinder')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-slate-100 hover:border-cyan-500 hover:bg-cyan-50/50 text-slate-600 transition-all group col-span-2"
                  >
                    <Database size={20} className="text-slate-400 group-hover:text-cyan-600" />
                    <span className="text-[10px] font-bold">Database Storage</span>
                  </button>
                  <button
                    onClick={() => addShape('er-table')}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-cyan-200 bg-cyan-50/50 hover:bg-cyan-100/50 text-cyan-900 transition-all col-span-2 shadow-sm"
                  >
                    <Layers size={20} className="text-cyan-600" />
                    <span className="text-[11px] font-black uppercase">ER Database Table</span>
                  </button>
                </div>
              </div>

              {/* Viewport Zoom */}
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Canvas Zoom</span>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:bg-white rounded text-slate-500">
                    <ZoomOut size={16} />
                  </button>
                  <span className="flex-1 text-center font-bold text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-white rounded text-slate-500">
                    <ZoomIn size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold block text-center">Interactive Graph Layer v1.0</span>
            </div>
          </div>

          {/* Central Interactive Infinite Grid Canvas */}
          <div
            ref={boardRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
            className="flex-1 relative overflow-auto custom-scrollbar select-none bg-slate-100"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
              backgroundSize: '24px 24px'
            }}
          >
            <div
              className="w-[2400px] h-[1800px] relative origin-top-left"
              style={{ transform: `scale(${zoom})` }}
            >
              {/* SVG Edges Layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <defs>
                  <marker id="studio-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#4f46e5" />
                  </marker>
                  <marker id="studio-crowfoot" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M 1 2 L 10 6 L 1 10 M 10 2 L 10 10" stroke="#4f46e5" strokeWidth="1.5" fill="none" />
                  </marker>
                </defs>
                {edges.map(e => {
                  const fromNode = nodes.find(n => n.id === e.from);
                  const toNode = nodes.find(n => n.id === e.to);
                  if (!fromNode || !toNode) return null;

                  const sx = fromNode.x + fromNode.width / 2;
                  const sy = fromNode.y + fromNode.height / 2;
                  const tx = toNode.x + toNode.width / 2;
                  const ty = toNode.y + toNode.height / 2;

                  const dx = tx - sx;
                  const dy = ty - sy;
                  const cx1 = sx + dx * 0.5;
                  const cy1 = sy;
                  const cx2 = sx + dx * 0.5;
                  const cy2 = ty;

                  const isSelected = selectedEdgeId === e.id;
                  const strokeDash = e.style === 'dashed' ? '6,4' : e.style === 'dotted' ? '2,4' : undefined;
                  const marker = e.arrowEnd === 'crowfoot' ? 'url(#studio-crowfoot)' : 'url(#studio-arrow)';

                  return (
                    <g key={e.id} className="pointer-events-auto cursor-pointer" onClick={(ev) => { ev.stopPropagation(); setSelectedEdgeId(e.id); setSelectedNodeId(null); }}>
                      <path
                        d={`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
                        fill="none"
                        stroke={isSelected ? '#06b6d4' : e.strokeColor}
                        strokeWidth={isSelected ? e.strokeWidth + 2 : e.strokeWidth}
                        strokeDasharray={strokeDash}
                        markerEnd={marker}
                      />
                      {e.label && (
                        <g>
                          <rect
                            x={(sx + tx) / 2 - 40}
                            y={(sy + ty) / 2 - 12}
                            width="80"
                            height="24"
                            rx="6"
                            fill="#ffffff"
                            stroke={isSelected ? '#06b6d4' : '#cbd5e1'}
                            strokeWidth="1.5"
                          />
                          <text
                            x={(sx + tx) / 2}
                            y={(sy + ty) / 2 + 4}
                            fontSize="10"
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
              </svg>

              {/* Node Components */}
              {nodes.map(n => {
                const isSelected = selectedNodeId === n.id;
                return (
                  <div
                    key={n.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                    style={{
                      transform: `translate3d(${n.x}px, ${n.y}px, 0)`,
                      width: n.width,
                      minHeight: n.height,
                    }}
                    className={`absolute rounded-xl transition-shadow cursor-grab active:cursor-grabbing ${
                      isSelected ? 'ring-4 ring-cyan-500 shadow-2xl' : 'shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {/* ER Table Card */}
                    {n.type === 'er-table' ? (
                      <div
                        style={{
                          borderRadius: `${n.cornerRadius}px`,
                          borderColor: n.strokeColor,
                          borderWidth: `${n.strokeWidth}px`
                        }}
                        className="bg-white border flex flex-col overflow-hidden"
                      >
                        {/* Table Header */}
                        <div
                          style={{ backgroundColor: n.fillColor, color: n.textColor }}
                          className="px-3 py-2 flex items-center justify-between"
                        >
                          <span className="font-black text-xs uppercase tracking-wider truncate">{n.text}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); addTableField(n.id); }}
                            className="p-1 hover:bg-black/20 rounded text-white"
                            title="Add column"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Fields List */}
                        <div className="divide-y divide-slate-100 bg-white">
                          {n.fields?.map((f, fIdx) => (
                            <div key={fIdx} className="px-3 py-1.5 flex items-center justify-between text-[11px] group hover:bg-slate-50">
                              <span className="font-semibold text-slate-700 truncate">{f.name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400">{f.type}</span>
                                {f.isPk && <span className="px-1 py-0.2 bg-red-100 text-red-600 font-black text-[9px] rounded">PK</span>}
                                {f.isFk && <span className="px-1 py-0.2 bg-indigo-100 text-indigo-600 font-black text-[9px] rounded">FK</span>}
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeTableField(n.id, fIdx); }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Standard Shapes (Rectangle, Circle, Diamond, Cylinder) */
                      <div
                        style={{
                          backgroundColor: n.fillColor,
                          borderColor: n.strokeColor,
                          borderWidth: `${n.strokeWidth}px`,
                          borderRadius: n.type === 'circle' ? '9999px' : `${n.cornerRadius}px`,
                          color: n.textColor,
                          height: n.height
                        }}
                        className="flex items-center justify-center p-4 border text-center font-bold text-xs shadow-inner"
                      >
                        <span className="select-none leading-tight">{n.text}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Inspector / Styling Config Pane */}
          <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Object Inspector</span>
                <Sliders size={14} className="text-slate-400" />
              </div>

              {/* Node Inspector */}
              {selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Entity Label</label>
                    <input
                      value={selectedNode.text}
                      onChange={(e) => updateSelectedNode({ text: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                    />
                  </div>

                  {/* Preset Colors */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 flex items-center gap-1">
                      <Palette size={12} />
                      Background / Header Color
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateSelectedNode({ fillColor: c })}
                          style={{ backgroundColor: c }}
                          className="h-7 rounded-lg border-2 border-white shadow-sm flex items-center justify-center transition-transform hover:scale-110"
                        >
                          {selectedNode.fillColor === c && <Check size={12} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corner Radius & Line Thickness */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Corner Radius</label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={selectedNode.cornerRadius}
                        onChange={(e) => updateSelectedNode({ cornerRadius: parseInt(e.target.value) })}
                        className="w-full accent-cyan-600"
                      />
                      <span className="text-[10px] font-bold text-slate-500">{selectedNode.cornerRadius}px</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Border Thickness</label>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={selectedNode.strokeWidth}
                        onChange={(e) => updateSelectedNode({ strokeWidth: parseInt(e.target.value) })}
                        className="w-full accent-cyan-600"
                      />
                      <span className="text-[10px] font-bold text-slate-500">{selectedNode.strokeWidth}px</span>
                    </div>
                  </div>

                  {/* Connector: Link to another table/node */}
                  <div className="pt-3 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1.5">
                      <CornerDownRight size={12} />
                      Connect to Node
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addEdge(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-700 outline-none"
                    >
                      <option value="">+ Connect relation line...</option>
                      {nodes
                        .filter(n => n.id !== selectedNode.id)
                        .map(n => (
                          <option key={n.id} value={n.id}>
                            {n.text}
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    onClick={deleteSelectedNode}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    Delete Element
                  </button>
                </div>
              ) : selectedEdge ? (
                /* Edge Inspector */
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Relationship Label</label>
                    <input
                      value={selectedEdge.label || ''}
                      onChange={(e) => updateSelectedEdge({ label: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Line Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['solid', 'dashed', 'dotted'] as ArrowStyle[]).map(style => (
                        <button
                          key={style}
                          onClick={() => updateSelectedEdge({ style })}
                          className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                            selectedEdge.style === style ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Arrow Head Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateSelectedEdge({ arrowEnd: 'arrow' })}
                        className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                          selectedEdge.arrowEnd === 'arrow' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        Arrow
                      </button>
                      <button
                        onClick={() => updateSelectedEdge({ arrowEnd: 'crowfoot' })}
                        className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                          selectedEdge.arrowEnd === 'crowfoot' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        Crow's Foot (ER)
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={deleteSelectedEdge}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    Delete Relationship Line
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 font-medium">Click on any shape or connector line to customize properties.</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-cyan-50/70 rounded-2xl border border-cyan-100">
              <span className="text-[10px] font-black text-cyan-800 uppercase tracking-wider block mb-1">Draw.io Tip</span>
              <p className="text-[10px] text-cyan-700 leading-relaxed">
                Drag any card to arrange your schema layout. Adjust thickness and corners on the right.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Mermaid Code Tab */
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 p-6 flex flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">Mermaid.js Definition</span>
              <button
                onClick={() => setMermaidText(SAMPLE_MERMAID_CODE)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
              >
                <RotateCcw size={12} />
                Reset Sample
              </button>
            </div>
            <textarea
              value={mermaidText}
              onChange={(e) => setMermaidText(e.target.value)}
              className="flex-1 w-full bg-slate-950 font-mono text-xs p-4 rounded-2xl border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-500 custom-scrollbar resize-none leading-relaxed"
              placeholder="Write Mermaid ER syntax..."
            />
            {mermaidError && (
              <div className="mt-3 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs font-mono">
                {mermaidError}
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
                onClick={() => {
                  const blob = new Blob([mermaidSvg], { type: 'image/svg+xml;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'mermaid-diagram.svg';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={Boolean(mermaidError) || !mermaidSvg}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Download size={14} />
                Download Mermaid SVG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
