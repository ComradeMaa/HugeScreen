import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';

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
  const measureRef = useRef<HTMLDivElement>(null);  // 单份文本测量层
  const [overflow, setOverflow] = useState(false);
  const [scrollDur, setScrollDur] = useState(10);
  const [animKey, setAnimKey] = useState(0);

  // 跑马灯期间数据更新：延迟到本轮滚动结束后再切换
  const [displayText, setDisplayText] = useState(text);
  const pendingRef = useRef<string | null>(null);
  const overflowRef = useRef(false);
  overflowRef.current = overflow;

  // 文本变化：先用隐藏测量层快测新文本是否溢出，再决定立即切换还是暂存等动画边界
  useEffect(() => {
    if (text === displayText) return;

    // 用 measureRef 的 DOM 做一次快测（不经过 React 渲染）
    let wouldOverflow = false;
    const measureEl = measureRef.current;
    const containerEl = containerRef.current;
    if (measureEl?.firstChild && containerEl && overflowRef.current) {
      const inner = measureEl.firstChild as HTMLElement;
      inner.textContent = text;
      wouldOverflow = measureEl.scrollHeight > containerEl.clientHeight + 2;
      inner.textContent = displayText; // 恢复
    }

    if (overflowRef.current && wouldOverflow) {
      // 新旧文本都会溢出 → 暂存，等本轮动画结束再切换
      pendingRef.current = text;
    } else {
      // 新文本不溢出（或之前没在跑马灯）→ 直接切换
      setDisplayText(text);
      setAnimKey(k => k + 1);
    }
  }, [text]);

  // 跑马灯每完成一轮，检查是否有待切换的数据
  const handleAnimationIteration = () => {
    if (pendingRef.current !== null) {
      setDisplayText(pendingRef.current);
      pendingRef.current = null;
      setAnimKey(k => k + 1);
    }
  };

  // 溢出检测：用隐藏的单份文本测量层（避开跑马灯双份副本干扰）
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const check = () => {
      const containerH = container.clientHeight;
      const singleH = measure.scrollHeight;
      if (singleH > containerH + 2) {
        setOverflow(true);
        setScrollDur(Math.max(6, Math.round(singleH / 25)));
      } else {
        setOverflow(false);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, [displayText, scaledFontSize]);

  const commonStyle: React.CSSProperties = {
    fontSize: scaledFontSize,
    fontWeight: fontWeight as any,
    fontStyle: fontStyle as any,
    color,
    textAlign: textAlign as any,
  };

  const perCharMs = 3;
  const chars = useMemo(() => [...displayText], [displayText]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden select-none"
      style={commonStyle}
    >
      {/* 隐藏的单份文本测量层 — 仅用于溢出检测 */}
      <div
        ref={measureRef}
        aria-hidden
        className="absolute invisible pointer-events-none w-full px-3"
        style={{ left: 0, top: 0, ...commonStyle }}
      >
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayText}</div>
      </div>

      {overflow ? (
        <div
          key={animKey}
          className="w-full px-3"
          onAnimationIteration={handleAnimationIteration}
          style={{
            animation: `textScroll ${scrollDur}s linear infinite`,
            willChange: 'transform',
          }}
        >
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingBottom: '5em' }}>{displayText}</div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingBottom: '5em' }}>{displayText}</div>
        </div>
      ) : (
        <div key={animKey} className="w-full h-full px-3 flex items-center justify-center" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {chars.map((ch, i) => (
              <span
                key={i}
                className="type-char"
                style={{
                  animationDelay: `${i * perCharMs}ms`,
                  whiteSpace: ch === ' ' ? 'pre' : undefined,
                }}
              >
                {ch}
              </span>
            ))}
          </span>
        </div>
      )}

      <style>{`
        @keyframes textScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .type-char {
          opacity: 0;
          animation: typeIn 0.15s ease-out forwards;
        }
        @keyframes typeIn {
          0%   { opacity: 0; transform: translateY(0.3em); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
