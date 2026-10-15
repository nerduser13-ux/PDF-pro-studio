import * as dagre from 'dagre-d3-es/src/dagre/index.js';
import * as graphlib from 'dagre-d3-es/src/graphlib/index.js';
import { DiagramDocument, DiagramNode, DiagramEdge, ShapeType, ERColumn, ArrowStyle, ArrowHead, RoutingType } from './types';

export interface MermaidParseResult {
  success: boolean;
  document?: DiagramDocument;
  error?: string;
  unsupportedFeatures?: string[];
  diagramType?: string;
}

/**
 * Sanitizes and cleans Mermaid labels by replacing HTML-style line breaks (<br/>, <br>, <br />)
 * with actual newlines, decoding HTML entities, and trimming quotes.
 */
export function cleanMermaidLabel(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();

  // Strip leading/trailing surrounding quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }

  // Convert HTML line breaks to real newlines
  str = str.replace(/<br\s*\/?>/gi, '\n');
  str = str.replace(/\\n/g, '\n');

  // Decode standard HTML entities
  str = str.replace(/&amp;/g, '&');
  str = str.replace(/&lt;/g, '<');
  str = str.replace(/&gt;/g, '>');
  str = str.replace(/&quot;/g, '"');
  str = str.replace(/&#39;/g, "'");

  return str;
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

  // Determine direction (TD, TB, LR, RL, BT)
  const header = lines[0];
  let rankdir = 'TB';
  if (header.toUpperCase().includes('LR')) rankdir = 'LR';
  else if (header.toUpperCase().includes('RL')) rankdir = 'RL';
  else if (header.toUpperCase().includes('BT')) rankdir = 'BT';

  const isHorizontal = rankdir === 'LR' || rankdir === 'RL';

  // Store classDef and style rules
  const classDefs = new Map<string, Record<string, string>>();
  const nodeClasses = new Map<string, string>();
  const nodeInlineStyles = new Map<string, Record<string, string>>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('subgraph') || line === 'end') {
      unsupported.push(line);
      continue;
    }

    // 1. classDef className key:val,key:val...
    const classDefMatch = line.match(/^classDef\s+([a-zA-Z0-9_\-]+)\s+(.+)$/);
    if (classDefMatch) {
      const cName = classDefMatch[1];
      const props: Record<string, string> = {};
      classDefMatch[2].split(',').forEach(kv => {
        const [k, v] = kv.split(':').map(s => s?.trim());
        if (k && v) props[k.toLowerCase()] = v;
      });
      classDefs.set(cName, props);
      continue;
    }

    // 2. class NodeA,NodeB className
    const classAssignMatch = line.match(/^class\s+([a-zA-Z0-9_\-,\s]+)\s+([a-zA-Z0-9_\-]+)$/);
    if (classAssignMatch) {
      const nodeIds = classAssignMatch[1].split(',').map(s => s.trim());
      const cName = classAssignMatch[2];
      nodeIds.forEach(id => {
        if (id) nodeClasses.set(id, cName);
      });
      continue;
    }

    // 3. style NodeA fill:#fff,stroke:#000
    const styleMatch = line.match(/^style\s+([a-zA-Z0-9_\-]+)\s+(.+)$/);
    if (styleMatch) {
      const nId = styleMatch[1];
      const props: Record<string, string> = {};
      styleMatch[2].split(',').forEach(kv => {
        const [k, v] = kv.split(':').map(s => s?.trim());
        if (k && v) props[k.toLowerCase()] = v;
      });
      nodeInlineStyles.set(nId, props);
      continue;
    }

    // 4. Edge patterns:
    // e.g. A["Text"] --> B{"Text"}, B -->|"Yes"| C["Text"], B -.->|"No"| D["Text"]
    // also supports node with class tag: A:::className --> B
    const edgeMatch = line.match(/^([a-zA-Z0-9_\-]+(?:\[.*?\]|\(.*?\)|<.*?>|\{.*?\}|\([\[\(].*?[\)\]]\)|\[\/.*?\/\]|\[\\.*?\\\])?(?:::([a-zA-Z0-9_\-]+))?)\s*(-->|--\s*".*?"\s*-->|--\s*.*?\s*-->|-\.->|==>|--)(?:\|"?(.*?)"?\|)?\s*([a-zA-Z0-9_\-]+(?:\[.*?\]|\(.*?\)|<.*?>|\{.*?\}|\([\[\(].*?[\)\]]\)|\[\/.*?\/\]|\[\\.*?\\\])?(?:::([a-zA-Z0-9_\-]+))?)/);

    if (edgeMatch) {
      const rawSource = edgeMatch[1];
      const sourceClass = edgeMatch[2];
      const rawConnector = edgeMatch[3];
      const pipeLabel = edgeMatch[4];
      const rawTarget = edgeMatch[5];
      const targetClass = edgeMatch[6];

      // Strip :::class if present
      const cleanSource = rawSource.replace(/:::[a-zA-Z0-9_\-]+$/, '');
      const cleanTarget = rawTarget.replace(/:::[a-zA-Z0-9_\-]+$/, '');

      const sourceNode = parseOrCreateNode(cleanSource, nodesMap);
      const targetNode = parseOrCreateNode(cleanTarget, nodesMap);

      if (sourceClass) nodeClasses.set(sourceNode.id, sourceClass);
      if (targetClass) nodeClasses.set(targetNode.id, targetClass);

      // Parse edge label and style
      let label: string | undefined = pipeLabel ? cleanMermaidLabel(pipeLabel) : undefined;
      if (!label) {
        const labelMatch = rawConnector.match(/--\s*"?([^"-]+)"?\s*-->/);
        if (labelMatch) {
          label = cleanMermaidLabel(labelMatch[1]);
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
      // Standalone node definition: NodeId[Label] or NodeId:::className
      let standalone = line;
      let inlineClass: string | undefined = undefined;
      const classSuffix = standalone.match(/(.+):::([a-zA-Z0-9_\-]+)$/);
      if (classSuffix) {
        standalone = classSuffix[1];
        inlineClass = classSuffix[2];
      }

      const nodeMatch = standalone.match(/^([a-zA-Z0-9_\-]+(?:\[.*?\]|\(.*?\)|<.*?>|\{.*?\}|\([\[\(].*?[\)\]]\)|\[\/.*?\/\]|\[\\.*?\\\])?)$/);
      if (nodeMatch) {
        const node = parseOrCreateNode(nodeMatch[1], nodesMap);
        if (inlineClass) {
          nodeClasses.set(node.id, inlineClass);
        }
      }
    }
  }

  // Apply parsed classes & styles to nodes
  nodesMap.forEach(node => {
    const cName = nodeClasses.get(node.id);
    if (cName && classDefs.has(cName)) {
      const def = classDefs.get(cName)!;
      applyStylesToNode(node, def);
    }
    const inline = nodeInlineStyles.get(node.id);
    if (inline) {
      applyStylesToNode(node, inline);
    }
  });

  const nodes = Array.from(nodesMap.values());
  applyDagreLayout(nodes, edges, rankdir);

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
 * Applies CSS properties from Mermaid classDef/style to DiagramNode
 */
function applyStylesToNode(node: DiagramNode, props: Record<string, string>) {
  if (props.fill) {
    node.fillColor = props.fill;
  }
  if (props.stroke) {
    node.strokeColor = props.stroke;
  }
  if (props.color) {
    node.textColor = props.color;
  }
  if (props['stroke-width']) {
    const sw = parseInt(props['stroke-width']);
    if (!isNaN(sw)) node.strokeWidth = sw;
  }
  if (props['stroke-dasharray']) {
    node.strokeDash = 'dashed';
  }
}

/**
 * Extracts node ID and shape styling from Mermaid node syntax
 */
function parseOrCreateNode(raw: string, nodesMap: Map<string, DiagramNode>): DiagramNode {
  let id = raw;
  let text = raw;
  let type: ShapeType = 'rectangle';
  let cornerRadius = 8;
  let fillColor = '#eff6ff';
  let strokeColor = '#3b82f6';
  let textColor = '#1e293b';

  // Check brackets:
  // [("Text")] -> cylinder
  // (["Text"]) -> stadium
  // (("Text")) -> circle
  // {"Text"} -> diamond
  // [/"Text"/] -> parallelogram
  // ("Text") -> rounded
  // ["Text"] -> rectangle
  if (raw.includes('[(') && raw.includes(')]')) {
    id = raw.substring(0, raw.indexOf('[(')).trim();
    text = raw.substring(raw.indexOf('[(') + 2, raw.lastIndexOf(')]')).trim();
    type = 'cylinder';
    fillColor = '#eff6ff';
  } else if (raw.includes('([') && raw.includes('])')) {
    id = raw.substring(0, raw.indexOf('([')).trim();
    text = raw.substring(raw.indexOf('([') + 2, raw.lastIndexOf('])')).trim();
    type = 'stadium';
    fillColor = '#f0fdf4';
    strokeColor = '#16a34a';
    cornerRadius = 24;
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
  } else if (raw.includes('[/') && raw.includes('/]')) {
    id = raw.substring(0, raw.indexOf('[/')).trim();
    text = raw.substring(raw.indexOf('[/') + 2, raw.lastIndexOf('/]')).trim();
    type = 'parallelogram';
    fillColor = '#f3e8ff';
    strokeColor = '#9333ea';
  } else if (raw.includes('(') && raw.includes(')')) {
    id = raw.substring(0, raw.indexOf('(')).trim();
    text = raw.substring(raw.indexOf('(') + 1, raw.lastIndexOf(')')).trim();
    type = 'rounded';
    cornerRadius = 16;
    fillColor = '#eff6ff';
  } else if (raw.includes('[') && raw.includes(']')) {
    id = raw.substring(0, raw.indexOf('[')).trim();
    text = raw.substring(raw.indexOf('[') + 1, raw.lastIndexOf(']')).trim();
    type = 'rectangle';
    fillColor = '#eff6ff';
  }

  // Clean HTML line breaks and quotes
  text = cleanMermaidLabel(text);

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

  // Estimate node size based on text lines
  const textLines = text.split('\n');
  const maxLineLen = Math.max(...textLines.map(l => l.length));
  const estimatedWidth = Math.max(type === 'diamond' ? 150 : 180, Math.min(380, maxLineLen * 9 + 40));
  const estimatedHeight = Math.max(type === 'diamond' ? 110 : 80, textLines.length * 24 + 36);

  const newNode: DiagramNode = {
    id,
    type,
    x: 0,
    y: 0,
    width: type === 'circle' ? 110 : estimatedWidth,
    height: type === 'circle' ? 110 : estimatedHeight,
    text,
    fillColor,
    strokeColor,
    strokeWidth: 2,
    textColor,
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
          name: cleanMermaidLabel(name),
          type: cleanMermaidLabel(type),
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
      const label = relMatch[6] ? cleanMermaidLabel(relMatch[6]) : undefined;

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

      const sourceTable = getOrCreateTable(fromName);
      const targetTable = getOrCreateTable(toName);

      let card: '1:1' | '1:N' | 'N:M' = '1:N';
      if ((leftCard.includes('}') || leftCard.includes('o{')) && (rightCard.includes('{') || rightCard.includes('o{'))) {
        card = 'N:M';
      } else if (leftCard.includes('||') && rightCard.includes('||')) {
        card = '1:1';
      }

      edges.push({
        id: `rel-${edges.length + 1}`,
        from: sourceTable.id,
        to: targetTable.id,
        label,
        cardinality: card,
        style: relLine.includes('..') ? 'dashed' : 'solid',
        routing: 'orthogonal',
        strokeColor: '#4f46e5',
        strokeWidth: 2,
        arrowEnd: card === '1:N' || card === 'N:M' ? 'crowfoot' : 'arrow',
      });
    }
  }

  const nodes = Array.from(tablesMap.values());
  applyDagreLayout(nodes, edges, 'TB');

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
  const classesMap = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Class definition: class ClassName
    const classDefMatch = line.match(/^class\s+([a-zA-Z0-9_\-]+)\s*\{?$/);
    if (classDefMatch) {
      const cName = classDefMatch[1];
      if (!classesMap.has(cName)) {
        classesMap.set(cName, {
          id: cName.toLowerCase(),
          type: 'uml-class',
          x: 0,
          y: 0,
          width: 220,
          height: 120,
          text: cName,
          fillColor: '#f8fafc',
          strokeColor: '#334155',
          strokeWidth: 2,
          textColor: '#0f172a',
          fontSize: 12,
          cornerRadius: 6,
          umlMembers: [],
        });
      }
      continue;
    }

    // Class member: ClassName : +method()
    const memberMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*:\s*([+\-#~])?\s*([a-zA-Z0-9_\(\)\s:]+)$/);
    if (memberMatch) {
      const cName = memberMatch[1];
      const vis = (memberMatch[2] || '+') as '+' | '-' | '#' | '~';
      const signature = memberMatch[3].trim();

      let node = classesMap.get(cName);
      if (!node) {
        node = {
          id: cName.toLowerCase(),
          type: 'uml-class',
          x: 0,
          y: 0,
          width: 220,
          height: 100,
          text: cName,
          fillColor: '#f8fafc',
          strokeColor: '#334155',
          strokeWidth: 2,
          textColor: '#0f172a',
          fontSize: 12,
          cornerRadius: 6,
          umlMembers: [],
        };
        classesMap.set(cName, node);
      }

      node.umlMembers?.push({
        id: `mem-${(node.umlMembers?.length || 0) + 1}`,
        visibility: vis,
        name: cleanMermaidLabel(signature),
        isMethod: signature.includes('('),
      });
      node.height += 22;
      continue;
    }

    // Class relations: ClassA <|-- ClassB
    const relMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*(<\|--|--\|>|\*--|--\*|o--|--o|-->|--)\s*([a-zA-Z0-9_\-]+)(?:\s*:\s*"?([^"]*)"?)?$/);
    if (relMatch) {
      const fromName = relMatch[1];
      const toName = relMatch[3];
      const label = relMatch[4] ? cleanMermaidLabel(relMatch[4]) : undefined;

      const getOrCreateClass = (name: string): DiagramNode => {
        let node = classesMap.get(name);
        if (!node) {
          node = {
            id: name.toLowerCase(),
            type: 'uml-class',
            x: 0,
            y: 0,
            width: 220,
            height: 100,
            text: name,
            fillColor: '#f8fafc',
            strokeColor: '#334155',
            strokeWidth: 2,
            textColor: '#0f172a',
            fontSize: 12,
            cornerRadius: 6,
            umlMembers: [],
          };
          classesMap.set(name, node);
        }
        return node;
      };

      const sourceNode = getOrCreateClass(fromName);
      const targetNode = getOrCreateClass(toName);

      edges.push({
        id: `class-rel-${edges.length + 1}`,
        from: sourceNode.id,
        to: targetNode.id,
        label,
        style: 'solid',
        routing: 'orthogonal',
        strokeColor: '#334155',
        strokeWidth: 2,
        arrowEnd: 'arrow',
      });
    }
  }

  const nodes = Array.from(classesMap.values());
  applyDagreLayout(nodes, edges, 'TB');

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

    // State transition: StateA --> StateB : Label
    const transMatch = line.match(/^([a-zA-Z0-9_\[\*\]]+)\s*-->\s*([a-zA-Z0-9_\[\*\]]+)(?:\s*:\s*(.*))?$/);
    if (transMatch) {
      const rawFrom = transMatch[1];
      const rawTo = transMatch[2];
      const label = transMatch[3] ? cleanMermaidLabel(transMatch[3]) : undefined;

      const getOrCreateState = (name: string): DiagramNode => {
        const isStartEnd = name === '[*]';
        const id = isStartEnd ? `state-${Date.now().toString().slice(-4)}-${nodesMap.size}` : name;
        let node = nodesMap.get(id);
        if (!node) {
          node = {
            id,
            type: isStartEnd ? 'circle' : 'rounded',
            x: 0,
            y: 0,
            width: isStartEnd ? 40 : 160,
            height: isStartEnd ? 40 : 60,
            text: isStartEnd ? '' : cleanMermaidLabel(name),
            fillColor: isStartEnd ? '#0f172a' : '#f8fafc',
            strokeColor: '#0f172a',
            strokeWidth: 2,
            textColor: '#0f172a',
            fontSize: 12,
            cornerRadius: isStartEnd ? 20 : 12,
          };
          nodesMap.set(id, node);
        }
        return node;
      };

      const sourceNode = getOrCreateState(rawFrom);
      const targetNode = getOrCreateState(rawTo);

      edges.push({
        id: `state-rel-${edges.length + 1}`,
        from: sourceNode.id,
        to: targetNode.id,
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
  applyDagreLayout(nodes, edges, 'TB');

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
 * Calculates a clean hierarchical layout using Dagre graph layout engine
 * matching Mermaid's live layout behavior (TB, LR, BT, RL, ranks, node separation).
 */
export function applyDagreLayout(nodes: DiagramNode[], edges: DiagramEdge[], rankdir = 'TB') {
  if (nodes.length === 0) return;

  try {
    const g = new (graphlib as any).Graph();
    g.setGraph({
      rankdir,
      nodesep: 60,
      ranksep: 90,
      marginx: 80,
      marginy: 80,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Register all nodes with their estimated/actual dimensions
    nodes.forEach(node => {
      g.setNode(node.id, {
        width: node.width,
        height: node.height,
      });
    });

    // Register edges
    edges.forEach(edge => {
      if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
        g.setEdge(edge.from, edge.to);
      }
    });

    // Run dagre layout computation
    (dagre as any).layout(g);

    // Apply calculated positions (converting Dagre's center coordinates to top-left)
    nodes.forEach(node => {
      const dagreNode = g.node(node.id);
      if (dagreNode) {
        node.x = Math.round(dagreNode.x - node.width / 2);
        node.y = Math.round(dagreNode.y - node.height / 2);
      }
    });
  } catch (err) {
    console.warn('Dagre layout fallback:', err);
    // Fallback simple grid if dagre fails
    const cols = rankdir === 'LR' ? Math.max(2, Math.ceil(Math.sqrt(nodes.length))) : Math.min(3, nodes.length);
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      node.x = 100 + col * 320;
      node.y = 100 + row * 220;
    });
  }
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
    const safeText = n.text.replace(/\n/g, '<br/>').replace(/"/g, '&quot;');
    if (n.type === 'circle') {
      out += `    ${n.id}(("${safeText}"))\n`;
    } else if (n.type === 'diamond') {
      out += `    ${n.id}{"${safeText}"}\n`;
    } else if (n.type === 'cylinder') {
      out += `    ${n.id}[("${safeText}")]\n`;
    } else if (n.type === 'stadium') {
      out += `    ${n.id}(["${safeText}"])\n`;
    } else if (n.type === 'parallelogram') {
      out += `    ${n.id}[/"${safeText}"/]\n`;
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
