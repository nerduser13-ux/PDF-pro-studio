import { DiagramDocument, DiagramNode } from './types';
import { getNodeAnchorPoint, computeEdgePath } from './geometry';

/**
 * Returns SVG path data or element for different shape types
 */
function renderShapeSvg(n: DiagramNode, x: number, y: number): string {
  const w = n.width;
  const h = n.height;

  switch (n.type) {
    case 'circle': {
      const r = w / 2;
      return `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
    case 'ellipse': {
      const rx = w / 2;
      const ry = h / 2;
      return `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
    case 'diamond': {
      const mx = x + w / 2;
      const my = y + h / 2;
      return `<polygon points="${mx},${y} ${x + w},${my} ${mx},${y + h} ${x},${my}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
    case 'parallelogram': {
      const offset = Math.min(24, w * 0.2);
      return `<polygon points="${x + offset},${y} ${x + w},${y} ${x + w - offset},${y + h} ${x},${y + h}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
    case 'trapezoid': {
      const offset = Math.min(20, w * 0.15);
      return `<polygon points="${x + offset},${y} ${x + w - offset},${y} ${x + w},${y + h} ${x},${y + h}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
    case 'stadium': {
      const r = h / 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
    case 'cylinder': {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
    case 'card': {
      // Modern information card with colored pill header
      const headerH = 34;
      return `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${n.cornerRadius || 16}" fill="#ffffff" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />
        <rect x="${x}" y="${y}" width="${w}" height="${headerH}" rx="${n.cornerRadius || 16}" fill="${n.fillColor}" />
        <rect x="${x}" y="${y + headerH - 8}" width="${w}" height="8" fill="${n.fillColor}" />
      `;
    }
    case 'rounded':
    case 'rectangle':
    default: {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${n.cornerRadius || 0}" fill="${n.fillColor}" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />`;
    }
  }
}

/**
 * Generates an SVG string representation of a DiagramDocument
 * including all nodes, edges, styling, and text layers.
 */
export function exportDocumentToSvg(doc: DiagramDocument, scale = 1): string {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  doc.nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });

  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 800; maxY = 600;
  }

  const padding = 60;
  const totalW = Math.max(200, (maxX - minX + padding * 2) * scale);
  const totalH = Math.max(200, (maxY - minY + padding * 2) * scale);
  const offsetX = minX - padding;
  const offsetY = minY - padding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW / scale} ${totalH / scale}">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="#475569" />
      </marker>
      <marker id="crowfoot" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 1 2 L 10 6 L 1 10 M 10 2 L 10 10" stroke="#475569" stroke-width="1.5" fill="none" />
      </marker>
      <marker id="circle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <circle cx="5" cy="5" r="4" fill="#0ea5e9" />
      </marker>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.1" />
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="${doc.canvas.backgroundColor || '#ffffff'}" />
  `;

  // Draw Edges
  doc.edges.forEach(e => {
    const fromNode = doc.nodes.find(n => n.id === e.from);
    const toNode = doc.nodes.find(n => n.id === e.to);
    if (!fromNode || !toNode) return;

    const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
    const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

    const start = getNodeAnchorPoint(fromNode, e.fromAnchor || 'auto', toCenter);
    const end = getNodeAnchorPoint(toNode, e.toAnchor || 'auto', fromCenter);

    const startX = start.x - offsetX;
    const startY = start.y - offsetY;
    const endX = end.x - offsetX;
    const endY = end.y - offsetY;

    const { pathData, labelPoint } = computeEdgePath(
      { x: startX, y: startY },
      { x: endX, y: endY },
      e.routing || 'orthogonal',
      e.waypoints
    );

    const dash = e.style === 'dashed' ? 'stroke-dasharray="6,4"' : e.style === 'dotted' ? 'stroke-dasharray="2,4"' : '';
    const marker = e.arrowEnd === 'crowfoot' ? 'marker-end="url(#crowfoot)"' : e.arrowEnd === 'circle' ? 'marker-end="url(#circle)"' : 'marker-end="url(#arrow)"';

    svg += `<path d="${pathData}" fill="none" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}" ${dash} ${marker} />`;

    if (e.label) {
      svg += `
        <rect x="${labelPoint.x - 35}" y="${labelPoint.y - 12}" width="70" height="22" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
        <text x="${labelPoint.x}" y="${labelPoint.y + 3}" font-family="Inter, sans-serif" font-size="10" font-weight="bold" fill="#334155" text-anchor="middle">${e.label}</text>
      `;
    }
  });

  // Draw Nodes
  doc.nodes.forEach(n => {
    const x = n.x - offsetX;
    const y = n.y - offsetY;

    svg += `<g ${n.shadow ? 'filter="url(#shadow)"' : ''}>`;

    if (n.type === 'er-table') {
      const headerH = 38;
      svg += `
        <rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="${n.cornerRadius}" fill="#ffffff" stroke="${n.strokeColor}" stroke-width="${n.strokeWidth}" />
        <rect x="${x}" y="${y}" width="${n.width}" height="${headerH}" rx="${n.cornerRadius}" fill="${n.fillColor}" />
        <rect x="${x}" y="${y + headerH - 8}" width="${n.width}" height="8" fill="${n.fillColor}" />
        <text x="${x + 14}" y="${y + 24}" font-family="Inter, sans-serif" font-size="${n.fontSize}" font-weight="900" fill="${n.textColor}">${n.text}</text>
      `;
      n.fields?.forEach((f, idx) => {
        const fy = y + headerH + idx * 26 + 18;
        svg += `
          <text x="${x + 14}" y="${fy}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="#1e293b">${f.name}</text>
          <text x="${x + n.width - 14}" y="${fy}" font-family="Inter, sans-serif" font-size="10" font-weight="bold" fill="${f.isPk ? '#ef4444' : f.isFk ? '#6366f1' : '#94a3b8'}" text-anchor="end">${f.isPk ? 'PK ' : f.isFk ? 'FK ' : ''}${f.type}</text>
        `;
      });
    } else if (n.type === 'card') {
      // Modern Information Card
      svg += renderShapeSvg(n, x, y);
      const headerH = 34;
      // Header Title & Badge
      const title = n.headerText || 'CARD';
      svg += `
        <text x="${x + 16}" y="${y + 22}" font-family="Inter, sans-serif" font-size="12" font-weight="900" fill="#ffffff" letter-spacing="0.5">${title}</text>
      `;
      if (n.badgeText) {
        svg += `
          <circle cx="${x + n.width - 18}" cy="${y + 17}" r="10" fill="#ffffff" />
          <text x="${x + n.width - 18}" y="${y + 21}" font-family="Inter, sans-serif" font-size="10" font-weight="900" fill="${n.fillColor}" text-anchor="middle">${n.badgeText}</text>
        `;
      }
      // Body Text
      const lines = n.text.split('\n');
      lines.forEach((l, lIdx) => {
        svg += `
          <text x="${x + 16}" y="${y + headerH + 20 + lIdx * 16}" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="${n.textColor}">${l}</text>
        `;
      });
    } else {
      svg += renderShapeSvg(n, x, y);
      // Multi-line text for general shapes
      const lines = n.text.split('\n');
      const startY = y + (n.height - lines.length * 16) / 2 + 12;
      lines.forEach((l, lIdx) => {
        const textX = n.textAlign === 'left' ? x + 16 : n.textAlign === 'right' ? x + n.width - 16 : x + n.width / 2;
        const anchor = n.textAlign === 'left' ? 'start' : n.textAlign === 'right' ? 'end' : 'middle';
        svg += `
          <text x="${textX}" y="${startY + lIdx * 16}" font-family="Inter, sans-serif" font-size="${n.fontSize}" font-weight="${n.fontBold ? 'bold' : 'normal'}" fill="${n.textColor}" text-anchor="${anchor}">${l}</text>
        `;
      });
    }

    svg += `</g>`;
  });

  svg += `</svg>`;
  return svg;
}

/**
 * Download SVG file directly
 */
export function downloadSvg(doc: DiagramDocument, filename = 'diagram.svg') {
  const svgStr = exportDocumentToSvg(doc);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export document as PNG
 */
export function downloadPng(doc: DiagramDocument, scale = 2, filename = 'diagram.png') {
  const svgStr = exportDocumentToSvg(doc, scale);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      link.click();
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/**
 * Save native JSON project format
 */
export function downloadNativeJson(doc: DiagramDocument, filename = 'diagram.diagram.json') {
  const jsonStr = JSON.stringify(doc, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
