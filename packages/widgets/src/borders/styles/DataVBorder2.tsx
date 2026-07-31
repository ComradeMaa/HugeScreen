import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/**
 * DataVBorder2 — 双层矩形线框 + 四角圆点。
 * 源自 @jiaminghi/data-view-react BorderBox2。
 */
export function DataVBorder2({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const rAF = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(rAF); }, []);

  const visible = phase !== 'mounting';
  if (!mounted || !visible) return null;

  const W = width, H = height;
  const c1 = '#00D4FF';
  const c2 = 'rgba(0,212,255,0.4)';

  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      {/* 背景遮罩 */}
      <polygon fill="transparent" points={`7,7 ${W-7},7 ${W-7},${H-7} 7,${H-7}`} />
      {/* 外层线 */}
      <polyline fill="none" stroke={c1} strokeWidth="1"
        points={`2,2 ${W-2},2 ${W-2},${H-2} 2,${H-2} 2,2`} />
      {/* 内层线 */}
      <polyline fill="none" stroke={c2} strokeWidth="1"
        points={`6,6 ${W-6},6 ${W-6},${H-6} 6,${H-6} 6,6`} />
      {/* 四角圆点 */}
      <circle fill={c1} cx="11" cy="11" r="1" />
      <circle fill={c1} cx={W-11} cy="11" r="1" />
      <circle fill={c1} cx={W-11} cy={H-11} r="1" />
      <circle fill={c1} cx="11" cy={H-11} r="1" />
    </svg>
  );
}
