interface HeaderTitleProps {
  text?: string;
}

/**
 * 顶栏标题 — HUD 菱形装饰 + 标题文字
 */
export function HeaderTitle({ text = '数据监控中心' }: HeaderTitleProps) {
  return (
    <div className="flex items-center gap-2.5 h-full px-3">
      {/* HUD 菱形 */}
      <div className="relative w-2.5 h-2.5 flex-shrink-0">
        <div className="absolute inset-0 bg-accent-cool rotate-45 opacity-80" />
        <div className="absolute inset-[3px] bg-accent-cool rotate-45 opacity-25 animate-pulse" />
      </div>
      <span className="text-base font-semibold text-white tracking-wide truncate">
        {text}
      </span>
    </div>
  );
}
