import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder6 — 上下横线 + 左右竖线 + 四角圆点 + 角标短线。BB6 */
export function DataVBorder6({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      <polygon fill="transparent" points={`9,7 ${W-9},7 ${W-9},${H-7} 9,${H-7}`} />
      <circle fill={c} cx="5" cy="5" r="2" />
      <circle fill={c} cx={W-5} cy="5" r="2" />
      <circle fill={c} cx={W-5} cy={H-5} r="2" />
      <circle fill={c} cx="5" cy={H-5} r="2" />
      <polyline fill="none" stroke={c} points={`10,4 ${W-10},4`} />
      <polyline fill="none" stroke={c} points={`10,${H-4} ${W-10},${H-4}`} />
      <polyline fill="none" stroke={c} points={`5,70 5,${H-70}`} />
      <polyline fill="none" stroke={c} points={`${W-5},70 ${W-5},${H-70}`} />
      <polyline fill="none" stroke={c} opacity="0.6" points="3,10 3,50" />
      <polyline fill="none" stroke={c} opacity="0.6" points={`7,30 7,80`} />
      <polyline fill="none" stroke={c} opacity="0.6" points={`${W-3},10 ${W-3},50`} />
      <polyline fill="none" stroke={c} opacity="0.6" points={`${W-7},30 ${W-7},80`} />
      <polyline fill="none" stroke={c} opacity="0.6" points={`3,${H-10} 3,${H-50}`} />
      <polyline fill="none" stroke={c} opacity="0.6" points={`7,${H-30} 7,${H-80}`} />
      <polyline fill="none" stroke={c} opacity="0.6" points={`${W-3},${H-10} ${W-3},${H-50}`} />
      <polyline fill="none" stroke={c} opacity="0.6" points={`${W-7},${H-30} ${W-7},${H-80}`} />
    </svg>
  );
}
