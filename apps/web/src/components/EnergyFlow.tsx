import { useEffect, useRef } from 'react';

interface Track {
  points: [number, number][];
  phase: number;         // 0→1 头部位置
  travelTime: number;    // 跑完全程 ms
  cycleDuration: number; // 完整周期 ms
  cycleOffset: number;   // 初始相位偏移 ms
  alpha: number;         // 当前透明度
  wasActive: boolean;    // 上一帧活跃状态
}

function trackLen(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.abs(pts[i][0] - pts[i - 1][0]) +
           Math.abs(pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

function pointAt(pts: [number, number][], phase: number): [number, number] {
  if (pts.length === 1) return pts[0];
  const total = trackLen(pts);
  let target = phase * total;
  for (let i = 1; i < pts.length; i++) {
    const sl = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    if (target <= sl && sl > 0) {
      const t = target / sl;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
              pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    target -= sl;
  }
  return pts[pts.length - 1];
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  head: number, tailLen: number, alpha: number,
) {
  const tail = Math.max(0, head - tailLen);
  if (head <= tail) return;
  const total = trackLen(pts);
  const segLen = (head - tail) * total;
  const steps = Math.max(2, Math.ceil(segLen / 6));
  const step = (head - tail) / steps;

  for (let i = 0; i < steps; i++) {
    const t1 = Math.max(0, tail + i * step);
    const t2 = Math.min(1, tail + (i + 1) * step);
    const [x1, y1] = pointAt(pts, t1);
    const [x2, y2] = pointAt(pts, t2);
    const prog = (i + 1) / steps;
    const a = prog * alpha;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(0,212,255,${Math.min(1, a).toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

function buildTracks(w: number, h: number): Track[] {
  const descs: { ox: number; oy: number; waypoints: [number, number][] }[] = [
    { ox: 0,       oy: h * 0.12, waypoints: [[w * 0.15, h * 0.12], [w * 0.15, h * 0.28], [w * 0.32, h * 0.28]] },
    { ox: 0,       oy: h * 0.45, waypoints: [[w * 0.18, h * 0.45], [w * 0.18, h * 0.35], [w * 0.3,  h * 0.35]] },
    { ox: 0,       oy: h * 0.78, waypoints: [[w * 0.12, h * 0.78], [w * 0.12, h * 0.58], [w * 0.28, h * 0.58]] },
    { ox: w,       oy: h * 0.18, waypoints: [[w * 0.82, h * 0.18], [w * 0.82, h * 0.42], [w * 0.68, h * 0.42]] },
    { ox: w,       oy: h * 0.55, waypoints: [[w * 0.8,  h * 0.55], [w * 0.8,  h * 0.45], [w * 0.7,  h * 0.45]] },
    { ox: w,       oy: h * 0.85, waypoints: [[w * 0.78, h * 0.85], [w * 0.78, h * 0.65], [w * 0.65, h * 0.65]] },
    { ox: w * 0.25,oy: 0,        waypoints: [[w * 0.25, h * 0.12], [w * 0.42, h * 0.12], [w * 0.42, h * 0.25]] },
    { ox: w * 0.7, oy: 0,        waypoints: [[w * 0.7,  h * 0.1],  [w * 0.52, h * 0.1],  [w * 0.52, h * 0.22]] },
    { ox: w * 0.2, oy: h,        waypoints: [[w * 0.2,  h * 0.82], [w * 0.35, h * 0.82], [w * 0.35, h * 0.72]] },
    { ox: w * 0.65,oy: h,        waypoints: [[w * 0.65, h * 0.85], [w * 0.55, h * 0.85], [w * 0.55, h * 0.75]] },
  ];

  return descs.map(({ ox, oy, waypoints }) => {
    const pts: [number, number][] = [[ox, oy], ...waypoints];
    const plen = trackLen(pts);
    // 跑完全程时间正比于路径长度（每 500px ≈ 1s）
    const travelTime = 800 + (plen / 500) * 800 + Math.random() * 400;
    // 完整周期 = 跑完时间 × (1 + 休息比)，休息比 25-45%
    const restRatio = 0.25 + Math.random() * 0.20;
    const cycleDuration = travelTime * (1 + restRatio);
    const activeRatio = travelTime / cycleDuration;

    return {
      points: pts,
      phase: 0,
      travelTime,
      cycleDuration,
      cycleOffset: Math.random() * cycleDuration,
      alpha: 0,
      wasActive: false,
    };
  });
}

interface EnergyFlowProps {
  canvasW: number;
  canvasH: number;
}

export function EnergyFlow({ canvasW, canvasH }: EnergyFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracksRef = useRef<Track[]>([]);

  useEffect(() => {
    tracksRef.current = buildTracks(canvasW, canvasH);
  }, [canvasW, canvasH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let running = true;
    let lastTime = 0;

    function tick(now: number) {
      if (!running) return;
      if (!lastTime) lastTime = now;
      const delta = Math.min(now - lastTime, 50);
      lastTime = now;

      ctx!.clearRect(0, 0, canvasW, canvasH);

      for (const tr of tracksRef.current) {
        const cycleTime = (now + tr.cycleOffset) % tr.cycleDuration;
        const isActive = cycleTime < tr.travelTime;
        const maxAlpha = 0.55;

        // 活跃状态切换 → 重置相位
        if (isActive !== tr.wasActive) {
          tr.wasActive = isActive;
          if (isActive) tr.phase = 0;
        }

        // alpha 由相位驱动：开头淡入（0→tailLen），末尾淡出（1-tailLen→1）
        const fadeZone = 0.30; // 淡入淡出各占轨道 30%
        if (isActive) {
          if (tr.phase < fadeZone) {
            tr.alpha = (tr.phase / fadeZone) * maxAlpha;
          } else if (tr.phase > 1 - fadeZone) {
            tr.alpha = ((1 - tr.phase) / fadeZone) * maxAlpha;
          } else {
            tr.alpha = maxAlpha;
          }
        } else {
          tr.alpha = 0;
        }

        // 推进相位
        tr.phase = (tr.phase + delta / tr.travelTime) % 1;

        if (tr.alpha > 0.003) {
          const tailLen = 0.45 + tr.alpha * 0.25;
          ctx!.shadowBlur = 8;
          ctx!.shadowColor = `rgba(0,212,255,${(tr.alpha * 0.35).toFixed(3)})`;
          drawRibbon(ctx!, tr.points, tr.phase, tailLen, tr.alpha);
          ctx!.shadowBlur = 0;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    const rafRef = { current: 0 };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [canvasW, canvasH]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasW}
      height={canvasH}
      className="absolute inset-0 pointer-events-none z-5"
      style={{ width: canvasW, height: canvasH }}
    />
  );
}
