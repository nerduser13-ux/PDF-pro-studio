import { DiagramDocument, DiagramNode, DiagramEdge, ShapeType, ERColumn, ArrowStyle, ArrowHead, RoutingType } from './types';

export interface MermaidParseResult {
  success: boolean;
  document?: DiagramDocument;
  error?: string;
  unsupportedFeatures?: string[];
  diagramType?: string;
}

/**
 * Parses Mermaid code and converts into an editable DiagramDocument
 * Supports:
 * - Flowcharts / Graph (graph TD, flowchart LR, etc.)
 * - Entity Relationship Diagrams (erDiagram)
 * - State Diagrams (stateDiagram, stateDiagram-v2)
 * - Class Diagrams (classDiagram)
 */
export function parseMermaidToDocument(code: string): MermaidParseResult {
  const cleanCode = code.trim();
  if (!cleanCode) {
    return { success: false, error: 'Mermaid code is empty' };
  }

  const lines = cleanCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  if (lines.length === 0) {
    return { success: false, error: 'No valid Mermaid instructions found' };
  }

  const header = lines[0].toLowerCase();

  if (header.startsWith('erdiagram')) {
    return parseErDiagram(lines);
  } else if (header.startsWith('graph') || header.startsWith('flowchart')) {
    return parseFlowchart(lines);
  } else if (header.startsWith('statediagram')) {
    return parseStateDiagram(lines);
  } else if (header.startsWith('classdiagram')) {
    return parseClassDiagram(lines);
  }

  return {
    success: false,
    error: `Unsupported Mermaid diagram type "${lines[0]}". Supported types: flowchart/graph, erDiagram, classDiagram, stateDiagram.`,
    unsupportedFeatures: [lines[0]],
  };
}

/**
 * Parser for Mermaid Flowchart
 */
function parseFlowchart(lines: string[]): MermaidParseResult {
  const nodesMap = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  const unsupported: string[] = [];

  // Determine direction (TD, TB, LR, RL)
  const header = lines[0];
  const isHorizontal = header.toUpperCase().includes('LR') || header.toUpperCase().includes('RL');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('subgraph') || line === 'end') {
      unsupported.push(line);
      continue;
    }

    // Match edge patterns:
    // e.g. A["Text"] --> B{"Text"}, B -->|"Yes"| C["Text"], B -.->|"No"| D["Text"]
    const edgeMatch = line.match(/^([a-zA-Z0-9_\-]+(?:\[.*?\]|\(.*?\)|<.*?>|\{.*?\}|\([\[\(].*?[\)\]]\))?)\s*(-->|--\s*".*?"\s*-->|--\s*.*?\s*-->|-\.->|==>|--)(?:\|"?(.*?)"?\|)?\s*([a-zA-Z0-9_\-]+(?:\[.*?\]|\(.*?\)|<.*?>|\{.*?\}|\([\[\(].*?[\)\]]\))?)/);

    if (edgeMatch) {
      const rawSource = edgeMatch[1];
      const rawConnector = edgeMatch[2];
      const pipeLabel = edgeMatch[3];
      const rawTarget = edgeMatch[4];

      const sourceNode = parseOrCreateNode(rawSource, nodesMap);
      const targetNode = parseOrCreateNode(rawTarget, nodesMap);

      // Parse edge label and style
      let label: string | undefined = pipeLabel?.trim();
      if (!label) {
        const labelMatch = rawConnector.match(/--\s*"?([^"-]+)"?\s*-->/);
        if (labelMatch) {
          label = labelMatch[1].trim();
        }
      }

      let style: ArrowStyle = 'solid';
      let strokeWidth = 2;
      let strokeColor = '#475569';
      if (rawConnector.includes('-.->')) {
        style = 'dashed';
        strokeColor = '#64748b';
      } else if (rawConnector.includes('==>')) {
        strokeWidth = 3;
        strokeColor = '#2563eb';
      }

      edges.push({
        id: `edge-${edges.length + 1}`,
        from: sourceNode.id,
        to: targetNode.id,
        label,
        style,
        routing: isHorizontal ? 'orthogonal' : 'straight',
        strokeColor,
        strokeWidth,
        arrowEnd: 'arrow',
      });
    } else {
      // Standalone node definition: NodeId[Label]
      const nodeMatch = line.match(/^([a-zA-Z0-9_\-]+(?:\[.*?\]|\(.*?\)|<.*?>|\{.*?\}|\([\[\(].*?[\)\]]\))?)$/);
      if (nodeMatch) {
        parseOrCreateNode(nodeMatch[1], nodesMap);
      }
    }
  }

  // Automatic grid layout
  const nodes = Array.from(nodesMap.values());
  applyAutoLayout(nodes, edges, isHorizontal);

  return {
    success: true,
    diagramType: 'Flowchart',
    document: {
      id: `imported-${Date.now()}`,
      title: 'Imported Mermaid Flowchart',
      version: 1,
      canvas: { gridSize: 20, showGrid: true, snapToGrid: true, backgroundColor: '#ffffff' },
      nodes,
      edges,
    },
    unsupportedFeatures: unsupported.length > 0 ? unsupported : undefined,
  };
}

/**
 * Extracts node ID and shape styling from Mermaid node syntax
 */
function parseOrCreateNode(raw: string, nodesMap: Map<string, DiagramNode>): DiagramNode {
  let id = raw;
  let text = raw;
  let type: ShapeType = 'rectangle';
  let cornerRadius = 8;
  let fillColor = '#ffffff';
  let strokeColor = '#3b82f6';

  // Check brackets: [Text] -> rectangle, (Text) -> rounded, ((Text)) -> circle, {Text} -> diamond, [(Text)] -> cylinder
  if (raw.includes('[(') && raw.includes(')]')) {
    id = raw.substring(0, raw.indexOf('[(')).trim();
    text = raw.substring(raw.indexOf('[(') + 2, raw.lastIndexOf(')]')).trim();
    type = 'cylinder';
    fillColor = '#eff6ff';
  } else if (raw.includes('((') && raw.includes('))')) {
    id = raw.substring(0, raw.indexOf('((')).trim();
    text = raw.substring(raw.indexOf('((') + 2, raw.lastIndexOf('))')).trim();
    type = 'circle';
    fillColor = '#ecfdf5';
    strokeColor = '#10b981';
  } else if (raw.includes('{') && raw.includes('}')) {
    id = raw.substring(0, raw.indexOf('{')).trim();
    text = raw.substring(raw.indexOf('{') + 1, raw.lastIndexOf('}')).trim();
    type = 'diamond';
    fillColor = '#fef3c7';
    strokeColor = '#f59e0b';
  } else if (raw.includes('(') && raw.includes(')')) {
    id = raw.substring(0, raw.indexOf('(')).trim();
    text = raw.substring(raw.indexOf('(') + 1, raw.lastIndexOf(')')).trim();
    type = 'rounded';
    cornerRadius = 16;
    fillColor = '#f8fafc';
  } else if (raw.includes('[') && raw.includes(']')) {
    id = raw.substring(0, raw.indexOf('[')).trim();
    text = raw.substring(raw.indexOf('[') + 1, raw.lastIndexOf(']')).trim();
    type = 'rectangle';
    fillColor = '#ffffff';
  }

  // Remove quotes around label if present
  text = text.replace(/^"/, '').replace(/"$/, '');

  const existing = nodesMap.get(id);
  if (existing) {
    if (text !== id && existing.text === id) {
      existing.text = text;
      existing.type = type;
      existing.fillColor = fillColor;
      existing.strokeColor = strokeColor;
      existing.cornerRadius = cornerRadius;
    }
    return existing;
  }

  const newNode: DiagramNode = {
    id,
    type,
    x: 0,
    y: 0,
    width: type === 'circle' ? 100 : type === 'diamond' ? 140 : 160,
    height: type === 'circle' ? 100 : type === 'diamond' ? 100 : 80,
    text,
    fillColor,
    strokeColor,
    strokeWidth: 2,
    textColor: '#1e293b',
    fontSize: 12,
    fontBold: true,
    cornerRadius,
  };

  nodesMap.set(id, newNode);
  return newNode;
}

/**
 * Parser for Mermaid ER Diagrams
 */
function parseErDiagram(lines: string[]): MermaidParseResult {
  const tablesMap = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  const palette = ['#4f46e5', '#059669', '#d97706', '#9333ea', '#2563eb', '#e11d48'];
  let colorIdx = 0;

  let currentTable: DiagramNode | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Inside table block: column definitions
    if (currentTable) {
      if (line === '}') {
        currentTable = null;
        continue;
      }
      // Column pattern: type name [PK/FK] ["comment"]
      const colParts = line.split(/\s+/);
      if (colParts.length >= 2) {
        const type = colParts[0];
        const name = colParts[1];
        const isPk = line.toUpperCase().includes(' PK');
        const isFk = line.toUpperCase().includes(' FK');
        currentTable.fields?.push({
          id: `col-${currentTable.fields.length + 1}`,
          name,
          type,
          isPk,
          isFk,
        });
        currentTable.height += 26;
      }
      continue;
    }

    // Start table definition: TABLE_NAME {
    const tableHeaderMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*\{$/);
    if (tableHeaderMatch) {
      const tableName = tableHeaderMatch[1].toUpperCase();
      let table = tablesMap.get(tableName);
      if (!table) {
        const headerColor = palette[colorIdx % palette.length];
        colorIdx++;
        table = {
          id: tableName.toLowerCase(),
          type: 'er-table',
          x: 0,
          y: 0,
          width: 250,
          height: 90,
          text: tableName,
          fillColor: headerColor,
          strokeColor: '#334155',
          strokeWidth: 2,
          textColor: '#ffffff',
          fontSize: 13,
          cornerRadius: 12,
          fields: [],
        };
        tablesMap.set(tableName, table);
      }
      currentTable = table;
      continue;
    }

    // Relationship line: TABLE_A ||--o{ TABLE_B : label
    const relMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*(\|\||\|o|\}o|\}\||\}o)\s*([-\.]{2})\s*(\|\||o\{|\|\{|o\|)\s*([a-zA-Z0-9_\-]+)\s*(?::\s*"?([^"]*)"?)?$/);
    if (relMatch) {
      const fromName = relMatch[1].toUpperCase();
      const leftCard = relMatch[2];
      const relLine = relMatch[3];
      const rightCard = relMatch[4];
      const toName = relMatch[5].toUpperCase();
      const label = relMatch[6]?.trim();

      const getOrCreateTable = (name: string): DiagramNode => {
        let t = tablesMap.get(name);
        if (!t) {
          const headerColor = palette[colorIdx % palette.length];
          colorIdx++;
          t = {
            id: name.toLowerCase(),
            type: 'er-table',
            x: 0,
            y: 0,
            width: 240,
            height: 120,
            text: name,
            fillColor: headerColor,
            strokeColor: '#334155',
            strokeWidth: 2,
            textColor: '#ffffff',
            fontSize: 13,
            cornerRadius: 12,
            fields: [],
          };
          tablesMap.set(name, t);
        }
        return t;
      };

      const source = getOrCreateTable(fromName);
      const target = getOrCreateTable(toName);

      const isDashed = relLine.includes('.');
      const isCrowfoot = rightCard.includes('{') || leftCard.includes('}');

      edges.push({
        id: `er-edge-${edges.length + 1}`,
        from: source.id,
        to: target.id,
        label: label || undefined,
        style: isDashed ? 'dashed' : 'solid',
        routing: 'orthogonal',
        strokeColor: source.fillColor,
        strokeWidth: 2,
        arrowEnd: isCrowfoot ? 'crowfoot' : 'arrow',
        cardinality: isCrowfoot ? '1:N' : '1:1',
      });
    }
  }

  const nodes = Array.from(tablesMap.values());
  applyAutoLayout(nodes, edges, true);

  return {
    success: true,
    diagramType: 'ER Diagram',
    document: {
      id: `imported-erd-${Date.now()}`,
      title: 'Imported Mermaid ER Diagram',
      version: 1,
      canvas: { gridSize: 20, showGrid: true, snapToGrid: true, backgroundColor: '#ffffff' },
      nodes,
      edges,
    },
  };
}

/**
 * Parser for Mermaid Class Diagrams
 */
function parseClassDiagram(lines: string[]): MermaidParseResult {
  const classMap = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];

  let currentClass: DiagramNode | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (currentClass) {
      if (line === '}') {
        currentClass = null;
        continue;
      }
      const vis = line[0] === '+' || line[0] === '-' || line[0] === '#' ? (line[0] as any) : '+';
      const cleanMember = line.replace(/^[+\-#~]\s*/, '');
      const isMethod = cleanMember.includes('(');
      currentClass.umlMembers?.push({
        id: `m-${currentClass.umlMembers.length + 1}`,
        visibility: vis,
        name: cleanMember,
        isMethod,
      });
      currentClass.height += 24;
      continue;
    }

    const classHeaderMatch = line.match(/^class\s+([a-zA-Z0-9_\-]+)\s*\{$/);
    if (classHeaderMatch) {
      const name = classHeaderMatch[1];
      const cls: DiagramNode = {
        id: name.toLowerCase(),
        type: 'uml-class',
        x: 0,
        y: 0,
        width: 240,
        height: 100,
        text: name,
        fillColor: '#f8fafc',
        strokeColor: '#334155',
        strokeWidth: 2,
        textColor: '#0f172a',
        fontSize: 13,
        fontBold: true,
        cornerRadius: 8,
        umlMembers: [],
      };
      classMap.set(name, cls);
      currentClass = cls;
      continue;
    }

    // Relationship: ClassA <|-- ClassB
    const relMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*(<\|--|--\|>|-->|<--|\*--|--\*)\s*([a-zA-Z0-9_\-]+)/);
    if (relMatch) {
      const from = relMatch[1];
      const to = relMatch[3];
      const getOrCreate = (n: string) => {
        let node = classMap.get(n);
        if (!node) {
          node = {
            id: n.toLowerCase(),
            type: 'uml-class',
            x: 0,
            y: 0,
            width: 220,
            height: 110,
            text: n,
            fillColor: '#f8fafc',
            strokeColor: '#334155',
            strokeWidth: 2,
            textColor: '#0f172a',
            fontSize: 13,
            fontBold: true,
            cornerRadius: 8,
            umlMembers: [],
          };
          classMap.set(n, node);
        }
        return node;
      };
      const n1 = getOrCreate(from);
      const n2 = getOrCreate(to);
      edges.push({
        id: `class-edge-${edges.length + 1}`,
        from: n1.id,
        to: n2.id,
        label: 'inherits',
        style: 'solid',
        routing: 'orthogonal',
        strokeColor: '#475569',
        strokeWidth: 2,
        arrowEnd: 'arrow',
      });
    }
  }

  const nodes = Array.from(classMap.values());
  applyAutoLayout(nodes, edges, false);

  return {
    success: true,
    diagramType: 'Class Diagram',
    document: {
      id: `imported-class-${Date.now()}`,
      title: 'Imported Mermaid Class Diagram',
      version: 1,
      canvas: { gridSize: 20, showGrid: true, snapToGrid: true, backgroundColor: '#ffffff' },
      nodes,
      edges,
    },
  };
}

/**
 * Parser for Mermaid State Diagrams
 */
function parseStateDiagram(lines: string[]): MermaidParseResult {
  const nodesMap = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const transMatch = line.match(/^([a-zA-Z0-9_\*]+)\s*-->\s*([a-zA-Z0-9_\*]+)(?:\s*:\s*(.*))?$/);
    if (transMatch) {
      let from = transMatch[1];
      let to = transMatch[2];
      const label = transMatch[3]?.trim();

      const getOrCreateState = (name: string): DiagramNode => {
        if (name === '[*]') {
          const isInitial = !nodesMap.has('state_start');
          const id = isInitial ? 'state_start' : `state_end_${nodesMap.size}`;
          const circleNode: DiagramNode = {
            id,
            type: 'circle',
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            text: isInitial ? 'Start' : 'End',
            fillColor: '#0f172a',
            strokeColor: '#334155',
            strokeWidth: 2,
            textColor: '#ffffff',
            fontSize: 10,
            cornerRadius: 0,
          };
          nodesMap.set(id, circleNode);
          return circleNode;
        }

        let node = nodesMap.get(name);
        if (!node) {
          node = {
            id: name.toLowerCase(),
            type: 'rounded',
            x: 0,
            y: 0,
            width: 150,
            height: 70,
            text: name,
            fillColor: '#eff6ff',
            strokeColor: '#2563eb',
            strokeWidth: 2,
            textColor: '#1e3a8a',
            fontSize: 12,
            fontBold: true,
            cornerRadius: 14,
          };
          nodesMap.set(name, node);
        }
        return node;
      };

      const s1 = getOrCreateState(from);
      const s2 = getOrCreateState(to);

      edges.push({
        id: `state-edge-${edges.length + 1}`,
        from: s1.id,
        to: s2.id,
        label,
        style: 'solid',
        routing: 'curved',
        strokeColor: '#2563eb',
        strokeWidth: 2,
        arrowEnd: 'arrow',
      });
    }
  }

  const nodes = Array.from(nodesMap.values());
  applyAutoLayout(nodes, edges, false);

  return {
    success: true,
    diagramType: 'State Diagram',
    document: {
      id: `imported-state-${Date.now()}`,
      title: 'Imported Mermaid State Diagram',
      version: 1,
      canvas: { gridSize: 20, showGrid: true, snapToGrid: true, backgroundColor: '#ffffff' },
      nodes,
      edges,
    },
  };
}

/**
 * Calculates a clean topological/grid layout for imported nodes
 */
function applyAutoLayout(nodes: DiagramNode[], edges: DiagramEdge[], isHorizontal: boolean) {
  if (nodes.length === 0) return;

  const cols = isHorizontal ? Math.max(2, Math.ceil(Math.sqrt(nodes.length))) : Math.min(3, nodes.length);
  const colSpacing = 300;
  const rowSpacing = 200;
  const startX = 100;
  const startY = 100;

  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    node.x = startX + col * colSpacing;
    node.y = startY + row * rowSpacing;
  });
}

/**
 * Converts a native DiagramDocument into valid Mermaid syntax
 */
export function exportDocumentToMermaid(doc: DiagramDocument): string {
  // If diagram contains ER tables, export erDiagram
  const hasErTables = doc.nodes.some(n => n.type === 'er-table');
  if (hasErTables) {
    let out = 'erDiagram\n';
    doc.edges.forEach(e => {
      const fromNode = doc.nodes.find(n => n.id === e.from);
      const toNode = doc.nodes.find(n => n.id === e.to);
      if (fromNode && toNode) {
        const conn = e.cardinality === '1:N' ? '||--o{' : e.cardinality === 'N:M' ? '}o--o{' : '||--||';
        const label = e.label ? ` : "${e.label}"` : '';
        out += `    ${fromNode.text.toUpperCase()} ${conn} ${toNode.text.toUpperCase()}${label}\n`;
      }
    });
    out += '\n';
    doc.nodes.filter(n => n.type === 'er-table').forEach(n => {
      out += `    ${n.text.toUpperCase()} {\n`;
      n.fields?.forEach(f => {
        const pkFk = f.isPk ? ' PK' : f.isFk ? ' FK' : '';
        out += `        ${f.type || 'string'} ${f.name}${pkFk}\n`;
      });
      out += '    }\n';
    });
    return out;
  }

  // Default to flowchart TD
  let out = 'flowchart TD\n';
  doc.nodes.forEach(n => {
    const safeText = n.text.replace(/\n/g, '<br/>');
    if (n.type === 'circle') {
      out += `    ${n.id}(("${safeText}"))\n`;
    } else if (n.type === 'diamond') {
      out += `    ${n.id}{"${safeText}"}\n`;
    } else if (n.type === 'cylinder') {
      out += `    ${n.id}[("${safeText}")]\n`;
    } else if (n.type === 'rounded') {
      out += `    ${n.id}("${safeText}")\n`;
    } else {
      out += `    ${n.id}["${safeText}"]\n`;
    }
  });

  doc.edges.forEach(e => {
    const conn = e.style === 'dashed' ? '-.->' : '-->';
    const label = e.label ? `|"${e.label}"|` : '';
    out += `    ${e.from} ${conn}${label} ${e.to}\n`;
  });

  return out;
}
