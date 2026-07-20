import { useState, useEffect, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════
   HeaderBorder1 — HUD-1 顶栏边框

   SVG 设计稿 (900×140 viewBox)，渐变横线 + 双层L角标 + 菱形
   + 标题区背景框 + 数据刻度 + 侧边矩形 + 十字准星。
   入场：两侧粗竖线从中间向外「揭幕」，其余描边依次绘制。
   ═══════════════════════════════════════════════════════════ */

const COLOR = '#00D4FF';
const GID = 'hb1-grad'; // 静态 ID — 顶栏只有一个实例，不需要 per-instance 唯一化

interface HeaderBorder1Props {
  width: number;
  height: number;
}

export function HeaderBorder1({ width: W, height: H }: HeaderBorder1Props) {
  const [phase, setPhase] = useState<'mounting' | 'entering' | 'entered'>('mounting');

  useEffect(() => {
    const rAF = requestAnimationFrame(() => setPhase('entering'));
    const timer = setTimeout(() => setPhase('entered'), 1400);
    return () => { cancelAnimationFrame(rAF); clearTimeout(timer); };
  }, []);

  const drawProps = (delay: number, dur = 0.7, dashLen = 400) => {
    const name = dashLen === 1000 ? 'hsb1-draw-line-1k' : 'hsb1-draw-line';
    return phase === 'entering'
      ? ({
          animationName: name,
          animationDuration: `${dur}s`,
          animationTimingFunction: 'ease-out',
          animationDelay: `${delay}s`,
          animationFillMode: 'both',
          strokeDasharray: dashLen,
          strokeDashoffset: dashLen,
        } as React.CSSProperties)
      : phase === 'entered'
        ? ({ strokeDasharray: 'none', strokeDashoffset: 0 } as React.CSSProperties)
        : ({ strokeDasharray: dashLen, strokeDashoffset: dashLen } as React.CSSProperties);
  };

  // ★ 闪烁两次出现（帷幕结束后）
  const flashProps = (delay: number): React.CSSProperties =>
    phase === 'entering'
      ? {
          animationName: 'hb1-flash-twice',
          animationDuration: '0.5s',
          animationTimingFunction: 'steps(1)',
          animationDelay: `${delay}s`,
          animationFillMode: 'both',
          opacity: 0,
        }
      : phase === 'mounting'
        ? { opacity: 0 }
        : {};

  // ★ 帷幕效果：两侧粗竖线从中心向外移动
  const curtainStyle = (dir: 'left' | 'right', delay: number): React.CSSProperties =>
    phase === 'entering'
      ? {
          animationName: dir === 'left' ? 'hb1-curtain-left' : 'hb1-curtain-right',
          animationDuration: '0.7s',
          animationTimingFunction: 'ease-out',
          animationDelay: `${delay}s`,
          animationFillMode: 'both',
        }
      : {};

  const visible = phase !== 'mounting';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: visible ? 1 : 0, pointerEvents: 'none' }}>
      <svg
        width={W}
        height={H}
        viewBox="0 0 900 140"
        preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={GID} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={COLOR} stopOpacity="0" />
            <stop offset="15%" stopColor={COLOR} stopOpacity="1" />
            <stop offset="85%" stopColor={COLOR} stopOpacity="1" />
            <stop offset="100%" stopColor={COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ═══ 第 1 层：主结构（先绘制，大 dasharray 覆盖长矩形周长） ═══ */}
        <g style={drawProps(0, 0.8, 1000)} fill="none">
          {/* 渐变横线 */}
          <polyline points="100,20 800,20" stroke={`url(#${GID})`} strokeWidth="2.5" />
          <polyline points="100,120 800,120" stroke={`url(#${GID})`} strokeWidth="2.5" />

          {/* 角点菱形 */}
          <polygon points="20,20 24,16 28,20 24,24" fill={COLOR} />
          <polygon points="880,20 876,16 872,20 876,24" fill={COLOR} />
          <polygon points="20,120 24,116 28,120 24,124" fill={COLOR} />
          <polygon points="880,120 876,116 872,120 876,124" fill={COLOR} />

          {/* 标题区背景框 */}
          <rect x="250" y="8" width="400" height="24" stroke={COLOR} strokeWidth="1.5" opacity="0.8" />
          <rect x="255" y="12" width="390" height="16" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />

          {/* 标题区中心三角 */}
          <polygon points="440,8 450,18 460,8" fill={COLOR} opacity="0.9" />
          <polygon points="440,32 450,22 460,32" fill={COLOR} opacity="0.9" />
        </g>

        {/* ═══ 第 2 层：帷幕竖线（从中间向外移动） ═══ */}
        <g style={curtainStyle('left', 0.4)}>
          <line x1="20" y1="50" x2="20" y2="90" stroke={COLOR} strokeWidth="2.5"
            style={drawProps(0.4, 0.5)} />
        </g>
        <g style={curtainStyle('right', 0.4)}>
          <line x1="880" y1="50" x2="880" y2="90" stroke={COLOR} strokeWidth="2.5"
            style={drawProps(0.4, 0.5)} />
        </g>

        {/* ═══ 第 2.5 层：四角粗 L — 帷幕到终点后闪烁两次 ═══ */}
        <g style={flashProps(1.1)} fill="none">
          <polyline points="20,40 20,20 100,20" stroke={COLOR} strokeWidth="4" />
          <polyline points="800,20 880,20 880,40" stroke={COLOR} strokeWidth="4" />
          <polyline points="20,100 20,120 100,120" stroke={COLOR} strokeWidth="4" />
          <polyline points="800,120 880,120 880,100" stroke={COLOR} strokeWidth="4" />
        </g>

        {/* ═══ 第 3 层：装饰细节（后绘制） ═══ */}
        <g style={drawProps(0.6, 0.55)} fill="none">
          {/* 内层 L */}
          <polyline points="20,45 20,20 95,20" stroke={COLOR} strokeWidth="1.5" opacity="0.4" />
          <polyline points="805,20 880,20 880,45" stroke={COLOR} strokeWidth="1.5" opacity="0.4" />
          <polyline points="20,95 20,120 95,120" stroke={COLOR} strokeWidth="1.5" opacity="0.4" />
          <polyline points="805,120 880,120 880,95" stroke={COLOR} strokeWidth="1.5" opacity="0.4" />

          {/* 顶部数据刻度 */}
          <line x1="150" y1="20" x2="150" y2="32" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="170" y1="20" x2="170" y2="26" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="190" y1="20" x2="190" y2="32" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="210" y1="20" x2="210" y2="26" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="690" y1="20" x2="690" y2="32" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="710" y1="20" x2="710" y2="26" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="730" y1="20" x2="730" y2="32" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="750" y1="20" x2="750" y2="26" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />

          {/* 底部数据刻度 */}
          <line x1="150" y1="120" x2="150" y2="108" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="170" y1="120" x2="170" y2="114" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="190" y1="120" x2="190" y2="108" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="210" y1="120" x2="210" y2="114" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="690" y1="120" x2="690" y2="108" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="710" y1="120" x2="710" y2="114" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="730" y1="120" x2="730" y2="108" stroke={COLOR} strokeWidth="1.5" opacity="0.7" />
          <line x1="750" y1="120" x2="750" y2="114" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />

          {/* 侧边矩形装饰 */}
          <rect x="6" y="55" width="14" height="30" stroke={COLOR} strokeWidth="1" opacity="0.5" />
          <rect x="10" y="60" width="6" height="20" fill={COLOR} opacity="0.15" />
          <rect x="880" y="55" width="14" height="30" stroke={COLOR} strokeWidth="1" opacity="0.5" />
          <rect x="884" y="60" width="6" height="20" fill={COLOR} opacity="0.15" />

          {/* 内部细框 */}
          <rect x="40" y="35" width="820" height="70" stroke={COLOR} strokeWidth="0.4" opacity="0.25" />

          {/* 内部十字准星 */}
          <line x1="445" y1="70" x2="455" y2="70" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />
          <line x1="450" y1="65" x2="450" y2="75" stroke={COLOR} strokeWidth="0.8" opacity="0.4" />

          {/* 角部斜线 */}
          <line x1="40" y1="35" x2="55" y2="50" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
          <line x1="860" y1="35" x2="845" y2="50" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
          <line x1="40" y1="105" x2="55" y2="90" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
          <line x1="860" y1="105" x2="845" y2="90" stroke={COLOR} strokeWidth="0.5" opacity="0.3" />
        </g>
      </svg>
    </div>
  );
}
