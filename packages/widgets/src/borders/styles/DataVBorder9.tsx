import { useEffect, useState, useRef } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/** DataVBorder9 — 渐变呼吸矩形框。BB9 简化版 */
export function DataVBorder9({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);
  const gid = useRef('dv9g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).current;
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);
  if (!mounted || phase === 'mounting') return null;

  const W = width, H = height, c = '#00D4FF';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c} stopOpacity="1">
            <animate attributeName="stop-color" values={`${c};rgba(0,180,220,0.8);${c}`} dur="3s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor={c} stopOpacity="0.3">
            <animate attributeName="stop-color" values={`rgba(0,180,220,0.8);${c};rgba(0,180,220,0.8)`} dur="3s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>
      <rect x="3" y="3" width={W-6} height={H-6} fill="none" stroke={`url(#${gid})`} strokeWidth="2" rx="4" />
    </svg>
  );
}
