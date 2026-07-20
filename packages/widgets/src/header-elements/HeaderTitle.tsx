import { useState, useEffect } from 'react';

interface HeaderTitleProps {
  text?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
  borderStyle?: string;
}

const BORDER_ENTRY_MS = 1700; // 边框入场动画总时长

/**
 * 顶栏标题 — HUD 菱形装饰 + 标题文字
 * 当启用边框时，文字延迟至边框动画完成后才渲染。
 */
export function HeaderTitle({
  text = '数据监控中心',
  fontSize = '16px',
  fontWeight = '600',
  fontStyle = 'normal',
  color = '#ffffff',
  textAlign = 'left',
  borderStyle,
}: HeaderTitleProps) {
  const hasBorder = !!borderStyle && borderStyle !== 'none';
  const [showText, setShowText] = useState(!hasBorder);

  useEffect(() => {
    if (!hasBorder) {
      setShowText(true);
      return;
    }
    setShowText(false);
    const timer = setTimeout(() => setShowText(true), BORDER_ENTRY_MS);
    return () => clearTimeout(timer);
  }, [hasBorder]);

  return (
    <div className="flex items-center gap-2.5 h-full px-3" style={{ justifyContent: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start' }}>
      {/* HUD 菱形 */}
      <div className="relative w-2.5 h-2.5 flex-shrink-0">
        <div className="absolute inset-0 bg-accent-cool rotate-45 opacity-80" />
        <div className="absolute inset-[3px] bg-accent-cool rotate-45 opacity-25 animate-pulse" />
      </div>
      <span
        className="tracking-wide truncate transition-opacity duration-300"
        style={{
          fontSize,
          fontWeight,
          fontStyle,
          color,
          opacity: showText ? 1 : 0,
        }}
      >
        {text}
      </span>
    </div>
  );
}
