import { useEffect, useState } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/**
 * DataVBorder1 — 基于 @jiaminghi/data-view-react BorderBox1 的角标路径数据，
 * 自行渲染纯电光蓝 SVG 线框，无库依赖、无白色背景、无副作用。
 *
 * 视觉效果：四个角各有一组折线装饰（150×150px），外圈是透明的多边形遮罩。
 *           这里只取角的 path 数据，用 SVG polygon + animate 重现原效果。
 */

/* ═══ 四角 polygon points（源自 BorderBox1 源码） ═══ */
const CORNER_POINTS = '6,66 6,18 12,12 18,12 24,6 27,6 30,9 36,9 39,6 84,6 81,9 75,9 73.2,7 40.8,7 37.8,10.2 24,10.2 12,21 12,24 9,27 9,51 7.8,54 7.8,63';
const ACCENT_POINTS = '27.599999999999998,4.8 38.4,4.8 35.4,7.8 30.599999999999998,7.8';
const STRIP_POINTS = '9,54 9,63 7.199999999999999,66 7.199999999999999,75 7.8,78 7.8,110 8.4,110 8.4,66 9.6,66 9.6,54';

interface CornerProps {
  className: string;
  color: string;
  color2: string;
}

/** 单个角标 — 3 个 polygon + 颜色呼吸动画 */
function Corner({ className, color, color2 }: CornerProps) {
  return (
    <svg className={className} width="150" height="150" style={{ position: 'absolute', display: 'block', background: 'transparent' }}>
      <polygon fill={color} points={CORNER_POINTS}>
        <animate attributeName="fill" values={`${color};${color2};${color}`} dur="0.5s" begin="0s" repeatCount="indefinite" />
      </polygon>
      <polygon fill={color2} points={ACCENT_POINTS}>
        <animate attributeName="fill" values={`${color2};${color};${color2}`} dur="0.5s" begin="0s" repeatCount="indefinite" />
      </polygon>
      <polygon fill={color} points={STRIP_POINTS}>
        <animate attributeName="fill" values={`${color};${color2};transparent`} dur="1s" begin="0s" repeatCount="indefinite" />
      </polygon>
    </svg>
  );
}

const CORNER_CSS = `
  .dv1-corner { position:absolute; display:block; background:transparent !important; }
  .dv1-corner svg { background:transparent !important; }
  .dv1-left-top    { left:0; top:0; }
  .dv1-right-top   { right:0; top:0; transform:rotateY(180deg); }
  .dv1-left-bottom { left:0; bottom:0; transform:rotateX(180deg); }
  .dv1-right-bottom { right:0; bottom:0; transform:rotateX(180deg) rotateY(180deg); }
`;

export function DataVBorder1({ phase, isSelected, width, height }: BorderStyleProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const rAF = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(rAF);
  }, []);

  const visible = phase !== 'mounting';
  const color = '#00D4FF';
  const color2 = '#00D4FF';

  if (!mounted || !visible) return null;

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        background: 'transparent',
      }}
    >
      <style>{CORNER_CSS}</style>
      {/* 主外框透明遮罩（占位用，保持与其他边框一致的布局） */}
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, display: 'block', background: 'transparent' }}>
        <polygon
          fill="transparent"
          points={`10,27 10,${height - 27} 13,${height - 24} 13,${height - 21} 24,${height - 11}
            38,${height - 11} 41,${height - 8} 73,${height - 8} 75,${height - 10} 81,${height - 10}
            85,${height - 6} ${width - 85},${height - 6} ${width - 81},${height - 10} ${width - 75},${height - 10}
            ${width - 73},${height - 8} ${width - 41},${height - 8} ${width - 38},${height - 11}
            ${width - 24},${height - 11} ${width - 13},${height - 21} ${width - 13},${height - 24}
            ${width - 10},${height - 27} ${width - 10},27 ${width - 13},25 ${width - 13},21
            ${width - 24},11 ${width - 38},11 ${width - 41},8 ${width - 73},8 ${width - 75},10
            ${width - 81},10 ${width - 85},6 85,6 81,10 75,10 73,8 41,8 38,11 24,11 13,21 13,24`}
        />
      </svg>
      {/* 四个角标 */}
      <Corner className="dv1-corner dv1-left-top" color={color} color2={color2} />
      <Corner className="dv1-corner dv1-right-top" color={color} color2={color2} />
      <Corner className="dv1-corner dv1-left-bottom" color={color} color2={color2} />
      <Corner className="dv1-corner dv1-right-bottom" color={color} color2={color2} />
    </div>
  );
}
