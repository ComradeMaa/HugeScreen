import { useEffect, useRef, useState } from 'react';
import { IconPresetRenderer } from './IconPresets';

interface StatCardProps {
  title?: string;
  value?: number | string;
  prefix?: string;
  suffix?: string;
  trend?: number;       // 正数上涨，负数下跌（手动模式 or API 传入）
  trendLabel?: string;  // 如 "vs 昨日"
  format?: 'number' | 'currency' | 'percent';
  /**
   * 小数位数 — 显式指定时优先；未指定（undefined）时自动探测数值本身的小数位
   * （输入/数据源 123.9 → 自动显示 1 位小数），方便数据源对接。
   */
  decimals?: number;
  /** 是否播放数字滚动动画 */
  animated?: boolean;
  /** 是否显示左侧占比环 */
  showRing?: boolean;
  /** 占比环百分比 0–100（与主数值相互独立） */
  ringPercent?: number;
  /** 占比环颜色 */
  ringColor?: string;
  /** 数据名（标题）颜色 */
  titleColor?: string;
  /** 数值颜色 */
  valueColor?: string;
  /** 单位颜色 */
  suffixColor?: string;
  /** 是否显示增长率/降低率 */
  showTrend?: boolean;
  /** 增长率模式：auto=根据 value 前后变化自动计算，manual=使用 trend 字段 */
  trendMode?: 'auto' | 'manual';
  /** 是否显示图标（与 showRing 互斥，同位置） */
  showIcon?: boolean;
  /** 自定义图标图片 URL（支持 PNG/JPG/SVG） */
  customIconImage?: string;
}

/**
 * 数字统计卡 — 单指标（数据名 + 数值 [+ 趋势]），可选左侧占比环。
 * 尺寸自适应：根容器设 container-type: size，文字用 cqh 单位随容器缩放，
 * 占比环用 SVG viewBox 天然缩放。塞进任意大小的格子都合身。
 */
export function StatCard({
  title = '指标',
  value = 0,
  prefix = '',
  suffix = '',
  trend,
  trendLabel,
  format = 'number',
  decimals,
  animated = true,
  showRing = false,
  ringPercent = 0,
  ringColor = '#00D4FF',
  titleColor = '#9E9EA8',
  valueColor = '#FFFFFF',
  suffixColor = '#9E9EA8',
  showTrend = false,
  trendMode = 'auto',
  showIcon = false,
  customIconImage,
}: StatCardProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const animRef = useRef<number>();

  useEffect(() => {
    if (!animated || typeof value !== 'number') {
      setAnimatedValue(typeof value === 'number' ? value : 0);
      return;
    }

    const target = value;
    const start = animatedValue;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1.0);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      setAnimatedValue(start + (target - start) * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 自动增长率计算 ───
  const prevValueRef = useRef<number | undefined>(undefined);
  const [autoTrend, setAutoTrend] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (trendMode !== 'auto' || typeof value !== 'number') return;
    const prev = prevValueRef.current;
    if (prev !== undefined && prev !== 0) {
      const change = ((value - prev) / Math.abs(prev)) * 100;
      setAutoTrend(change);
    }
    prevValueRef.current = value;
  }, [value, trendMode]);

  // 实际使用的 trend：手动模式用 trend prop，自动模式用 autoTrend
  const effectiveTrend = trendMode === 'manual' ? trend : autoTrend;

  const trendUp = effectiveTrend !== undefined ? effectiveTrend >= 0 : undefined;
  const effDecimals = decimals ?? detectDecimals(value);
  const formattedValue = formatValue(animated ? animatedValue : value, format, effDecimals);
  const pct = Math.max(0, Math.min(100, ringPercent));

  const textCol = (
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      {title && (
        <div className="flex items-center gap-1 mb-0.5">
          <div className="rounded-full bg-accent-cool flex-shrink-0" style={{ width: 2, height: '0.85em' }} />
          <span className="truncate" style={{ color: titleColor, fontSize: 'clamp(9px, 9cqh, 15px)' }}>{title}</span>
        </div>
      )}

      <div className="flex items-baseline gap-1 min-w-0">
        {prefix && (
          <span className="text-textSecondary/60 font-mono flex-shrink-0" style={{ fontSize: 'clamp(9px, 11cqh, 18px)' }}>{prefix}</span>
        )}
        <span
          className="font-semibold font-mono tracking-tight tabular-nums leading-none"
          style={{ fontSize: 'clamp(16px, min(24cqh, 13cqw), 48px)', color: valueColor }}
        >
          {formattedValue}
        </span>
        {suffix && (
          <span className="font-mono flex-shrink-0" style={{ fontSize: 'clamp(9px, 11cqh, 18px)', color: suffixColor }}>{suffix}</span>
        )}
      </div>

      {showTrend && effectiveTrend !== undefined && (
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className={`font-medium font-mono ${trendUp ? 'text-positive' : 'text-negative'}`}
            style={{ fontSize: 'clamp(9px, 9cqh, 14px)' }}
          >
            {trendUp ? '▲' : '▼'} {Math.abs(effectiveTrend).toFixed(1)}%
          </span>
          {trendLabel && (
            <span className="text-textSecondary/50" style={{ fontSize: 'clamp(8px, 8cqh, 12px)' }}>{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="w-full h-full flex items-center gap-1.5 px-1.5 select-none overflow-hidden"
      style={{ containerType: 'size' }}
    >
      {showIcon && customIconImage && (
        <div className="flex-shrink-0 h-[50%] aspect-square flex items-center justify-center" style={{ color: '#00D4FF' }}>
          {customIconImage.startsWith('supercons:') ? (
            <IconPresetRenderer name={customIconImage.slice(10)} size={48} />
          ) : (
            <img src={customIconImage} alt="" className="w-full h-full object-cover" draggable={false} />
          )}
        </div>
      )}
      {!showIcon && showRing && (
        <div className="flex-shrink-0 h-[68%] aspect-square">
          <ProgressRing percent={pct} color={ringColor} />
        </div>
      )}
      {textCol}
    </div>
  );
}

/** 占比环 — SVG viewBox 100×100，随容器缩放；进度弧从顶部起、带入场动画 */
function ProgressRing({ percent, color }: { percent: number; color: string }) {
  const [dashPct, setDashPct] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDashPct(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);

  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (dashPct / 100) * circ;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </g>
      <text
        x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fill="#E8E8EC" fontSize="26" fontWeight="600" fontFamily="JetBrains Mono, monospace"
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

/**
 * 未显式指定小数位时，从数值本身探测实际小数位数：
 * 123.9 → 1 位，3.14159 → 5 位；去尾零（123.90 视为 1 位），上限 6 位
 * （防浮点噪声如 0.30000000000000004 爆位数）。
 */
function detectDecimals(value: number | string | undefined): number {
  const s = typeof value === 'number' ? String(value) : String(value ?? '');
  const m = s.match(/\.(\d+)/);
  if (!m) return 0;
  const frac = m[1].replace(/0+$/, '');
  return Math.min(6, frac.length);
}

function formatValue(
  value: number | string,
  format: 'number' | 'currency' | 'percent',
  decimals: number,
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);

  switch (format) {
    case 'currency':
      return '¥' + num.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    case 'percent':
      return num.toFixed(decimals) + '%';
    case 'number':
    default:
      return num.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
}
