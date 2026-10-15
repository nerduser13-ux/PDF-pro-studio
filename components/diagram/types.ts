export type ShapeType =
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'triangle'
  | 'sticky'
  | 'text'
  | 'er-table'
  | 'uml-class'
  | 'swimlane'
  | 'step-process';

export type ArrowStyle = 'solid' | 'dashed' | 'dotted';
export type ArrowHead = 'arrow' | 'crowfoot' | 'circle' | 'diamond' | 'none';
export type RoutingType = 'orthogonal' | 'curved' | 'straight';
export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface ERColumn {
  id: string;
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
  nullable?: boolean;
  unique?: boolean;
}

export interface UMLMember {
  id: string;
  visibility: '+' | '-' | '#' | '~';
  name: string;
  type?: string;
  isMethod?: boolean;
}

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
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  textColor: string;
  fontSize: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  cornerRadius: number;
  opacity?: number;
  rotation?: number;
  locked?: boolean;
  zIndex?: number;
  groupId?: string;
  // ER Table specific:
  fields?: ERColumn[];
  // UML Class specific:
  umlMembers?: UMLMember[];
  // Swimlane specific:
  swimlaneHeader?: string;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  fromAnchor?: AnchorPosition;
  toAnchor?: AnchorPosition;
  label?: string;
  style: ArrowStyle;
  routing: RoutingType;
  strokeColor: string;
  strokeWidth: number;
  arrowStart?: ArrowHead;
  arrowEnd: ArrowHead;
  cardinality?: '1:1' | '1:N' | 'N:M' | '0:1' | '0:N';
  waypoints?: { x: number; y: number }[];
}

export interface DiagramDocument {
  id: string;
  title: string;
  version: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  canvas: {
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
    backgroundColor: string;
  };
  metadata?: {
    templateId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface DiagramHistoryStep {
  document: DiagramDocument;
  actionDescription: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}
