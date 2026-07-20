import type { BorderStyleProps } from '../BorderFrame';

/* ═══════════════════════════════════════════════════════════
   CyberBorder1 — HUD 中控斜切科技线框

   基于用户提供的精确 SVG 设计稿 (1920×1080 viewBox)。
   渲染时拉伸适配任意 widget 尺寸，line-width 保持不变。
   当前为静态版本 — 验证定位后再加动画。
   ═══════════════════════════════════════════════════════════ */

const SVG_CSS = `
  .hsb1-svg path,
  .hsb1-svg line,
  .hsb1-svg rect,
  .hsb1-svg circle {
    vector-effect: non-scaling-stroke;
  }
`;

export function CyberBorder1({ phase, isSelected: _isSelected, width: W, height: H }: BorderStyleProps) {
  // ★ 描边入场动画参数
  const drawProps = (delay: number, dur = 0.7) =>
    phase === 'entering'
      ? {
          animationName: 'hsb1-draw-line',
          animationDuration: `${dur}s`,
          animationTimingFunction: 'ease-out',
          animationDelay: `${delay}s`,
          animationFillMode: 'both',
          strokeDasharray: 400,
          strokeDashoffset: 400,
        } as React.CSSProperties
      : phase === 'entered'
        ? ({ strokeDasharray: 'none', strokeDashoffset: 0 } as React.CSSProperties)
        : ({ strokeDasharray: 400, strokeDashoffset: 400 } as React.CSSProperties);
  const glitchProps = (delay: number) =>
    phase === 'entering'
      ? ({
          animationName: 'hsb1-glitch-in',
          animationDuration: '0.45s',
          animationTimingFunction: 'steps(1)',
          animationDelay: `${delay}s`,
          animationFillMode: 'both',
          opacity: 0,
        } as React.CSSProperties)
      : phase === 'mounting'
        ? ({ opacity: 0 } as React.CSSProperties)
        : undefined;

  // ★ 等比例缩放 + 大区块贴边补偿
  //    SVG viewBox=1920×1080，主外框位于 x≈40..1880, y≈40..1020
  //    小尺寸时 frameMargin < borderOutset 无需补偿；大尺寸时微量放大 SVG 并
  //    反向偏移，把外框"推"到容器边缘，保持内部比例仅微变。
  const OUTSET = 12; // borderOutset，与 ScreenCanvas 一致
  const VB_W = 1920, VB_H = 1080;
  const FRAME_L = 40, FRAME_R = 1880, FRAME_T = 40, FRAME_B = 1020;
  const FRAME_W = FRAME_R - FRAME_L; // 1840
  const FRAME_H = FRAME_B - FRAME_T; // 980

  // 不补偿时外框距容器边缘的像素
  const marginX = (FRAME_L / VB_W) * W;
  const marginY = (FRAME_T / VB_H) * H;

  // 仅当 margin 超出目标时才补偿（大区块）
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
        className={`hsb1-svg${phase === 'entered' ? ' hsb1-breathe' : ''}`}
        width={sw}
        height={sh}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          overflow: 'visible',
          display: 'block',
          position: 'absolute',
          left: -ox,
          top: -oy,
        }}
      >
        {/* ========== 最外层主框（粗线 4px） ========== */}
        <g style={drawProps(0, 1.2) as React.CSSProperties} stroke="#00D4FF" strokeWidth="4" fill="none" strokeLinecap="square">
          <path d="M 40 140 L 40 80 L 80 40 L 360 40" />
          <path d="M 1700 40 L 1840 40 L 1880 80 L 1880 50 L 1900 30" />
          <path d="M 1880 140 L 1880 220 L 1860 240 L 1860 300 L 1880 320" />
          <path d="M 1880 320 L 1880 540" />
          <path d="M 1880 580 L 1880 800" />
          <path d="M 1880 840 L 1880 980 L 1840 1020 L 1640 1020" />
          <path d="M 40 600 L 40 980 L 80 1020 L 220 1020" />
          <path d="M 40 200 L 40 260" />
          <path d="M 1200 1020 L 1640 1020" />
        </g>

        {/* ========== 第二层内边框（中粗线 2.5px） ========== */}
        <g style={drawProps(0.25, 0.65) as React.CSSProperties} stroke="#00D4FF" strokeWidth="2.5" fill="none" strokeLinecap="square">
          <path d="M 90 100 L 90 80 L 110 60 L 950 60" />
          <path d="M 1060 60 L 1790 60 L 1820 90 L 1820 115" />
          <path d="M 1850 190 L 1850 215 L 1835 230 L 1835 305 L 1850 320" />
          <path d="M 1850 320 L 1850 530" />
          <path d="M 1850 570 L 1850 815" />
          <path d="M 1850 850 L 1850 965 L 1825 990 L 1620 990" />
          <path d="M 890 990 L 1200 990" />
          <path d="M 90 120 L 90 235" />
          <path d="M 90 265 L 90 340 L 75 365 L 75 505 L 90 530 L 90 595" />
          <path d="M 90 625 L 90 965 L 115 990 L 260 990" />
        </g>

        {/* ========== 内部装饰细线（1px） ========== */}
        <g style={drawProps(0.45, 0.65) as React.CSSProperties} stroke="#00D4FF" strokeWidth="1" fill="none" strokeLinecap="square">
          {/* 顶部梯形长条（三层嵌套） */}
          <path d="M 400 40 L 1000 40 L 1040 80 L 440 80 Z" />
          <path d="M 420 52 L 980 52 L 1010 72 L 450 72 Z" />
          <path d="M 435 60 L 965 60 L 990 70 L 460 70 Z" />


          {/* 顶部6个斜空心矩形刻度 — 故障闪烁 */}
          <g className="hsb1-ticks" style={glitchProps(1.3)}>
            <path d="M 1070 40 L 1094 40 L 1124 80 L 1100 80 Z" />
            <path d="M 1124 40 L 1148 40 L 1178 80 L 1154 80 Z" />
            <path d="M 1178 40 L 1202 40 L 1232 80 L 1208 80 Z" />
            <path d="M 1232 40 L 1256 40 L 1286 80 L 1262 80 Z" />
            <path d="M 1286 40 L 1310 40 L 1340 80 L 1316 80 Z" />
            <path d="M 1340 40 L 1364 40 L 1394 80 L 1370 80 Z" />
          </g>

          {/* 顶部右短横条凸起 */}
          <path d="M 1420 50 L 1600 50 L 1600 65 L 1420 65 Z" />
          <path d="M 1435 55 L 1585 55" />

          {/* 右上角内边框错位折线 */}
          <path d="M 1640 73 L 1680 73" />
          <path d="M 1680 83 L 1720 83" />
          <path d="M 1720 73 L 1750 73" />
          <path d="M 1835 100 L 1835 140" />
          <path d="M 1825 140 L 1825 180" />
          <path d="M 1835 180 L 1835 215" />

          {/* 右上角小方块阵列 */}
          <rect x="1815" y="150" width="7" height="7" />
          <rect x="1828" y="150" width="7" height="7" />
          <rect x="1815" y="163" width="7" height="7" />

          {/* 左侧中间大凸起（三层嵌套） */}
          <path d="M 40 260 L 40 360 L 20 390 L 20 500 L 40 530 L 40 590" />
          <path d="M 60 280 L 60 360 L 40 390 L 40 490 L 60 520 L 60 570" />
          <path d="M 75 290 L 75 500" />
          <path d="M 88 300 L 88 490" />

          {/* 左侧上段矩形阵列 */}
          <rect x="40" y="145" width="25" height="20" />
          <rect x="70" y="145" width="15" height="20" />
          <rect x="40" y="170" width="45" height="8" />

          {/* 左侧中段矩形装饰 */}
          <rect x="75" y="380" width="12" height="35" />
          <rect x="75" y="425" width="12" height="35" />
          <line x1="75" y1="398" x2="87" y2="398" />
          <line x1="75" y1="443" x2="87" y2="443" />

          {/* 左侧下段矩形阵列 */}
          <rect x="40" y="820" width="30" height="25" />
          <rect x="75" y="820" width="15" height="25" />
          <rect x="40" y="850" width="50" height="8" />

          {/* 左侧底部阶梯竖条 */}
          <rect x="40" y="880" width="8" height="60" />
          <rect x="55" y="900" width="8" height="40" />
          <rect x="70" y="920" width="8" height="20" />

          {/* 左侧上下分隔短线 */}
          <line x1="40" y1="235" x2="80" y2="235" />
          <line x1="40" y1="600" x2="85" y2="600" />
          <line x1="40" y1="625" x2="65" y2="625" />

          {/* 右侧上段凸起 */}
          <path d="M 1880 360 L 1910 360 L 1910 440 L 1880 440" />
          <path d="M 1910 380 L 1930 380 L 1930 420 L 1910 420" />
          <rect x="1915" y="390" width="6" height="6" />
          <rect x="1915" y="404" width="6" height="6" />

          {/* 右侧双竖线 */}
          <path d="M 1900 540 L 1900 780" />
          <path d="M 1920 570 L 1920 740" />

          {/* 右侧下段凸起 */}
          <path d="M 1880 770 L 1910 770 L 1910 840 L 1880 840" />
          <rect x="1895" y="790" width="10" height="10" />
          <rect x="1895" y="810" width="10" height="10" />

          {/* 右侧中间分隔装饰 */}
          <line x1="1880" y1="500" x2="1910" y2="500" />
          <line x1="1880" y1="540" x2="1900" y2="540" />
          <line x1="1880" y1="800" x2="1910" y2="800" />

          {/* 底部三组刻度 — 故障闪烁 */}
          <g className="hsb1-glitch-item" style={glitchProps(1.45)}>
            <path d="M 250 950 L 310 950 L 310 968 L 250 968 Z" />
            <line x1="280" y1="968" x2="280" y2="1005" />
            <circle cx="262" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <circle cx="280" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <circle cx="298" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <rect x="260" y="956" width="6" height="6" />
            <rect x="294" y="956" width="6" height="6" />
            <path d="M 320 950 L 380 950 L 380 968 L 320 968 Z" />
            <line x1="350" y1="968" x2="350" y2="1005" />
            <circle cx="332" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <circle cx="350" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <circle cx="368" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <rect x="330" y="956" width="6" height="6" />
            <rect x="364" y="956" width="6" height="6" />
            <path d="M 390 950 L 450 950 L 450 968 L 390 968 Z" />
            <line x1="420" y1="968" x2="420" y2="1005" />
            <circle cx="402" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <circle cx="420" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <circle cx="438" cy="938" r="2" fill="#00D4FF" stroke="none" />
            <rect x="400" y="956" width="6" height="6" />
            <rect x="434" y="956" width="6" height="6" />
          </g>

          {/* 底部横向长矩形框（三层嵌套） */}
          <path d="M 480 930 L 840 930 L 880 970 L 480 970 Z" />
          <path d="M 495 942 L 825 942 L 860 962 L 495 962 Z" />
          <path d="M 510 950 L 810 950 L 840 960 L 510 960 Z" />

          {/* 底部锯齿箭头组（5个） — 故障闪烁 */}
          <g className="hsb1-glitch-item" style={glitchProps(1.6)}>
            <path d="M 920 930 L 960 970 L 920 970 L 940 950 L 920 930 Z" />
            <path d="M 980 930 L 1020 970 L 980 970 L 1000 950 L 980 930 Z" />
            <path d="M 1040 930 L 1080 970 L 1040 970 L 1060 950 L 1040 930 Z" />
            <path d="M 1100 930 L 1140 970 L 1100 970 L 1120 950 L 1100 930 Z" />
            <path d="M 1160 930 L 1200 970 L 1160 970 L 1180 950 L 1160 930 Z" />
          </g>

          {/* 底部右三条横线（粗细递减） */}
          <path d="M 1240 950 L 1620 950" />
          <path d="M 1240 970 L 1620 970" />
          <path d="M 1280 990 L 1620 990" />

          {/* 底部连接短线 */}
          <line x1="220" y1="1020" x2="250" y2="1020" />
          <line x1="310" y1="1020" x2="390" y2="1020" />
          <line x1="450" y1="1020" x2="480" y2="1020" />
          <line x1="880" y1="1020" x2="920" y2="1020" />
          <line x1="1200" y1="1020" x2="1240" y2="1020" />
        </g>

        {/* ========== 中等过渡线（2px） ========== */}
        <g style={drawProps(0.6, 0.6) as React.CSSProperties} stroke="#00D4FF" strokeWidth="2" fill="none" strokeLinecap="square">
          <path d="M 40 170 L 40 200" />
          <path d="M 40 590 L 40 600" />
          <path d="M 1880 440 L 1880 540" />
          <path d="M 1880 800 L 1880 770" />
        </g>
      </svg>
    </div>
  );
}
