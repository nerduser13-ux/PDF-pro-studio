import { describe, it, expect } from 'vitest';
import { parseMermaidToDocument, exportDocumentToMermaid, cleanMermaidLabel } from '../components/diagram/mermaidConverter';
import { DIAGRAM_TEMPLATES } from '../components/diagram/templates';
import { exportDocumentToSvg } from '../components/diagram/exportUtils';
import { getNodeAnchorPoint, computeEdgePath } from '../components/diagram/geometry';
import { DiagramNode } from '../components/diagram/types';
import { documentNodesToReactFlow, documentEdgesToReactFlow, reactFlowToDocument } from '../components/diagram/rfAdapter';

describe('Diagram Studio Engine & React Flow Adapter Tests', () => {
  it('Scenario A: Native Editing & Geometry Logic', () => {
    const nodeA: DiagramNode = {
      id: 'a',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      text: 'Node A',
      fillColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 2,
      textColor: '#000000',
      fontSize: 12,
      cornerRadius: 8,
    };

    const nodeB: DiagramNode = {
      id: 'b',
      type: 'rectangle',
      x: 400,
      y: 100,
      width: 200,
      height: 100,
      text: 'Node B',
      fillColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 2,
      textColor: '#000000',
      fontSize: 12,
      cornerRadius: 8,
    };

    const startPt = getNodeAnchorPoint(nodeA, 'right');
    expect(startPt).toEqual({ x: 300, y: 150 });

    const endPt = getNodeAnchorPoint(nodeB, 'left');
    expect(endPt).toEqual({ x: 400, y: 150 });

    const { pathData, labelPoint } = computeEdgePath(startPt, endPt, 'orthogonal');
    expect(pathData).toContain('M 300 150');
    expect(pathData).toContain('350');
    expect(labelPoint.x).toBe(350);
  });

  it('Scenario B: React Flow Bi-directional Adapter Conversion', () => {
    const tmpl = DIAGRAM_TEMPLATES.find(t => t.id === 'swot-analysis')!;
    const doc = tmpl.createDocument();

    // 1. Convert to React Flow nodes and edges
    const rfNodes = documentNodesToReactFlow(doc.nodes);
    const rfEdges = documentEdgesToReactFlow(doc.edges);

    expect(rfNodes.length).toBe(doc.nodes.length);
    expect(rfEdges.length).toBe(doc.edges.length);
    expect(rfNodes[0].type).toBe('custom');
    expect(rfNodes[0].data.id).toBe(doc.nodes[0].id);

    // 2. Convert back to DiagramDocument
    const restoredDoc = reactFlowToDocument(doc, rfNodes, rfEdges);
    expect(restoredDoc.nodes.length).toBe(doc.nodes.length);
    expect(restoredDoc.edges.length).toBe(doc.edges.length);
    expect(restoredDoc.nodes[0].text).toBe(doc.nodes[0].text);
  });

  it('Scenario C: Mermaid Flowchart Import & Clean Line Breaks (No <br/>)', () => {
    const mermaidCode = `flowchart TD
    A["User Request<br/>Initiated"] --> B{"Is Valid?"}
    B -->|"Yes"| C["Process Order"]
    B -.->|"No"| D[/"Reject<br />Data"/]`;

    const res = parseMermaidToDocument(mermaidCode);
    expect(res.success).toBe(true);
    expect(res.document).toBeDefined();
    expect(res.document?.nodes.length).toBe(4);
    expect(res.document?.edges.length).toBe(3);

    const nodeA = res.document?.nodes.find(n => n.id === 'A');
    expect(nodeA?.text).not.toContain('<br/>');
    expect(nodeA?.text).toContain('\n');

    const decisionNode = res.document?.nodes.find(n => n.id === 'B');
    expect(decisionNode?.type).toBe('diamond');

    const parallelogramNode = res.document?.nodes.find(n => n.id === 'D');
    expect(parallelogramNode?.type).toBe('parallelogram');
    expect(parallelogramNode?.text).not.toContain('<br />');

    if (res.document) {
      const generated = exportDocumentToMermaid(res.document);
      expect(generated).toContain('flowchart TD');
      expect(generated).toContain('Is Valid?');
    }
  });

  it('Scenario D: Mermaid ER Diagram Import & Columns', () => {
    const mermaidEr = `erDiagram
    USERS ||--o{ ORDERS : places
    USERS {
        uuid id PK
        string email
    }
    ORDERS {
        uuid id PK
        uuid user_id FK
    }`;

    const res = parseMermaidToDocument(mermaidEr);
    expect(res.success).toBe(true);
    expect(res.document?.nodes.length).toBe(2);
    expect(res.document?.edges.length).toBe(1);

    const userTable = res.document?.nodes.find(n => n.text === 'USERS');
    expect(userTable?.type).toBe('er-table');
    expect(userTable?.fields?.length).toBe(2);
    expect(userTable?.fields?.[0].isPk).toBe(true);
  });

  it('Scenario E: Templates Instantiation (SWOT & PESTEL Infographics)', () => {
    const pestelTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'pestel-infographic');
    expect(pestelTemplate).toBeDefined();

    const doc = pestelTemplate!.createDocument();
    expect(doc.nodes.length).toBe(7);
    expect(doc.edges.length).toBe(6);

    const pCard = doc.nodes.find(n => n.id === 'pestel-p');
    expect(pCard?.type).toBe('card');
    expect(pCard?.headerText).toBe('POLITICAL');
    expect(pCard?.badgeText).toBe('P');
    expect(pCard?.iconName).toBe('building');

    const svg = exportDocumentToSvg(doc);
    expect(svg).toContain('<svg');
    expect(svg).toContain('PESTEL');
    expect(svg).toContain('POLITICAL');
    expect(svg).toContain('ECONOMICAL');
  });

  it('Scenario F: Label sanitization function', () => {
    expect(cleanMermaidLabel('Test<br/>Line 2')).toBe('Test\nLine 2');
    expect(cleanMermaidLabel('"Quoted string"')).toBe('Quoted string');
    expect(cleanMermaidLabel('&amp; &lt; &gt;')).toBe('& < >');
  });
});
