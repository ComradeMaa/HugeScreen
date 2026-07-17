import { useEffect, useRef } from 'react';

interface TrackDef {
  points: [number, number][];
  travelTime: number; // ms 跑完全程
}

interface ActiveTrack {
  defIdx: number;   // 对应的轨道定义索引
  phase: number;    // 0→1
  travelTime: number;
  alpha: number;    // 由 phase 计算
}

const ACTIVE_COUNT = 20; // 始终维持 20 条活跃线
const COOLDOWN = 3;      // 同一轨道至少间隔 3 轮才能复用

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

/** 40 条轨道定义池 — 所有折线均为直角拐弯 */
function buildTrackPool(w: number, h: number): TrackDef[] {
  const pool: { ox: number; oy: number; waypoints: [number, number][] }[] = [];

  // 左边 10 条：先水平右移 → 再竖直 → 再水平
  for (let i = 0; i < 10; i++) {
    const oy = h * (0.04 + i * 0.092);
    const mx1 = w * (0.10 + Math.random() * 0.08);
    const my1 = oy + (Math.random() > 0.5 ? 1 : -1) * h * (0.04 + Math.random() * 0.08);
    const mx2 = w * (0.18 + Math.random() * 0.10);
    pool.push({ ox: 0, oy, waypoints: [[mx1, oy], [mx1, my1], [mx2, my1]] });
  }
  // 右边 10 条：先水平左移 → 再竖直 → 再水平
  for (let i = 0; i < 10; i++) {
    const oy = h * (0.04 + i * 0.092);
    const mx1 = w * (0.84 + Math.random() * 0.08);
    const my1 = oy + (Math.random() > 0.5 ? 1 : -1) * h * (0.04 + Math.random() * 0.08);
    const mx2 = w * (0.68 + Math.random() * 0.10);
    pool.push({ ox: w, oy, waypoints: [[mx1, oy], [mx1, my1], [mx2, my1]] });
  }
  // 上边 10 条：先竖直下移 → 再水平 → 再竖直
  for (let i = 0; i < 10; i++) {
    const ox = w * (0.04 + i * 0.092);
    const my1 = h * (0.06 + Math.random() * 0.06);
    const mx1 = ox + (Math.random() > 0.5 ? 1 : -1) * w * (0.03 + Math.random() * 0.06);
    const my2 = h * (0.14 + Math.random() * 0.10);
    pool.push({ ox, oy: 0, waypoints: [[ox, my1], [mx1, my1], [mx1, my2]] });
  }
  // 下边 10 条：先竖直上移 → 再水平 → 再竖直
  for (let i = 0; i < 10; i++) {
    const ox = w * (0.04 + i * 0.092);
    const my1 = h * (0.88 + Math.random() * 0.06);
    const mx1 = ox + (Math.random() > 0.5 ? 1 : -1) * w * (0.03 + Math.random() * 0.06);
    const my2 = h * (0.70 + Math.random() * 0.10);
    pool.push({ ox, oy: h, waypoints: [[ox, my1], [mx1, my1], [mx1, my2]] });
  }

  return pool.map(({ ox, oy, waypoints }) => {
    const pts: [number, number][] = [[ox, oy], ...waypoints];
    const plen = trackLen(pts);
    return {
      points: pts,
      travelTime: 800 + (plen / 500) * 700 + Math.random() * 500,
    };
  });
}

function pickTrack(pool: TrackDef[], active: ActiveTrack[], usedHistory: number[], round: number): number {
  const activeSet = new Set(active.map(a => a.defIdx));
  // 可用 = 非活跃 + 冷却已过
  const available = pool
    .map((_, i) => i)
    .filter(i => !activeSet.has(i) && (round - (usedHistory[i] ?? 0)) >= COOLDOWN);

  if (available.length === 0) {
    // 全部在冷却中，选冷却最久的
    return pool
      .map((_, i) => i)
      .filter(i => !activeSet.has(i))
      .sort((a, b) => (usedHistory[a] ?? 0) - (usedHistory[b] ?? 0))[0] ?? 0;
  }
  return available[Math.floor(Math.random() * available.length)];
}

interface EnergyFlowProps {
  canvasW: number;
  canvasH: number;
}

export function EnergyFlow({ canvasW, canvasH }: EnergyFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poolRef = useRef<TrackDef[]>([]);
  const activeRef = useRef<ActiveTrack[]>([]);
  const usedHistoryRef = useRef<number[]>([]);
  const roundRef = useRef(0);

  useEffect(() => {
    poolRef.current = buildTrackPool(canvasW, canvasH);
  }, [canvasW, canvasH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let running = true;
    let lastTime = 0;

    // 初始化 20 条活跃线
    const pool = poolRef.current;
    const used: number[] = [];
    const actives: ActiveTrack[] = [];
    for (let i = 0; i < ACTIVE_COUNT && i < pool.length; i++) {
      actives.push({
        defIdx: i,
        phase: Math.random() * 0.4, // 初始相位错开
        travelTime: pool[i].travelTime,
        alpha: 0,
      });
      used[i] = 0;
    }
    activeRef.current = actives;
    usedHistoryRef.current = used;
    roundRef.current = 0;

    function tick(now: number) {
      if (!running) return;
      if (!lastTime) lastTime = now;
      const delta = Math.min(now - lastTime, 50);
      lastTime = now;

      ctx!.clearRect(0, 0, canvasW, canvasH);

      const toReplace: number[] = [];
      const fadeZone = 0.30;
      const maxAlpha = 0.55;
      const p = pool;

      for (let ai = 0; ai < activeRef.current.length; ai++) {
        const a = activeRef.current[ai];
        const def = p[a.defIdx];

        // phase 驱动 alpha：淡入 → 全亮 → 淡出
        if (a.phase < fadeZone) {
          a.alpha = (a.phase / fadeZone) * maxAlpha;
        } else if (a.phase > 1 - fadeZone) {
          a.alpha = ((1 - a.phase) / fadeZone) * maxAlpha;
        } else {
          a.alpha = maxAlpha;
        }

        if (a.alpha > 0.003) {
          const tailLen = 0.45 + a.alpha * 0.25;
          ctx!.shadowBlur = 8;
          ctx!.shadowColor = `rgba(0,212,255,${(a.alpha * 0.35).toFixed(3)})`;
          drawRibbon(ctx!, def.points, a.phase, tailLen, a.alpha);
          ctx!.shadowBlur = 0;
        }

        // 推进
        a.phase += delta / a.travelTime;

        // 完成 → 标记替换
        if (a.phase >= 1.0) {
          toReplace.push(ai);
        }
      }

      // 替换完成的线
      if (toReplace.length > 0) {
        roundRef.current++;
        for (const ai of toReplace) {
          const old = activeRef.current[ai];
          const newIdx = pickTrack(p, activeRef.current, usedHistoryRef.current, roundRef.current);
          usedHistoryRef.current[old.defIdx] = roundRef.current;
          activeRef.current[ai] = {
            defIdx: newIdx,
            phase: 0,
            travelTime: p[newIdx].travelTime,
            alpha: 0,
          };
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
