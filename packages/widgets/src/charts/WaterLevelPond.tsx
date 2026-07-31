import { useRef, useEffect, useCallback, useState } from 'react';

interface WaterLevelPondProps {
  /** 水位百分比 0-100 */
  value?: number;
  /** 形状 */
  shape?: 'rect' | 'roundRect' | 'round';
  /** 波浪层数 */
  waveNum?: number;
  /** 波浪高度(px) */
  waveHeight?: number;
  /** 波浪透明度 */
  waveOpacity?: number;
  /** 渐变色 [顶部色, 底部色] */
  colors?: string[];
  /** 标题 */
  title?: string;
  /** 标题颜色 */
  titleColor?: string;
  /** 标题字号 */
  titleFontSize?: number;
  /** 单位后缀 */
  suffix?: string;
}

export function WaterLevelPond({
  value = 0,
  shape = 'round',
  waveNum = 3,
  waveHeight = 40,
  waveOpacity = 0.4,
  colors = ['#3DE7C9', '#00BAFF'],
  title = '',
  titleColor = '#E8E8EC',
  titleFontSize = 14,
  suffix = '%',
}: WaterLevelPondProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const offsetRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const v = Math.max(0, Math.min(100, value ?? 0));
  const displayText = `${Math.round(v)}${suffix}`;
  const borderRadius = shape === 'round' ? '50%' : shape === 'roundRect' ? '10px' : '0';
  const c1 = colors[0] || '#3DE7C9', c2 = colors[1] || '#00BAFF';

  /** 同步 canvas 实际像素尺寸 */
  const syncSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      forceUpdate(n => n + 1);
    }
  }, []);

  useEffect(() => {
    syncSize();
    const ro = new ResizeObserver(syncSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [syncSize]);

  /** 绘制一帧 */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 外圈描边 (SVG overlay 替代)
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) / 2 - 4;

    // 裁剪区域 — 根据形状分支
    const clipPath = new Path2D();
    if (shape === 'roundRect') {
      const rr2 = Math.min(W, H) * 0.1;
      clipPath.moveTo(rr2, 0);
      clipPath.lineTo(W - rr2, 0);
      clipPath.quadraticCurveTo(W, 0, W, rr2);
      clipPath.lineTo(W, H - rr2);
      clipPath.quadraticCurveTo(W, H, W - rr2, H);
      clipPath.lineTo(rr2, H);
      clipPath.quadraticCurveTo(0, H, 0, H - rr2);
      clipPath.lineTo(0, rr2);
      clipPath.quadraticCurveTo(0, 0, rr2, 0);
      clipPath.closePath();
    } else if (shape === 'rect') {
      clipPath.rect(0, 0, W, H);
    } else {
      clipPath.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.save();
    ctx.clip(clipPath);

    // 水位高度 — 圆用圆心/半径; 矩形用全高
    const level = v / 100;
    const isRound = shape === 'round';
    const topY = isRound ? cy - r : 0;
    const botY = isRound ? cy + r : H;
    const waterY = isRound
      ? cy + r * (1 - level * 2)
      : H - level * H;
    const leftX = isRound ? cx - r : 0;
    const rightX = isRound ? cx + r : W;

    // 渐变
    const gradient = ctx.createLinearGradient(0, topY, 0, botY);
    gradient.addColorStop(0, c1);
    gradient.addColorStop(1, c2);

    // 绘制波浪层
    const spanW = rightX - leftX;
    for (let wi = 0; wi < waveNum; wi++) {
      const phase = offsetRef.current * (1 + wi * 0.3);
      const alpha = waveOpacity * (1 - wi * 0.25);
      ctx.globalAlpha = Math.max(0.05, alpha);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(leftX - 10, botY + 10);
      const segs = 60;
      for (let i = 0; i <= segs; i++) {
        const x = leftX + (i / segs) * spanW;
        const y = waterY + Math.sin((i / segs) * Math.PI * 2 * waveNum + phase) * waveHeight
          + Math.sin((i / segs) * Math.PI * 4 + phase * 1.5) * waveHeight * 0.3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(rightX + 10, botY + 10);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    // 外圈描边
    if (shape === 'round') {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else {
      ctx.stroke(clipPath);
    }
    ctx.strokeStyle = c1;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [v, shape, waveNum, waveHeight, waveOpacity, c1, c2]);

  /** 动画循环 */
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      offsetRef.current += 0.015;
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* 标题 */}
      {title && (
        <div className="text-center truncate px-1 pb-1 flex-shrink-0 font-semibold" style={{ color: titleColor, fontSize: titleFontSize, lineHeight: 1.2, fontFamily: 'Inter, PingFang SC, sans-serif' }}>
          {title}
        </div>
      )}
      {/* 球体 */}
      <div ref={containerRef} className="flex-1 relative" style={{ borderRadius, overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {/* 中心文字 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xl font-bold select-none" style={{
            background: `linear-gradient(to bottom, ${c1}, ${c2})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {displayText}
          </span>
        </div>
      </div>
    </div>
  );
}
