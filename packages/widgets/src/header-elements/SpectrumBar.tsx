/**
 * SpectrumBar — 频谱跳动装饰
 * 7 根宽竖条高度弹跳，底部光点，科技感音频可视化器风格
 */
export function SpectrumBar() {
  const bars = [
    { delay: 0, minH: 25, maxH: 75 },
    { delay: 0.2, minH: 15, maxH: 50 },
    { delay: 0.35, minH: 20, maxH: 60 },
    { delay: 0.1, minH: 30, maxH: 90 },
    { delay: 0.45, minH: 20, maxH: 65 },
    { delay: 0.25, minH: 15, maxH: 55 },
    { delay: 0.4, minH: 25, maxH: 85 },
  ];

  return (
    <div className="flex items-end justify-center gap-[4px] h-full w-full px-1">
      <style>{`
        @keyframes spectrumPulse0 { 0% { height: 25%; } 100% { height: 75%; } }
        @keyframes spectrumPulse1 { 0% { height: 15%; } 100% { height: 50%; } }
        @keyframes spectrumPulse2 { 0% { height: 20%; } 100% { height: 60%; } }
        @keyframes spectrumPulse3 { 0% { height: 30%; } 100% { height: 90%; } }
        @keyframes spectrumPulse4 { 0% { height: 20%; } 100% { height: 65%; } }
        @keyframes spectrumPulse5 { 0% { height: 15%; } 100% { height: 55%; } }
        @keyframes spectrumPulse6 { 0% { height: 25%; } 100% { height: 85%; } }
      `}</style>
      {bars.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center" style={{ height: '100%', justifyContent: 'flex-end', minWidth: 0 }}>
          <div
            className="w-full rounded-sm"
            style={{
              animation: `spectrumPulse${i} 1.2s ease-in-out ${b.delay}s infinite alternate`,
              background: 'linear-gradient(to top, rgba(0,212,255,0.55), rgba(0,212,255,0.08))',
              boxShadow: '0 0 6px rgba(0,212,255,0.3)',
              height: '20%',
              maxWidth: '14px',
            }}
          />
          <div
            className="rounded-full mt-0.5 flex-shrink-0"
            style={{
              width: '3px',
              height: '3px',
              backgroundColor: 'rgba(0,212,255,0.5)',
              boxShadow: '0 0 4px rgba(0,212,255,0.4)',
            }}
          />
        </div>
      ))}
    </div>
  );
}
