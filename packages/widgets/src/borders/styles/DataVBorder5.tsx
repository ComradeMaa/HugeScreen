import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder5 — 多层不等距矩形框 + 右下角缺口。BB5 */
export function DataVBorder5({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF', c2 = 'rgba(0,212,255,0.4)';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      <polygon fill="transparent" points={`10,22 ${W-22},22 ${W-22},${H-86} ${W-84},${H-24} 10,${H-24}`} />
      <polyline fill="none" stroke={c} strokeWidth="1" points={`8,5 ${W-5},5 ${W-5},${H-100} ${W-100},${H-5} 8,${H-5} 8,5`} />
      <polyline fill="none" stroke={c2} strokeWidth="1" points={`3,5 ${W-20},5 ${W-20},${H-60} ${W-74},${H-5} 3,${H-5} 3,5`} />
      <polyline fill="none" stroke={c2} strokeWidth="5" points={`50,13 ${W-35},13`} />
      <polyline fill="none" stroke={c2} strokeWidth="2" points={`15,20 ${W-35},20`} />
      <polyline fill="none" stroke={c2} strokeWidth="2" points={`15,${H-20} ${W-110},${H-20}`} />
      <polyline fill="none" stroke={c2} strokeWidth="5" points={`15,${H-13} ${W-110},${H-13}`} />
    </svg>
  );
}
