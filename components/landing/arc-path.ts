/**
 * Geometry of the app icon's 270° arc in a 200×200 SVG box: starts bottom-left,
 * runs clockwise over the top, ends bottom-right. Shared by the server-rendered
 * StaticArc and the scroll-driven SvgArc.
 */
const SIZE = 200;
const R = 78;
const C = SIZE / 2;

function point(deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + R * Math.cos(rad), C + R * Math.sin(rad)];
}

const [sx, sy] = point(135);
const [ex, ey] = point(45);

export const ARC_VIEWBOX = `0 0 ${SIZE} ${SIZE}`;
export const ARC_PATH = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
export const ARC_LENGTH = (2 * Math.PI * R * 270) / 360;
