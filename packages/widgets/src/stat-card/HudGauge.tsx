import { useMemo } from 'react';

interface HudGaugeProps {
  percent?: number;
  label?: string;
}

interface RingSpec {
  radius: number;
  strokeWidth: number;
  opacity: number;
  color: string;
  rotation: number;
  arcCount: number;
  arcSpan: number;
  tickSize: number;
}

const RINGS: RingSpec[] = [
  { radius: 480, strokeWidth: 3.5, opacity: 0.9,  color: '#00f5d4', rotation: 0,   arcCount: 12, arcSpan: 0.9, tickSize: 7 },
  { radius: 410, strokeWidth: 3,   opacity: 0.75, color: '#00f5d4', rotation: 15,  arcCount: 12, arcSpan: 0.9, tickSize: 6 },
  { radius: 340, strokeWidth: 2.5, opacity: 0.6,  color: '#00f5d4', rotation: -10, arcCount: 12, arcSpan: 0.9, tickSize: 5 },
  { radius: 270, strokeWidth: 2.2, opacity: 0.5,  color: '#4ecdc4', rotation: 25,  arcCount: 12, arcSpan: 0.9, tickSize: 4.5 },
  { radius: 200, strokeWidth: 1.8, opacity: 0.4,  color: '#7fdbda', rotation: -20, arcCount: 12, arcSpan: 0.9, tickSize: 3.5 },
  { radius: 140, strokeWidth: 1.4, opacity: 0.3,  color: '#a8e6cf', rotation: 35,  arcCount: 12, arcSpan: 0.9, tickSize: 3 },
  { radius: 90,  strokeWidth: 1.2, opacity: 0.25, color: '#d4f1f4', rotation: -45, arcCount: 12, arcSpan: 0.9, tickSize: 2.5 },
];

const VB = 520; // viewBox half-extent

function arcPath(r: number, a0: number, a1: number) {
  const x1 = r * Math.cos(a0), y1 = r * Math.sin(a0);
  const x2 = r * Math.cos(a1), y2 = r * Math.sin(a1);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

function Tick({ r, a, s, c }: { r: number; a: number; s: number; c: string }) {
  const x = r * Math.cos(a) - s / 2, y = r * Math.sin(a) - s / 2;
  return <rect x={x} y={y} width={s} height={s} fill={c} />;
}

export function HudGauge({ percent = 98, label = 'SYSTEM' }: HudGaugeProps) {
  const pct = Math.max(0, Math.min(100, percent));

  const ringElements = useMemo(() => RINGS.map((ring, ri) => {
    const segAngle = (Math.PI * 2) / ring.arcCount;
    const arcAngle = segAngle * ring.arcSpan;
    const litCount = Math.max(1, Math.round((pct / 100) * ring.arcCount));
    return (
      <g key={ri} opacity={ring.opacity} transform={`rotate(${ring.rotation})`}>
        {Array.from({ length: ring.arcCount }, (_, s) => {
          const a0 = s * segAngle - Math.PI / 2;
          const a1 = a0 + arcAngle;
          return <path key={`d-${s}`} d={arcPath(ring.radius, a0, a1)}
            stroke={ring.color} strokeWidth={ring.strokeWidth * 0.35} fill="none" strokeLinecap="round" opacity={0.2} />;
        })}
        {Array.from({ length: litCount }, (_, s) => {
          const a0 = s * segAngle - Math.PI / 2;
          const a1 = a0 + arcAngle;
          return (
            <g key={`l-${s}`}>
              <path d={arcPath(ring.radius, a0, a1)} stroke={ring.color} strokeWidth={ring.strokeWidth} fill="none" strokeLinecap="round" />
              <Tick r={ring.radius} a={a0} s={ring.tickSize} c={ring.color} />
              <Tick r={ring.radius} a={a1} s={ring.tickSize} c={ring.color} />
            </g>
          );
        })}
      </g>
    );
  }), [pct]);

  return (
    <div className="w-full h-full flex items-center justify-center select-none" style={{ perspective: '900px' }}>
      <div style={{ transform: 'rotateX(55deg) rotateY(-15deg)', width: '92%', height: '92%' }}>
        <svg viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="hg-strong" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="14" result="b1"/>
              <feGaussianBlur stdDeviation="28" result="b2"/>
              <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="hg-mid" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="hg-ghost" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="9"/>
            </filter>
          </defs>

          {/* ── 装饰层 ── */}
          <g opacity="0.35">
            {[[-510,0,-490,0],[490,0,510,0],[0,-510,0,-490],[0,490,0,510],
              [-370,-370,-350,-350],[370,-370,350,-350],[-370,370,-350,350],[370,370,350,350]]
              .map(([x1,y1,x2,y2],i) => <line key={`a${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#00f5d4" strokeWidth={i<4?2.5:1.5} strokeLinecap="round"/>)}
          </g>
          <g opacity="0.4">
            {[[240,160,10],[400,190,8],[200,300,7],[420,350,9],[320,130,6],[380,380,6]]
              .map(([x,y,s],i) => <rect key={`p${i}`} x={Number(x)} y={Number(y)} width={Number(s)} height={Number(s)} fill="#00f5d4"/>)}
          </g>

          {/* ── 环系统 ── */}
          <g filter="url(#hg-mid)">
            {ringElements}
          </g>

          {/* ── 文字系统 ── */}
          <g filter="url(#hg-ghost)" opacity="0.3" transform="translate(0, 65) scale(1, -0.55)">
            <text x="0" y="0" textAnchor="middle" fontFamily="Arial Black,sans-serif" fontSize="44" fontWeight="900" fontStyle="italic" fill="#00f5d4" letterSpacing="2">{pct}%</text>
            <text x="0" y="24" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="300" fill="#4ecdc4" letterSpacing="8">{label}</text>
          </g>
          <g filter="url(#hg-strong)">
            <text x="0" y="0" textAnchor="middle" fontFamily="Arial Black,sans-serif" fontSize="44" fontWeight="900" fontStyle="italic" fill="#fff" letterSpacing="2">{pct}%</text>
          </g>
          <g filter="url(#hg-mid)">
            <text x="0" y="24" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="300" fill="#4ecdc4" letterSpacing="8">{label}</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
