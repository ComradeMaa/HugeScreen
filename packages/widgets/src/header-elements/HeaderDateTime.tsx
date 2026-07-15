import { useEffect, useState } from 'react';

interface HeaderDateTimeProps {
  showSeconds?: boolean;
}

/**
 * 顶栏日期时间 — 日期 + 实时时钟 + HUD 科技感装饰
 */
export function HeaderDateTime({ showSeconds = true }: HeaderDateTimeProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const timeStr = time.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false,
  });

  return (
    <div className="flex items-center justify-end h-full px-3 gap-3">
      {/* 日期 */}
      <div className="text-right">
        <div className="text-[11px] text-textSecondary/60 font-mono tracking-wide leading-tight">
          {dateStr}
        </div>
        <div className="text-lg font-semibold text-white font-mono tracking-wider tabular-nums leading-tight">
          {timeStr}
        </div>
      </div>

      {/* HUD 装饰 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* 渐变线 */}
        <div className="w-6 h-px bg-gradient-to-r from-accent-cool/40 to-transparent" />
        {/* 小菱形 */}
        <div className="relative w-2.5 h-2.5">
          <div className="absolute inset-0 border border-accent-cool/40 rotate-45" />
          <div className="absolute inset-[3px] bg-accent-cool/25 rotate-45" />
        </div>
        {/* 脉冲菱形 */}
        <div className="relative w-2 h-2">
          <div className="absolute inset-0 bg-accent-cool/50 rotate-45 animate-pulse" />
        </div>
        {/* 装饰线 */}
        <div className="w-4 h-px bg-gradient-to-l from-accent-cool/30 to-transparent" />
        {/* 刻度标记 */}
        <div className="flex gap-px">
          <div className="w-0.5 h-3 bg-accent-cool/20 rounded-sm" />
          <div className="w-0.5 h-4 bg-accent-cool/35 rounded-sm" />
          <div className="w-0.5 h-2.5 bg-accent-cool/20 rounded-sm" />
        </div>
      </div>
    </div>
  );
}
