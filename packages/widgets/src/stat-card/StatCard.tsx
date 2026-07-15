import { useEffect, useRef, useState } from 'react';

interface StatCardProps {
  title?: string;
  value?: number | string;
  prefix?: string;
  suffix?: string;
  trend?: number;       // 正数上涨，负数下跌
  trendLabel?: string;  // 如 "vs 昨日"
  format?: 'number' | 'currency' | 'percent';
  decimals?: number;
  /** 是否播放数字滚动动画 */
  animated?: boolean;
}

/**
 * 数字统计卡
 * 大数字 + 标题 + 趋势指示
 */
export function StatCard({
  title = '指标',
  value = 0,
  prefix = '',
  suffix = '',
  trend,
  trendLabel,
  format = 'number',
  decimals = 0,
  animated = true,
}: StatCardProps) {
  const displayValue = formatValue(value, format, decimals);
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
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      // ease-out 缓动
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(start + (target - start) * eased);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]);

  const trendUp = trend !== undefined ? trend >= 0 : undefined;
  const formattedValue = formatValue(animated ? animatedValue : value, format, decimals);

  return (
    <div className="flex flex-col justify-center h-full p-4 select-none">
      {/* 标题 */}
      {title && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-0.5 h-3 rounded-full bg-accent-cool flex-shrink-0" />
          <span className="text-xs text-textSecondary truncate">{title}</span>
        </div>
      )}

      {/* 数值 */}
      <div className="flex items-baseline gap-1 flex-1 min-h-[2rem] items-center">
        {prefix && (
          <span className="text-sm text-textSecondary/60 font-mono">{prefix}</span>
        )}
        <span className="text-2xl sm:text-3xl font-semibold text-white font-mono tracking-tight tabular-nums">
          {formattedValue}
        </span>
        {suffix && (
          <span className="text-sm text-textSecondary/60 font-mono ml-0.5">{suffix}</span>
        )}
      </div>

      {/* 趋势 */}
      {trend !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className={`text-xs font-medium font-mono ${
              trendUp ? 'text-positive' : 'text-negative'
            }`}
          >
            {trendUp ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && (
            <span className="text-[11px] text-textSecondary/50">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
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
    default: {
      if (num >= 10000) {
        const wan = num / 10000;
        return wan.toFixed(1) + '万';
      }
      return num.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
  }
}
