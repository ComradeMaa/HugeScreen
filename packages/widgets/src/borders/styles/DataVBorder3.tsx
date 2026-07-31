import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/**
 * DataVBorder3 — 四层同心矩形线框（外粗内细）。
 * 源自 @jiaminghi/data-view-react BorderBox3。
 */
export function DataVBorder3({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const rAF = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(rAF); }, []);

  const visible = phase !== 'mounting';
  if (!mounted || !visible) return null;

  const W = width, H = height;
  const c = '#00D4FF';

  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      {/* 背景遮罩 */}
      <polygon fill="transparent" points={`23,23 ${W-24},23 ${W-24},${H-24} 23,${H-24}`} />
      {/* 最外层粗线 (3px) */}
      <polyline fill="none" stroke={c} strokeWidth="3"
        points={`4,4 ${W-22},4 ${W-22},${H-22} 4,${H-22} 4,4`} />
      {/* 中层线 (1px) */}
      <polyline fill="none" stroke={c} strokeWidth="1" opacity="0.6"
        points={`10,10 ${W-16},10 ${W-16},${H-16} 10,${H-16} 10,10`} />
      {/* 内层线 (1px) */}
      <polyline fill="none" stroke={c} strokeWidth="1" opacity="0.4"
        points={`16,16 ${W-10},16 ${W-10},${H-10} 16,${H-10} 16,10`} />
      {/* 最内层线 (1px) */}
      <polyline fill="none" stroke={c} strokeWidth="1" opacity="0.25"
        points={`22,22 ${W-4},22 ${W-4},${H-4} 22,${H-4} 22,22`} />
    </svg>
  );
}
