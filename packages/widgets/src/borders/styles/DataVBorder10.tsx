import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder10 — 四角三角标 + 外框虚线。BB10 */
export function DataVBorder10({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF', c2 = 'rgba(0,212,255,0.5)';
  const pts = '40,0 5,0 0,5 0,16 3,19 3,7 7,3 35,3';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      {/* 外框 */}
      <polygon fill="transparent" stroke={c} strokeWidth="1" points={`4,0 ${W-4},0 ${W},4 ${W},${H-4} ${W-4},${H} 4,${H} 0,${H-4} 0,4`} />
      {/* 四角装饰 */}
      <polygon fill={c2} points={pts} />
      <g transform={`translate(${W},0) scale(-1,1)`}><polygon fill={c2} points={pts} /></g>
      <g transform={`translate(0,${H}) scale(1,-1)`}><polygon fill={c2} points={pts} /></g>
      <g transform={`translate(${W},${H}) scale(-1,-1)`}><polygon fill={c2} points={pts} /></g>
    </svg>
  );
}
