import { useMemo } from 'react';
import type { BorderStyleProps } from '../BorderFrame';

/* ═══════════════════════════════════════════════════════════
   CyberBorder2 — 琥珀橙扫描线框

   基于 SVG 设计稿 (800×160 viewBox)，渐变消失外框 +
   L 形角标 + 圆点 + 数据刻度 + 三角指示器。
   入场：两层描边依次绘制，无闪烁。
   ═══════════════════════════════════════════════════════════ */

const COLOR = '#00D4FF';
const SVG_CSS = `
  .hsb2-svg path,
  .hsb2-svg line,
  .hsb2-svg polyline,
  .hsb2-svg polygon,
  .hsb2-svg rect,
  .hsb2-svg circle {
    vector-effect: non-scaling-stroke;
  }
`;

export function CyberBorder2({ phase, isSelected: _isSelected, width: W, height: H }: BorderStyleProps) {
  const gid = useMemo(() => `hsb2-g-${Math.random().toString(36).slice(2, 8)}`, []);

  // ★ 描边入场动画参数（与 CyberBorder1 相同机制）
  const drawProps = (delay: number, dur = 0.7) =>
    phase === 'entering'
      ? ({
          animationName: 'hsb1-draw-line',
          animationDuration: `${dur}s`,
          animationTimingFunction: 'ease-out',
          animationDelay: `${delay}s`,
          animationFillMode: 'both',
          strokeDasharray: 400,
          strokeDashoffset: 400,
        } as React.CSSProperties)
      : phase === 'entered'
        ? ({ strokeDasharray: 'none', strokeDashoffset: 0 } as React.CSSProperties)
        : ({ strokeDasharray: 400, strokeDashoffset: 400 } as React.CSSProperties);

  // ★ 等比例缩放 + 大区块贴边补偿（同 CyberBorder1）
  const OUTSET = 12;
  const VB_W = 800, VB_H = 160;
  const FRAME_L = 15, FRAME_R = 785, FRAME_T = 15, FRAME_B = 145;
  const FRAME_W = FRAME_R - FRAME_L;
  const FRAME_H = FRAME_B - FRAME_T;
  const marginX = (FRAME_L / VB_W) * W;
  const marginY = (FRAME_T / VB_H) * H;
  const needFixX = marginX > OUTSET;
  const needFixY = marginY > OUTSET;
  const scaleX = needFixX ? ((W - 2 * OUTSET) / W) * (VB_W / FRAME_W) : 1;
  const scaleY = needFixY ? ((H - 2 * OUTSET) / H) * (VB_H / FRAME_H) : 1;
  const sw = W * Math.max(1, scaleX);
  const sh = H * Math.max(1, scaleY);
  const ox = needFixX ? (FRAME_L / VB_W) * sw - OUTSET : 0;
  const oy = needFixY ? (FRAME_T / VB_H) * sh - OUTSET : 0;

  return (
    <div className="hs-border" style={{ overflow: 'visible' }}>
      <style>{SVG_CSS}</style>

      <svg
        className={`hsb2-svg${phase === 'entered' ? ' hsb1-breathe' : ''}`}
        width={sw} height={sh}
        viewBox="0 0 800 160"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible', display: 'block', position: 'absolute', left: -ox, top: -oy }}
      >
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={COLOR} stopOpacity="0" />
            <stop offset="20%" stopColor={COLOR} stopOpacity="1" />
            <stop offset="80%" stopColor={COLOR} stopOpacity="1" />
            <stop offset="100%" stopColor={COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ═══ 第 1 层：主结构（先绘制） ═══ */}
        <g style={drawProps(0, 0.9)} fill="none">
          {/* 四角 L 型主结构 */}
          <polyline points="15,50 15,15 50,15" stroke={COLOR} strokeWidth="3" />
          <polyline points="750,15 785,15 785,50" stroke={COLOR} strokeWidth="3" />
          <polyline points="15,110 15,145 50,145" stroke={COLOR} strokeWidth="3" />
          <polyline points="750,145 785,145 785,110" stroke={COLOR} strokeWidth="3" />

          {/* 外框：渐变消失效果 */}
          <polyline points="60,15 740,15" stroke={`url(#${gid})`} strokeWidth="2" />
          <polyline points="60,145 740,145" stroke={`url(#${gid})`} strokeWidth="2" />

          {/* 侧边竖线 */}
          <line x1="15" y1="60" x2="15" y2="100" stroke={COLOR} strokeWidth="2" />
          <line x1="785" y1="60" x2="785" y2="100" stroke={COLOR} strokeWidth="2" />

          {/* 角点圆标 */}
          <circle cx="15" cy="15" r="4" fill={COLOR} />
          <circle cx="785" cy="15" r="4" fill={COLOR} />
          <circle cx="15" cy="145" r="4" fill={COLOR} />
          <circle cx="785" cy="145" r="4" fill={COLOR} />
        </g>

        {/* ═══ 第 2 层：装饰细节（后绘制） ═══ */}
        <g style={drawProps(0.35, 0.6)} fill="none">
          {/* 内框细线 */}
          <rect x="30" y="30" width="740" height="100" stroke={COLOR} strokeWidth="0.5" opacity="0.4" />

          {/* 顶部数据刻度 */}
          <line x1="100" y1="15" x2="100" y2="25" stroke={COLOR} opacity="0.6" />
          <line x1="140" y1="15" x2="140" y2="22" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="180" y1="15" x2="180" y2="25" stroke={COLOR} opacity="0.6" />
          <line x1="220" y1="15" x2="220" y2="22" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="580" y1="15" x2="580" y2="25" stroke={COLOR} opacity="0.6" />
          <line x1="620" y1="15" x2="620" y2="22" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="660" y1="15" x2="660" y2="25" stroke={COLOR} opacity="0.6" />
          <line x1="700" y1="15" x2="700" y2="22" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />

          {/* 底部数据刻度 */}
          <line x1="100" y1="145" x2="100" y2="135" stroke={COLOR} opacity="0.6" />
          <line x1="140" y1="145" x2="140" y2="138" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="180" y1="145" x2="180" y2="135" stroke={COLOR} opacity="0.6" />
          <line x1="220" y1="145" x2="220" y2="138" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="580" y1="145" x2="580" y2="135" stroke={COLOR} opacity="0.6" />
          <line x1="620" y1="145" x2="620" y2="138" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="660" y1="145" x2="660" y2="135" stroke={COLOR} opacity="0.6" />
          <line x1="700" y1="145" x2="700" y2="138" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />

          {/* 侧边矩形装饰 */}
          <rect x="8" y="65" width="14" height="30" stroke={COLOR} strokeWidth="0.8" opacity="0.5" />
          <rect x="778" y="65" width="14" height="30" stroke={COLOR} strokeWidth="0.8" opacity="0.5" />

          {/* 中心三角指示 */}
          <polygon points="390,15 400,25 410,15" fill={COLOR} opacity="0.8" />
          <polygon points="390,145 400,135 410,145" fill={COLOR} opacity="0.8" />

          {/* 内部分割线 */}
          <line x1="200" y1="30" x2="200" y2="40" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
          <line x1="600" y1="30" x2="600" y2="40" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
          <line x1="200" y1="120" x2="200" y2="130" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
          <line x1="600" y1="120" x2="600" y2="130" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
        </g>
      </svg>
    </div>
  );
}
