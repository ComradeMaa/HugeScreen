interface HeaderTitleProps {
  text?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
}

/**
 * 顶栏标题 — HUD 菱形装饰 + 标题文字
 * 支持字号、字重、斜体、颜色、对齐等文字样式属性
 */
export function HeaderTitle({
  text = '数据监控中心',
  fontSize = '16px',
  fontWeight = '600',
  fontStyle = 'normal',
  color = '#ffffff',
  textAlign = 'left',
}: HeaderTitleProps) {
  return (
    <div className="flex items-center gap-2.5 h-full px-3" style={{ justifyContent: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
      {/* HUD 菱形 */}
      <div className="relative w-2.5 h-2.5 flex-shrink-0">
        <div className="absolute inset-0 bg-accent-cool rotate-45 opacity-80" />
        <div className="absolute inset-[3px] bg-accent-cool rotate-45 opacity-25 animate-pulse" />
      </div>
      <span
        className="tracking-wide truncate"
        style={{
          fontSize,
          fontWeight,
          fontStyle,
          color,
        }}
      >
        {text}
      </span>
    </div>
  );
}
