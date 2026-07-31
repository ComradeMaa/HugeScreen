import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder4 — 顶部多层横线 + 左侧竖线 + 虚线。BB4 简化版 */
export function DataVBorder4({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF', c2 = 'rgba(0,212,255,0.5)';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      <polygon fill="transparent" points={`${W-15},22 170,22 150,7 40,7 28,21 32,24 16,42 16,${H-32} 41,${H-7} ${W-15},${H-7}`} />
      <polyline fill="none" stroke={c} strokeWidth="1" points={`145,${H-5} 40,${H-5} 10,${H-35} 10,40 40,5 150,5 170,20 ${W-15},20`} />
      <polyline fill="none" stroke={c2} strokeWidth="1" points={`245,${H-1} 36,${H-1} 14,${H-23} 14,${H-100}`} />
      <polyline fill="none" stroke={c} strokeWidth="3" points={`7,${H-40} 7,${H-75}`} />
      <polyline fill="none" stroke={c} strokeWidth="3" points="28,24 13,41 13,64" />
      <polyline fill="none" stroke={c} strokeWidth="1" points="5,45 5,140" />
      <polyline fill="none" stroke={c2} strokeWidth="1" points="14,75 14,180" />
      <polyline fill="none" stroke={c} strokeWidth="3" strokeDasharray="100 250" points={`200,17 ${W-10},17`} />
      <polyline fill="none" stroke={c2} strokeWidth="1" strokeDasharray="80 270" points={`385,17 ${W-10},17`} />
    </svg>
  );
}
