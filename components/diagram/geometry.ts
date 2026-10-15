import { DiagramNode, AnchorPosition, RoutingType, Point } from './types';

/**
 * Calculates anchor point on a node's perimeter in world coordinates
 */
export function getNodeAnchorPoint(node: DiagramNode, anchor: AnchorPosition, otherNodeCenter?: Point): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  if (anchor === 'auto' && otherNodeCenter) {
    const dx = otherNodeCenter.x - cx;
    const dy = otherNodeCenter.y - cy;
    // Determine closest quadrant
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0
        ? { x: node.x + node.width, y: cy }
        : { x: node.x, y: cy };
    } else {
      return dy > 0
        ? { x: cx, y: node.y + node.height }
        : { x: cx, y: node.y };
    }
  }

  switch (anchor) {
    case 'top':
      return { x: cx, y: node.y };
    case 'bottom':
      return { x: cx, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: cy };
    case 'right':
      return { x: node.x + node.width, y: cy };
    case 'auto':
    default:
      return { x: cx, y: cy };
  }
}

/**
 * Generate SVG path data between two points based on routing mode
 */
export function computeEdgePath(
  start: Point,
  end: Point,
  routing: RoutingType,
  waypoints?: Point[]
): { pathData: string; labelPoint: Point } {
  if (waypoints && waypoints.length > 0) {
    let d = `M ${start.x} ${start.y}`;
    for (const wp of waypoints) {
      d += ` L ${wp.x} ${wp.y}`;
    }
    d += ` L ${end.x} ${end.y}`;
    const midIdx = Math.floor(waypoints.length / 2);
    const midPoint = waypoints[midIdx];
    return { pathData: d, labelPoint: midPoint };
  }

  if (routing === 'straight') {
    const pathData = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const labelPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return { pathData, labelPoint };
  }

  if (routing === 'orthogonal') {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    // Choose step route (horizontal then vertical, or vertical then horizontal)
    if (Math.abs(dx) >= Math.abs(dy)) {
      const midX = start.x + dx / 2;
      const pathData = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      const labelPoint = { x: midX, y: (start.y + end.y) / 2 };
      return { pathData, labelPoint };
    } else {
      const midY = start.y + dy / 2;
      const pathData = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
      const labelPoint = { x: (start.x + end.x) / 2, y: midY };
      return { pathData, labelPoint };
    }
  }

  // Curved (smooth bezier)
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cx1 = start.x + dx * 0.5;
  const cy1 = start.y;
  const cx2 = start.x + dx * 0.5;
  const cy2 = end.y;

  const pathData = `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
  // Midpoint approximation along cubic bezier
  const labelPoint = {
    x: 0.125 * start.x + 0.375 * cx1 + 0.375 * cx2 + 0.125 * end.x,
    y: 0.125 * start.y + 0.375 * cy1 + 0.375 * cy2 + 0.125 * end.y,
  };

  return { pathData, labelPoint };
}
