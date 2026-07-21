import { useMemo } from 'react';

interface TextWidgetProps {
  text?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
}

export function TextWidget({
  text = '输入文字',
  fontSize = '16px',
  fontWeight = '400',
  fontStyle = 'normal',
  color = '#E8E8EC',
  textAlign = 'center',
}: TextWidgetProps) {
  const chars = useMemo(() => [...text], [text]);
  const perCharMs = 8;

  return (
    <div className="w-full h-full flex items-center justify-center p-3 overflow-hidden select-none"
      style={{ fontSize, fontWeight: fontWeight as any, fontStyle: fontStyle as any, color, textAlign: textAlign as any, wordBreak: 'break-word' }}>
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
