import { useEffect, useState } from 'react';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
}

/**
 * 顶部标题栏组件
 * 左侧标题 + 右侧实时时钟
 */
export function ScreenHeader({ title = '数据监控中心', subtitle }: ScreenHeaderProps) {
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
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="flex items-center justify-between h-full px-6">
      {/* 左侧：标题 */}
      <div className="flex items-center gap-3">
        {/* HUD 菱形装饰 */}
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 bg-accent-cool rotate-45 opacity-80" />
          <div className="absolute inset-1 bg-accent-cool rotate-45 opacity-30 animate-pulse" />
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold text-white tracking-wide">{title}</h1>
          {subtitle && (
            <span className="text-xs text-textSecondary/60">{subtitle}</span>
          )}
        </div>
        {/* HUD 装饰线 */}
        <div className="flex items-center gap-1 ml-2 opacity-30">
          <div className="w-8 h-px bg-gradient-to-r from-accent-cool to-transparent" />
          <div className="w-1 h-1 bg-accent-cool rotate-45" />
        </div>
      </div>

      {/* 右侧：时间 */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-[11px] text-textSecondary/60 font-mono tracking-wide">{dateStr}</div>
          <div className="text-xl font-semibold text-white font-mono tracking-wider tabular-nums">
            {timeStr}
          </div>
        </div>
        {/* HUD 菱形装饰 */}
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 border border-accent-cool/40 rotate-45" />
          <div className="absolute inset-1.5 bg-accent-cool/20 rotate-45" />
        </div>
      </div>
    </div>
  );
}
