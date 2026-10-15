import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { 
  X, 
  Sparkles, 
  Move, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Database, 
  Check, 
  Copy, 
  Palette, 
  Layers, 
  Code,
  LayoutTemplate
} from 'lucide-react';

interface DiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string, width: number, height: number) => void;
}

interface ERField {
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
}

interface EREntity {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  headerTextColor: string;
  fields: ERField[];
}

interface ERRelation {
  id: string;
  from: string;
  to: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-many';
  label: string;
}

const COLOR_PRESETS = [
  { name: 'Indigo', header: '#4f46e5', text: '#ffffff' },
  { name: 'Blue', header: '#2563eb', text: '#ffffff' },
  { name: 'Emerald', header: '#059669', text: '#ffffff' },
  { name: 'Purple', header: '#9333ea', text: '#ffffff' },
  { name: 'Rose', header: '#e11d48', text: '#ffffff' },
  { name: 'Amber', header: '#d97706', text: '#ffffff' },
  { name: 'Slate', header: '#334155', text: '#ffffff' },
  { name: 'Teal', header: '#0d9488', text: '#ffffff' },
];

const INITIAL_ENTITIES: EREntity[] = [
  {
    id: 'users',
    name: 'USERS',
    x: 60,
    y: 80,
    color: '#4f46e5',
    headerTextColor: '#ffffff',
    fields: [
      { name: 'id', type: 'uuid', isPk: true },
      { name: 'email', type: 'varchar(255)' },
      { name: 'name', type: 'varchar(100)' },
      { name: 'role', type: 'varchar(50)' },
      { name: 'created_at', type: 'timestamp' }
    ]
  },
  {
    id: 'orders',
    name: 'ORDERS',
    x: 380,
    y: 60,
    color: '#059669',
    headerTextColor: '#ffffff',
    fields: [
      { name: 'id', type: 'uuid', isPk: true },
      { name: 'user_id', type: 'uuid', isFk: true },
      { name: 'total_amount', type: 'decimal(10,2)' },
      { name: 'status', type: 'varchar(20)' },
      { name: 'placed_at', type: 'timestamp' }
    ]
  },
  {
    id: 'order_items',
    name: 'ORDER_ITEMS',
    x: 380,
    y: 330,
    color: '#d97706',
    headerTextColor: '#ffffff',
    fields: [
      { name: 'id', type: 'bigint', isPk: true },
      { name: 'order_id', type: 'uuid', isFk: true },
      { name: 'product_id', type: 'uuid', isFk: true },
      { name: 'quantity', type: 'int' },
      { name: 'unit_price', type: 'decimal(10,2)' }
    ]
  },
  {
    id: 'products',
    name: 'PRODUCTS',
    x: 60,
    y: 340,
    color: '#9333ea',
    headerTextColor: '#ffffff',
    fields: [
      { name: 'id', type: 'uuid', isPk: true },
      { name: 'sku', type: 'varchar(50)' },
      { name: 'title', type: 'varchar(200)' },
      { name: 'stock', type: 'int' }
    ]
  }
];

const INITIAL_RELATIONS: ERRelation[] = [
  { id: 'rel-1', from: 'users', to: 'orders', relationType: 'one-to-many', label: 'places' },
  { id: 'rel-2', from: 'orders', to: 'order_items', relationType: 'one-to-many', label: 'contains' },
  { id: 'rel-3', from: 'products', to: 'order_items', relationType: 'one-to-many', label: 'ordered_in' }
];

const SAMPLE_MERMAID = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses

    CUSTOMER {
        string id PK
        string name
        string email
    }
    ORDER {
        int order_number PK
        string status
        date created_at
    }
    LINE-ITEM {
        string product_id FK
        int quantity
        float unit_price
    }`;

export const DiagramModal: React.FC<DiagramModalProps> = ({ isOpen, onClose, onInsert }) => {
  const [tab, setTab] = useState<'visual' | 'code'>('visual');
  const [entities, setEntities] = useState<EREntity[]>(INITIAL_ENTITIES);
  const [relations, setRelations] = useState<ERRelation[]>(INITIAL_RELATIONS);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Mermaid code editor tab
  const [mermaidCode, setMermaidCode] = useState(SAMPLE_MERMAID);
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const [mermaidError, setMermaidError] = useState<string | null>(null);

  // Dragging state for visual mode
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasBoardRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        er: {
          useMaxWidth: false
        }
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Render Mermaid code to SVG when code changes
  useEffect(() => {
    if (tab !== 'code') return;
    let cancelled = false;
    const renderTimer = setTimeout(async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        if (!cancelled) {
          setMermaidSvg(svg);
          setMermaidError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMermaidError(err?.message || 'Syntax error in Mermaid code');
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(renderTimer);
    };
  }, [mermaidCode, tab]);

  if (!isOpen) return null;

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent, entityId: string) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    setSelectedEntityId(entityId);
    setDraggingId(entityId);
    setDragOffset({
      x: e.clientX - entity.x,
      y: e.clientY - entity.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    const newX = Math.max(10, Math.min(1000, e.clientX - dragOffset.x));
    const newY = Math.max(10, Math.min(800, e.clientY - dragOffset.y));
    setEntities(prev =>
      prev.map(item => (item.id === draggingId ? { ...item, x: newX, y: newY } : item))
    );
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  // Add new entity
  const addEntity = () => {
    const id = `table_${Date.now().toString().slice(-4)}`;
    const randomColor = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
    const newEntity: EREntity = {
      id,
      name: `NEW_TABLE_${entities.length + 1}`,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
      color: randomColor.header,
      headerTextColor: randomColor.text,
      fields: [
        { name: 'id', type: 'uuid', isPk: true },
        { name: 'created_at', type: 'timestamp' }
      ]
    };
    setEntities(prev => [...prev, newEntity]);
    setSelectedEntityId(id);
  };

  const removeEntity = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    setRelations(prev => prev.filter(r => r.from !== id && r.to !== id));
    if (selectedEntityId === id) setSelectedEntityId(null);
  };

  const addField = (entityId: string) => {
    setEntities(prev =>
      prev.map(e => {
        if (e.id !== entityId) return e;
        return {
          ...e,
          fields: [...e.fields, { name: 'new_column', type: 'varchar(255)' }]
        };
      })
    );
  };

  const removeField = (entityId: string, fIdx: number) => {
    setEntities(prev =>
      prev.map(e => {
        if (e.id !== entityId) return e;
        return {
          ...e,
          fields: e.fields.filter((_, idx) => idx !== fIdx)
        };
      })
    );
  };

  const updateEntityColor = (entityId: string, color: string, textColor: string) => {
    setEntities(prev =>
      prev.map(e => (e.id === entityId ? { ...e, color, headerTextColor: textColor } : e))
    );
  };

  // Generate Mermaid Code from Visual Entities
  const generateMermaidFromVisual = () => {
    let code = 'erDiagram\n';
    relations.forEach(r => {
      const conn = r.relationType === 'one-to-one' ? '||--||' : r.relationType === 'one-to-many' ? '||--o{' : '}o--o{';
      code += `    ${r.from.toUpperCase()} ${conn} ${r.to.toUpperCase()} : "${r.label}"\n`;
    });
    code += '\n';
    entities.forEach(ent => {
      code += `    ${ent.name.toUpperCase()} {\n`;
      ent.fields.forEach(f => {
        const keyTag = f.isPk ? ' PK' : f.isFk ? ' FK' : '';
        code += `        ${f.type || 'text'} ${f.name}${keyTag}\n`;
      });
      code += '    }\n';
    });
    return code;
  };

  // Render Visual Mode to high-res SVG and insert into PDF Canvas
  const exportVisualToSvgString = () => {
    const CARD_WIDTH = 220;
    const HEADER_HEIGHT = 38;
    const ROW_HEIGHT = 26;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entities.forEach(e => {
      const cardHeight = HEADER_HEIGHT + e.fields.length * ROW_HEIGHT + 10;
      minX = Math.min(minX, e.x);
      minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + CARD_WIDTH);
      maxY = Math.max(maxY, e.y + cardHeight);
    });

    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300; }
    const padding = 40;
    const totalW = maxX - minX + padding * 2;
    const totalH = maxY - minY + padding * 2;

    const offsetX = minX - padding;
    const offsetY = minY - padding;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
      <defs>
        <marker id="arrow-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.1" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="transparent" />
    `;

    // Draw Connector Lines
    relations.forEach(r => {
      const source = entities.find(e => e.id === r.from);
      const target = entities.find(e => e.id === r.to);
      if (!source || !target) return;

      const sourceH = HEADER_HEIGHT + source.fields.length * ROW_HEIGHT;
      const targetH = HEADER_HEIGHT + target.fields.length * ROW_HEIGHT;

      const sx = source.x + CARD_WIDTH / 2 - offsetX;
      const sy = source.y + sourceH / 2 - offsetY;
      const tx = target.x + CARD_WIDTH / 2 - offsetX;
      const ty = target.y + targetH / 2 - offsetY;

      // Curved bezier path
      const dx = tx - sx;
      const dy = ty - sy;
      const cx1 = sx + dx * 0.5;
      const cy1 = sy;
      const cx2 = sx + dx * 0.5;
      const cy2 = ty;

      svg += `
        <path d="M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}"
          fill="none" stroke="#64748b" stroke-width="2.5" stroke-dasharray="6,4" marker-end="url(#arrow-head)" />
        <rect x="${(sx + tx) / 2 - 35}" y="${(sy + ty) / 2 - 12}" width="70" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
        <text x="${(sx + tx) / 2}" y="${(sy + ty) / 2 + 2}" font-family="Inter, sans-serif" font-size="10" font-weight="bold" fill="#475569" text-anchor="middle">${r.label}</text>
      `;
    });

    // Draw Entity Cards
    entities.forEach(ent => {
      const cardX = ent.x - offsetX;
      const cardY = ent.y - offsetY;
      const cardHeight = HEADER_HEIGHT + ent.fields.length * ROW_HEIGHT + 6;

      svg += `
        <g filter="url(#shadow)">
          <!-- Card border & body -->
          <rect x="${cardX}" y="${cardY}" width="${CARD_WIDTH}" height="${cardHeight}" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
          
          <!-- Card header with custom background color -->
          <rect x="${cardX}" y="${cardY}" width="${CARD_WIDTH}" height="${HEADER_HEIGHT}" rx="10" fill="${ent.color}" />
          <!-- Rect to flatten bottom corners of header -->
          <rect x="${cardX}" y="${cardY + HEADER_HEIGHT - 8}" width="${CARD_WIDTH}" height="8" fill="${ent.color}" />
          
          <!-- Table Name -->
          <text x="${cardX + 16}" y="${cardY + 24}" font-family="Inter, sans-serif" font-size="13" font-weight="900" fill="${ent.headerTextColor}" letter-spacing="0.5">${ent.name}</text>
      `;

      // Fields
      ent.fields.forEach((f, idx) => {
        const fy = cardY + HEADER_HEIGHT + idx * ROW_HEIGHT + 18;
        const bgRow = idx % 2 === 1 ? `<rect x="${cardX + 1}" y="${fy - 14}" width="${CARD_WIDTH - 2}" height="${ROW_HEIGHT}" fill="#f8fafc" />` : '';
        const keyBadge = f.isPk
          ? `<rect x="${cardX + CARD_WIDTH - 38}" y="${fy - 11}" width="26" height="14" rx="3" fill="#fee2e2" />
             <text x="${cardX + CARD_WIDTH - 25}" y="${fy}" font-family="Inter, sans-serif" font-size="9" font-weight="bold" fill="#ef4444" text-anchor="middle">PK</text>`
          : f.isFk
          ? `<rect x="${cardX + CARD_WIDTH - 38}" y="${fy - 11}" width="26" height="14" rx="3" fill="#e0e7ff" />
             <text x="${cardX + CARD_WIDTH - 25}" y="${fy}" font-family="Inter, sans-serif" font-size="9" font-weight="bold" fill="#6366f1" text-anchor="middle">FK</text>`
          : '';

        svg += `
          ${bgRow}
          <text x="${cardX + 16}" y="${fy}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#1e293b">${f.name}</text>
          <text x="${cardX + CARD_WIDTH - (f.isPk || f.isFk ? 44 : 14)}" y="${fy}" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="#94a3b8" text-anchor="end">${f.type}</text>
          ${keyBadge}
        `;
      });

      svg += `</g>`;
    });

    svg += `</svg>`;
    return { svg, width: totalW, height: totalH };
  };

  const handleInsertDiagram = async () => {
    try {
      let svgContent = '';
      let w = 500;
      let h = 400;

      if (tab === 'visual') {
        const exported = exportVisualToSvgString();
        svgContent = exported.svg;
        w = exported.width;
        h = exported.height;
      } else {
        if (!mermaidSvg) {
          alert('Please resolve Mermaid syntax errors before inserting.');
          return;
        }
        svgContent = mermaidSvg;
        // Parse svg width/height if available
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (svgEl) {
          const bboxW = parseFloat(svgEl.getAttribute('width') || '600');
          const bboxH = parseFloat(svgEl.getAttribute('height') || '400');
          w = isNaN(bboxW) ? 600 : bboxW;
          h = isNaN(bboxH) ? 400 : bboxH;
        }
      }

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // Convert to image bitmap to avoid fabric SVG import quirk
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || w;
        canvas.height = img.naturalHeight || h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          onInsert(dataUrl, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          onClose();
        }
      };
      img.onerror = () => {
        // Fallback to data URL svg directly
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
        onInsert(dataUrl, w, h);
        URL.revokeObjectURL(url);
        onClose();
      };
      img.src = url;
    } catch (e) {
      console.error('Failed to bake diagram to canvas:', e);
      alert('Error inserting diagram.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                Database & ER Diagram Studio
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase">Interactive</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Design relational DB tables, configure keys, connect foreign keys, or generate with Mermaid code.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl">
              <button
                onClick={() => setTab('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === 'visual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutTemplate size={14} />
                Visual Canvas (Draw.io style)
              </button>
              <button
                onClick={() => {
                  setTab('code');
                  // Update Mermaid text from current visual state
                  setMermaidCode(generateMermaidFromVisual());
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === 'code' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code size={14} />
                Mermaid.js Code
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-all ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {tab === 'visual' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Visual Canvas Area */}
            <div
              ref={canvasBoardRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="flex-1 bg-slate-100 relative overflow-auto custom-scrollbar select-none"
              style={{
                backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
                backgroundSize: '24px 24px'
              }}
            >
              {/* Canvas Action Bar */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-lg">
                <button
                  onClick={addEntity}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
                >
                  <Plus size={14} />
                  Add Table Entity
                </button>
                <div className="h-5 w-px bg-slate-200 mx-1" />
                <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1.5">
                  <Move size={12} />
                  Drag cards to arrange layout
                </span>
              </div>

              {/* Render Connection Lines (SVG layer) */}
              <svg className="absolute inset-0 w-[1400px] h-[1000px] pointer-events-none z-0">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
                  </marker>
                </defs>
                {relations.map(r => {
                  const source = entities.find(e => e.id === r.from);
                  const target = entities.find(e => e.id === r.to);
                  if (!source || !target) return null;
                  const CARD_W = 220;
                  const sx = source.x + CARD_W / 2;
                  const sy = source.y + 40;
                  const tx = target.x + CARD_W / 2;
                  const ty = target.y + 40;
                  const dx = tx - sx;
                  const dy = ty - sy;
                  const cx1 = sx + dx * 0.5;
                  const cy1 = sy;
                  const cx2 = sx + dx * 0.5;
                  const cy2 = ty;
                  return (
                    <g key={r.id}>
                      <path
                        d={`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2.5"
                        strokeDasharray="6,4"
                        markerEnd="url(#arrow)"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Entity Cards */}
              <div className="w-[1400px] h-[1000px] relative z-10 pointer-events-auto">
                {entities.map(ent => {
                  const isSelected = selectedEntityId === ent.id;
                  return (
                    <div
                      key={ent.id}
                      onMouseDown={(e) => handleMouseDown(e, ent.id)}
                      style={{
                        transform: `translate3d(${ent.x}px, ${ent.y}px, 0)`,
                        width: 220,
                      }}
                      className={`absolute rounded-2xl bg-white shadow-xl transition-shadow cursor-grab active:cursor-grabbing border ${
                        isSelected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'
                      }`}
                    >
                      {/* Card Header with Custom Embedded Color */}
                      <div
                        style={{ backgroundColor: ent.color, color: ent.headerTextColor }}
                        className="p-3 rounded-t-2xl flex items-center justify-between"
                      >
                        <input
                          value={ent.name}
                          onChange={(e) =>
                            setEntities(prev =>
                              prev.map(item => (item.id === ent.id ? { ...item, name: e.target.value.toUpperCase() } : item))
                            )
                          }
                          className="bg-transparent font-black text-xs uppercase tracking-wider outline-none w-32 border-b border-transparent focus:border-white/50"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeEntity(ent.id)}
                            className="p-1 hover:bg-black/20 rounded-md text-white/80 hover:text-white transition-all"
                            title="Delete Table"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Fields List */}
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto custom-scrollbar">
                        {ent.fields.map((f, fIdx) => (
                          <div key={fIdx} className="px-3 py-1.5 flex items-center justify-between group hover:bg-slate-50 text-[11px]">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <input
                                value={f.name}
                                onChange={(e) =>
                                  setEntities(prev =>
                                    prev.map(item =>
                                      item.id === ent.id
                                        ? {
                                            ...item,
                                            fields: item.fields.map((col, idx) =>
                                              idx === fIdx ? { ...col, name: e.target.value } : col
                                            )
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="font-semibold text-slate-700 bg-transparent outline-none w-20 truncate border-b border-transparent focus:border-indigo-400"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                value={f.type}
                                onChange={(e) =>
                                  setEntities(prev =>
                                    prev.map(item =>
                                      item.id === ent.id
                                        ? {
                                            ...item,
                                            fields: item.fields.map((col, idx) =>
                                              idx === fIdx ? { ...col, type: e.target.value } : col
                                            )
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="text-[10px] text-slate-400 font-mono bg-transparent outline-none w-14 text-right truncate"
                              />
                              <button
                                onClick={() =>
                                  setEntities(prev =>
                                    prev.map(item =>
                                      item.id === ent.id
                                        ? {
                                            ...item,
                                            fields: item.fields.map((col, idx) =>
                                              idx === fIdx ? { ...col, isPk: !col.isPk, isFk: false } : col
                                            )
                                          }
                                        : item
                                    )
                                  )
                                }
                                className={`text-[9px] font-black px-1 py-0.5 rounded ${
                                  f.isPk ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                                }`}
                                title="Primary Key"
                              >
                                PK
                              </button>
                              <button
                                onClick={() =>
                                  setEntities(prev =>
                                    prev.map(item =>
                                      item.id === ent.id
                                        ? {
                                            ...item,
                                            fields: item.fields.map((col, idx) =>
                                              idx === fIdx ? { ...col, isFk: !col.isFk, isPk: false } : col
                                            )
                                          }
                                        : item
                                    )
                                  )
                                }
                                className={`text-[9px] font-black px-1 py-0.5 rounded ${
                                  f.isFk ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                                }`}
                                title="Foreign Key"
                              >
                                FK
                              </button>
                              <button
                                onClick={() => removeField(ent.id, fIdx)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add column button */}
                      <button
                        onClick={() => addField(ent.id)}
                        className="w-full py-1.5 text-center text-[10px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border-t border-slate-100 rounded-b-2xl transition-all"
                      >
                        + Add Column
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Controls for Selected Entity & Colors */}
            <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Entity Customization</h3>
                  {selectedEntityId ? (
                    <div className="space-y-4">
                      {(() => {
                        const activeEnt = entities.find(e => e.id === selectedEntityId);
                        if (!activeEnt) return null;
                        return (
                          <>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Entity</label>
                              <p className="text-sm font-black text-slate-800">{activeEnt.name}</p>
                            </div>

                            {/* Color Palettes */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1.5">
                                <Palette size={12} />
                                Header Theme Color
                              </label>
                              <div className="grid grid-cols-4 gap-2">
                                {COLOR_PRESETS.map(preset => (
                                  <button
                                    key={preset.name}
                                    onClick={() => updateEntityColor(activeEnt.id, preset.header, preset.text)}
                                    style={{ backgroundColor: preset.header }}
                                    className="h-8 rounded-lg border-2 border-white shadow-sm flex items-center justify-center transition-transform hover:scale-105"
                                    title={preset.name}
                                  >
                                    {activeEnt.color === preset.header && <Check size={14} className="text-white" />}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Relationships Editor */}
                            <div className="pt-2 border-t border-slate-100">
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1.5">
                                <Layers size={12} />
                                Link Foreign Relationship
                              </label>
                              <div className="space-y-2">
                                <select
                                  onChange={(e) => {
                                    const targetId = e.target.value;
                                    if (!targetId || targetId === activeEnt.id) return;
                                    setRelations(prev => [
                                      ...prev,
                                      {
                                        id: `rel-${Date.now()}`,
                                        from: activeEnt.id,
                                        to: targetId,
                                        relationType: 'one-to-many',
                                        label: 'references'
                                      }
                                    ]);
                                    e.target.value = '';
                                  }}
                                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-700 outline-none"
                                >
                                  <option value="">+ Connect to Table...</option>
                                  {entities
                                    .filter(e => e.id !== activeEnt.id)
                                    .map(e => (
                                      <option key={e.id} value={e.id}>
                                        {e.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                      <p className="text-xs text-slate-400">Click any table entity on the canvas to edit colors and configure relations.</p>
                    </div>
                  )}
                </div>

                {/* Existing Relationships List */}
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Active Relations</h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {relations.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-700 truncate max-w-[170px]">
                          {entities.find(e => e.id === r.from)?.name || r.from} → {entities.find(e => e.id === r.to)?.name || r.to}
                        </span>
                        <button
                          onClick={() => setRelations(prev => prev.filter(x => x.id !== r.id))}
                          className="text-slate-300 hover:text-red-500 p-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {relations.length === 0 && (
                      <p className="text-[11px] text-slate-400 italic">No relations created yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Insert Action */}
              <button
                onClick={handleInsertDiagram}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Insert into Document
              </button>
            </div>
          </div>
        ) : (
          /* Mermaid Code Tab */
          <div className="flex-1 flex overflow-hidden">
            {/* Code Input */}
            <div className="w-1/2 p-6 flex flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-indigo-400 font-bold uppercase tracking-wider">Mermaid.js Definition</span>
                <button
                  onClick={() => setMermaidCode(SAMPLE_MERMAID)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                >
                  <RotateCcw size={12} />
                  Load Sample
                </button>
              </div>
              <textarea
                value={mermaidCode}
                onChange={(e) => setMermaidCode(e.target.value)}
                className="flex-1 w-full bg-slate-950 font-mono text-xs p-4 rounded-2xl border border-slate-800 text-emerald-400 focus:outline-none focus:border-indigo-500 custom-scrollbar resize-none leading-relaxed"
                placeholder="Write Mermaid ER syntax..."
              />
              {mermaidError && (
                <div className="mt-3 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs font-mono">
                  {mermaidError}
                </div>
              )}
            </div>

            {/* Live Preview & Action */}
            <div className="w-1/2 p-6 flex flex-col justify-between bg-slate-50">
              <div>
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-3">Live Diagram Preview</span>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[360px] max-h-[500px] overflow-auto flex items-center justify-center">
                  {mermaidSvg ? (
                    <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} className="max-w-full" />
                  ) : (
                    <span className="text-xs text-slate-400">Rendering preview...</span>
                  )}
                </div>
              </div>

              <button
                onClick={handleInsertDiagram}
                disabled={Boolean(mermaidError)}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Sparkles size={16} />
                Insert into Document
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
