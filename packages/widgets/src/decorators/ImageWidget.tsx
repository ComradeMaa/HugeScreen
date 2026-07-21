interface ImageWidgetProps {
  src?: string;
  fit?: 'contain' | 'cover' | 'fill';
  opacity?: number;
}

/**
 * 图片展示组件 — 纯展示，上传由属性面板控制
 */
export function ImageWidget({
  src,
  fit = 'contain',
  opacity = 1,
}: ImageWidgetProps) {
  return (
    <div className="w-full h-full relative overflow-hidden select-none"
      style={{ opacity }}>
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full"
          style={{ objectFit: fit }}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2
          border-2 border-dashed border-[rgba(0,212,255,0.15)] rounded-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21,15 16,10 5,21" />
          </svg>
          <span className="text-[11px] text-textSecondary/30">未选择图片</span>
        </div>
      )}
    </div>
  );
}
