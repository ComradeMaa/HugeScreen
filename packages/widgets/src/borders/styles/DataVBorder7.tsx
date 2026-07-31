import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder7 — 四角 L 形双层括号。BB7 */
export function DataVBorder7({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF', c2 = 'rgba(0,212,255,0.6)';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      {/* 外层细线 L 角 */}
      <polyline fill="none" stroke={c} strokeWidth="2" points={`0,25 0,0 25,0`} />
      <polyline fill="none" stroke={c} strokeWidth="2" points={`${W-25},0 ${W},0 ${W},25`} />
      <polyline fill="none" stroke={c} strokeWidth="2" points={`${W-25},${H} ${W},${H} ${W},${H-25}`} />
      <polyline fill="none" stroke={c} strokeWidth="2" points={`0,${H-25} 0,${H} 25,${H}`} />
      {/* 内层粗线 L 角 */}
      <polyline fill="none" stroke={c2} strokeWidth="5" strokeLinecap="round" points={`0,10 0,0 10,0`} />
      <polyline fill="none" stroke={c2} strokeWidth="5" strokeLinecap="round" points={`${W-10},0 ${W},0 ${W},10`} />
      <polyline fill="none" stroke={c2} strokeWidth="5" strokeLinecap="round" points={`${W-10},${H} ${W},${H} ${W},${H-10}`} />
      <polyline fill="none" stroke={c2} strokeWidth="5" strokeLinecap="round" points={`0,${H-10} 0,${H} 10,${H}`} />
    </svg>
  );
}
