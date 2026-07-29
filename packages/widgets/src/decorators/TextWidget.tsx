import { useRef, useState, useEffect, useLayoutEffect } from 'react';

interface TextWidgetProps {
  text?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
  compact?: boolean;
}

function scaleFont(fontSize: string, compact: boolean): string {
  if (!compact) return fontSize;
  const n = parseFloat(fontSize);
  if (isNaN(n) || n <= 0) return fontSize;
  const unit = fontSize.replace(/[\d.]+/, '') || 'px';
  return `${Math.round(n * 0.5)}${unit}`;
}

export function TextWidget({
  text = '输入文字',
  fontSize = '16px',
  fontWeight = '400',
  fontStyle = 'normal',
  color = '#E8E8EC',
  textAlign = 'center',
  compact = false,
}: TextWidgetProps) {
  const scaledFontSize = scaleFont(fontSize, compact);
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [scrollDur, setScrollDur] = useState(10);

  const commonStyle: React.CSSProperties = {
    fontSize: scaledFontSize,
    fontWeight: fontWeight as any,
    fontStyle: fontStyle as any,
    color,
    textAlign: textAlign as any,
  };

  // useLayoutEffect 在绘制前同步测量，避免闪烁
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      // 用容器内的实际内容高度与容器可视高度比较
      const containerH = el.clientHeight;
      const contentH = el.scrollHeight;
      if (contentH > containerH + 2) {
        setOverflow(true);
        setScrollDur(Math.max(6, Math.round(contentH / 25)));
      } else {
        setOverflow(false);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, scaledFontSize]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden select-none"
      style={commonStyle}
    >
      {overflow ? (
        <div
          className="w-full px-3"
          style={{
            animation: `textScroll ${scrollDur}s linear infinite`,
            willChange: 'transform',
          }}
        >
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingBottom: '5em' }}>{text}</div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingBottom: '5em' }}>{text}</div>
        </div>
      ) : (
        <div className="w-full h-full px-3 flex items-center justify-center" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text}
        </div>
      )}

      <style>{`
        @keyframes textScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}
