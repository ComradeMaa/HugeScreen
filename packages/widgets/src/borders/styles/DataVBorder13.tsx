import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder13 — 虚线框 + 四角小 L 标。BB13 */
export function DataVBorder13({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF', c2 = 'rgba(0,212,255,0.5)';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      {/* 主虚线框 */}
      <path d={`M16,5 L${W-16},5 L${W-5},16 L${W-5},${H-16} L${W-16},${H-5} L16,${H-5} L5,${H-16} L5,16 Z`}
        fill="transparent" stroke={c} strokeWidth="3" strokeLinecap="round" strokeDasharray="10 5" />
      {/* 四角小 L */}
      <path d={`M5,20 L5,10 L12,3 L60,3 L68,10`} fill="transparent" stroke={c2} strokeWidth="1.5" />
      <path d={`M${W-5},20 L${W-5},10 L${W-12},3 L${W-60},3 L${W-68},10`} fill="transparent" stroke={c2} strokeWidth="1.5" />
      <path d={`M5,${H-20} L5,${H-10} L12,${H-3} L60,${H-3} L68,${H-10}`} fill="transparent" stroke={c2} strokeWidth="1.5" />
      <path d={`M${W-5},${H-20} L${W-5},${H-10} L${W-12},${H-3} L${W-60},${H-3} L${W-68},${H-10}`} fill="transparent" stroke={c2} strokeWidth="1.5" />
    </svg>
  );
}
