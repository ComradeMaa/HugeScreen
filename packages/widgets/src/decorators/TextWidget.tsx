import { useMemo } from 'react';

interface TextWidgetProps {
  text?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
  /** 紧凑模式（手机等窄屏），自动缩小字号 */
  compact?: boolean;
}

function scaleFont(fontSize: string, compact: boolean): string {
  if (!compact) return fontSize;
  const n = parseFloat(fontSize);
  if (isNaN(n) || n <= 0) return fontSize;
  const unit = fontSize.replace(/[\d.]+/, '') || 'px';
  // 紧凑模式缩至 50%
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
  const chars = useMemo(() => [...text], [text]);
  const perCharMs = 8;
  const scaledFontSize = scaleFont(fontSize, compact);

  return (
    <div className="w-full h-full flex items-center justify-center p-3 overflow-hidden select-none"
      style={{ fontSize: scaledFontSize, fontWeight: fontWeight as any, fontStyle: fontStyle as any, color, textAlign: textAlign as any, wordBreak: 'break-word' }}>
      <span>
        {chars.map((ch, i) => (
          <span
            key={i}
            className="type-char"
            style={{
              animationDelay: `${i * perCharMs}ms`,
              // 空格需要保留宽度
              whiteSpace: ch === ' ' ? 'pre' : undefined,
            }}
          >
            {ch}
          </span>
        ))}
      </span>
      <style>{`
        .type-char {
          opacity: 0;
          animation: typeIn 0.01s linear forwards;
        }
        @keyframes typeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
