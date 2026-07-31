import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder8 — 跑马灯流动光点矩形框。BB8 简化版 */
export function DataVBorder8({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF', c2 = 'rgba(0,212,255,0.5)';
  const len = (W + H - 5) * 2;

  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      <polygon fill="transparent" points={`5,5 ${W-5},5 ${W-5},${H-5} 5,${H-5}`} />
      {/* 实线框 */}
      <rect x="2.5" y="2.5" width={W-5} height={H-5} fill="none" stroke={c} strokeWidth="1" />
      {/* 跑马灯虚线框 */}
      <rect x="2.5" y="2.5" width={W-5} height={H-5} fill="none" stroke={c2} strokeWidth="3">
        <animate attributeName="stroke-dasharray" from={`0,${len}`} to={`${len},0`} dur="3s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}
