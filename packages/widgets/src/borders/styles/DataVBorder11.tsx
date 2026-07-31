import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder11 — 顶部标题凹槽 + 四角呼吸光点。BB11 简化版 */
export function DataVBorder11({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      {/* 顶部标题槽 */}
      <path d={`M20,32 L${W/2-125},32 L${W/2-105},53 L${W/2+105},53 L${W/2+125},32 L${W-20},32 L${W-8},48 L${W-8},${H-25} L${W-20},${H-8} L20,${H-8} L8,${H-25} L8,50 Z`} fill="transparent" stroke={c} strokeWidth="1" />
      {/* 四角光点 */}
      {[[15,15],[W-15,15],[15,H-15],[W-15,H-15]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill={c}>
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" begin={`${i*0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}
