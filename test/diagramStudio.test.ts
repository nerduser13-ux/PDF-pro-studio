import { describe, it, expect } from 'vitest';
import { parseMermaidToDocument, exportDocumentToMermaid } from '../components/diagram/mermaidConverter';
import { DIAGRAM_TEMPLATES } from '../components/diagram/templates';
import { exportDocumentToSvg } from '../components/diagram/exportUtils';
import { getNodeAnchorPoint, computeEdgePath } from '../components/diagram/geometry';
import { DiagramNode } from '../components/diagram/types';

describe('Diagram Studio Engine Tests', () => {
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

    // Verify anchor calculation
    const startPt = getNodeAnchorPoint(nodeA, 'right');
    expect(startPt).toEqual({ x: 300, y: 150 });

    const endPt = getNodeAnchorPoint(nodeB, 'left');
    expect(endPt).toEqual({ x: 400, y: 150 });

    // Path calculation
    const { pathData, labelPoint } = computeEdgePath(startPt, endPt, 'orthogonal');
    expect(pathData).toContain('M 300 150');
    expect(pathData).toContain('350'); // midpoint orthogonal step
    expect(labelPoint.x).toBe(350);
  });

  it('Scenario B: Mermaid Flowchart Import & Round-trip', () => {
    const mermaidCode = `flowchart TD
    A["User Request"] --> B{"Is Valid?"}
    B -->|"Yes"| C["Process Order"]
    B -.->|"No"| D["Reject"]`;

    const res = parseMermaidToDocument(mermaidCode);
    expect(res.success).toBe(true);
    expect(res.document).toBeDefined();
    expect(res.document?.nodes.length).toBe(4);
    expect(res.document?.edges.length).toBe(3);

    // Verify converted types
    const decisionNode = res.document?.nodes.find(n => n.id === 'B');
    expect(decisionNode?.type).toBe('diamond');

    // Roundtrip export
    if (res.document) {
      const generated = exportDocumentToMermaid(res.document);
      expect(generated).toContain('flowchart TD');
      expect(generated).toContain('Is Valid?');
    }
  });

  it('Scenario C: Mermaid ER Diagram Import & Columns', () => {
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

  it('Scenario D: Templates Instantiation & SVG Export', () => {
    const swotTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'swot-analysis');
    expect(swotTemplate).toBeDefined();

    const doc = swotTemplate!.createDocument();
    expect(doc.nodes.length).toBe(5);

    // Export SVG must contain all quadrants
    const svg = exportDocumentToSvg(doc);
    expect(svg).toContain('<svg');
    expect(svg).toContain('STRATEGIC SWOT MATRIX');
    expect(svg).toContain('STRENGTHS (Internal)');
    expect(svg).toContain('WEAKNESSES (Internal)');
  });
});
