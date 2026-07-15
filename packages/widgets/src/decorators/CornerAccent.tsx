/**
 * HUD 角标装饰
 * 在组件四角绘制 L 形线条，模拟驾驶舱 HUD 风格。
 * 仅在展示态显示。
 */
export function CornerAccent({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;

  const cornerStyle = (pos: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 12,
      height: 12,
      borderColor: 'rgba(126,184,218,0.15)',
      borderStyle: 'solid',
      borderWidth: 0,
      pointerEvents: 'none',
    };
    switch (pos) {
      case 'tl': return { ...base, top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 };
      case 'tr': return { ...base, top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 };
      case 'bl': return { ...base, bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 };
      case 'br': return { ...base, bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 };
    }
  };

  return (
    <>
      <div style={cornerStyle('tl')} />
      <div style={cornerStyle('tr')} />
      <div style={cornerStyle('bl')} />
      <div style={cornerStyle('br')} />
    </>
  );
}
