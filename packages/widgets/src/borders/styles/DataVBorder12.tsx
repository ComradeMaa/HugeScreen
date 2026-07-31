import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder12 — 四角双层 L 型折线 + 呼吸光晕。BB12 简化版 */
export function DataVBorder12({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF', c2 = 'rgba(0,212,255,0.4)';
  const L = (x: number, y: number, flipX: boolean, flipY: boolean) => {
    const sx = flipX ? -1 : 1, sy = flipY ? -1 : 1;
    const ox = flipX ? W : 0, oy = flipY ? H : 0;
    return `M${ox+sx*15},${oy+sy*5} L${ox+sx*5},${oy+sy*5} L${ox+sx*5},${oy+sy*15}`;
  };
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      {/* 四角双层 L */}
      {[[false,false],[true,false],[false,true],[true,true]].map(([fx,fy],i) => (
        <g key={i}>
          <path d={L(15,5,fx,fy)} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
            <animate attributeName="opacity" values="1;0.4;1" dur="2s" begin={`${i*0.2}s`} repeatCount="indefinite" />
          </path>
          <path d={L(25,12,fx,fy)} fill="none" stroke={c2} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        </g>
      ))}
      {/* 外框虚线 */}
      <rect x="5" y="5" width={W-10} height={H-10} fill="none" stroke={c2} strokeWidth="1" strokeDasharray="8 4" rx="2" />
    </svg>
  );
}
