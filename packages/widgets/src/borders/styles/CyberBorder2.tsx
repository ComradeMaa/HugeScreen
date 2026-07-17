import type { BorderStyleProps } from '../BorderFrame';

/**
 * CyberBorder2 — 琥珀橙上下扫描线
 *
 * 视觉：上下两条水平线 (#FF8C42)，嵌于组件内容区内侧。
 * 入场：线条由中间向两端伸展，带光泽扫过。
 * 循环：微光呼吸脉冲。
 */
export function CyberBorder2({ phase, isSelected, width: _w, height: _h }: BorderStyleProps) {
  const WIDTH = 2;
  const GAP = 6;
  const COLOR = '#FF8C42';
  const glow = isSelected ? 'rgba(255,140,66,0.55)' : 'rgba(255,140,66,0.2)';

  const phaseClass = phase === 'mounting' ? 'hsb-phase-mounting'
    : phase === 'entering' ? 'hsb-phase-entering'
    : 'hsb-phase-entered';

  const lineStyle = (pos: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute',
    left: GAP,
    right: GAP,
    [pos]: GAP,
    height: WIDTH,
    backgroundColor: COLOR,
    borderRadius: 1,
    transformOrigin: 'center center',
  });

  return (
    <div className={`hs-border ${phaseClass}`}>
      {/* ═══ 微光晕层 ═══ */}
      <div
        className="hs-border"
        style={{
          boxShadow: phase === 'entered'
            ? `inset 0 0 10px ${glow}`
            : 'none',
          animation: phase === 'entered'
            ? `hsb-glow-pulse 4s ease-in-out infinite`
            : phase === 'entering'
              ? 'hsb-glow-in 0.5s ease-out forwards'
              : 'none',
          ['--hsb-glow' as string]: glow,
        }}
      />

      {/* ═══ 上方扫描线 ═══ */}
      <div
        style={{
          ...lineStyle('top'),
          animation: phase === 'entering'
            ? 'hsb-extend-h 0.5s ease-out 0.05s forwards'
            : 'none',
          transform: phase === 'mounting' ? 'scaleX(0)' : undefined,
        }}
      />

      {/* ═══ 下方扫描线 ═══ */}
      <div
        style={{
          ...lineStyle('bottom'),
          animation: phase === 'entering'
            ? 'hsb-extend-h 0.5s ease-out 0.15s forwards'
            : 'none',
          transform: phase === 'mounting' ? 'scaleX(0)' : undefined,
        }}
      />

      {/* ═══ 光泽扫过（入场时从左到右一道亮光） ═══ */}
      {phase === 'entering' && (
        <div
          className="hs-border"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${COLOR}55 48%, ${COLOR}aa 50%, ${COLOR}55 52%, transparent 100%)`,
            animation: 'hsb-shimmer 0.7s ease-out forwards',
            backgroundSize: '200% 100%',
          }}
        />
      )}

      {/* ═══ 循环呼吸层 ═══ */}
      {phase === 'entered' && (
        <div className="hs-border" style={{ animation: 'hsb-breathe 4s ease-in-out infinite' }}>
          <div style={{ ...lineStyle('top'), opacity: 0.8 }} />
          <div style={{ ...lineStyle('bottom'), opacity: 0.8 }} />
        </div>
      )}
    </div>
  );
}
