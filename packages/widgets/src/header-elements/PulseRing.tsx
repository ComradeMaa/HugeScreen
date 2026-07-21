/**
 * SignalTower — 脉冲环主体 + A 字形基站塔
 * 大尺寸脉冲环位于组件中线，A 字塔顶与环心重合
 */
export function SignalTower() {
  return (
    <div className="flex items-center justify-center h-full w-full relative">
      <svg viewBox="0 0 100 100" className="w-full h-full"
        preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="stGlow">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        <style>{`
          @keyframes pulseRing {
            0% { r: 8; opacity: 0.9; }
            100% { r: 34; opacity: 0; }
          }
          @keyframes pulseRing2 {
            0% { r: 8; opacity: 0.7; }
            100% { r: 32; opacity: 0; }
          }
          @keyframes pulseRing3 {
            0% { r: 8; opacity: 0.55; }
            100% { r: 30; opacity: 0; }
          }
          @keyframes blink {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
        `}</style>

        {/* ═══ A 字塔身 — 背面（伪 3D 深度，向右下偏移） ═══ */}
        <g stroke="rgba(0,212,255,0.08)" fill="none" strokeWidth="0.8"
          transform="translate(2, 1)">
          <line x1="26" y1="94" x2="45" y2="50" />
          <line x1="74" y1="94" x2="55" y2="50" />
          {[0.25, 0.45, 0.65, 0.85].map((t) => {
            const y = 50 + (94 - 50) * t;
            const lx = 26 + (45 - 26) * t;
            const rx = 74 - (74 - 55) * t;
            return <line key={'bb'+t} x1={lx} y1={y} x2={rx} y2={y} />;
          })}
        </g>

        {/* ═══ A 字塔身 — 正面 ═══ */}
        <g stroke="rgba(0,212,255,0.3)" fill="none" strokeWidth="1.2" strokeLinecap="round">
          {/* 左支柱 */}
          <line x1="24" y1="94" x2="43" y2="50" />
          {/* 右支柱 */}
          <line x1="76" y1="94" x2="57" y2="50" />
          {/* X 形交叉横梁 */}
          {[0.25, 0.45, 0.65, 0.85].map((t) => {
            const yTop = 50 + (94 - 50) * (t - 0.06);
            const yBot = 50 + (94 - 50) * (t + 0.06);
            const lxT = 24 + (43 - 24) * (t - 0.06);
            const rxT = 76 - (76 - 57) * (t - 0.06);
            const lxB = 24 + (43 - 24) * (t + 0.06);
            const rxB = 76 - (76 - 57) * (t + 0.06);
            return (
              <g key={'xb'+t}>
                <line x1={lxT} y1={yTop} x2={rxB} y2={yBot} stroke="rgba(0,212,255,0.1)" strokeWidth="0.6" />
                <line x1={rxT} y1={yTop} x2={lxB} y2={yBot} stroke="rgba(0,212,255,0.1)" strokeWidth="0.6" />
              </g>
            );
          })}
          {/* 底部横梁 */}
          <line x1="24" y1="94" x2="76" y2="94" stroke="rgba(0,212,255,0.25)" strokeWidth="1" />
        </g>

        {/* ═══ 脉冲信号环 — 环心 (50, 50)，组件中线 ═══ */}
        <g transform="translate(50, 50)">
          {/* 参考环（静态） */}
          <circle cx="0" cy="0" r="12" fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="0.5" />
          <circle cx="0" cy="0" r="22" fill="none" stroke="rgba(0,212,255,0.05)" strokeWidth="0.4" strokeDasharray="2 3" />
          {/* 十字标线 */}
          <line x1="0" y1="-5" x2="0" y2="-9" stroke="rgba(0,212,255,0.25)" strokeWidth="0.5" />
          <line x1="0" y1="5" x2="0" y2="9" stroke="rgba(0,212,255,0.25)" strokeWidth="0.5" />
          <line x1="-5" y1="0" x2="-9" y2="0" stroke="rgba(0,212,255,0.25)" strokeWidth="0.5" />
          <line x1="5" y1="0" x2="9" y2="0" stroke="rgba(0,212,255,0.25)" strokeWidth="0.5" />

          {/* 扩散脉冲 */}
          <circle cx="0" cy="0" r="8" fill="none" stroke="rgba(0,212,255,0.8)" strokeWidth="1.2"
            style={{ animation: 'pulseRing 2.4s ease-out 0s infinite' }} />
          <circle cx="0" cy="0" r="8" fill="none" stroke="rgba(0,212,255,0.55)" strokeWidth="1.0"
            style={{ animation: 'pulseRing2 2.4s ease-out 0.8s infinite' }} />
          <circle cx="0" cy="0" r="8" fill="none" stroke="rgba(0,212,255,0.4)" strokeWidth="0.9"
            style={{ animation: 'pulseRing3 2.4s ease-out 1.6s infinite' }} />

          {/* 环心光点 */}
          <circle cx="0" cy="0" r="3" fill="rgba(0,212,255,0.9)" filter="url(#stGlow)"
            style={{ animation: 'blink 2s ease-in-out infinite' }} />
        </g>
      </svg>
    </div>
  );
}
