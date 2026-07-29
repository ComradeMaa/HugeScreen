import { useState, useEffect, useRef } from 'react';

interface ImageWidgetProps {
  src?: string;
  /** 多图模式：图片 URL 数组 */
  images?: string[];
  /** 轮播间隔（秒），0 = 不轮播 */
  slideshowInterval?: number;
  fit?: 'contain' | 'cover' | 'fill';
  opacity?: number;
}

/**
 * 图片展示组件 — 支持单图 / 多图幻灯片，上传由属性面板控制
 * 切图动画：旧图从上往下消失（imgWipeOut）→ 新图从上往下刷新（imgReveal）
 * 两图叠加过渡，避免突兀空白
 */
export function ImageWidget({
  src,
  images,
  slideshowInterval = 0,
  fit = 'contain',
  opacity = 1,
}: ImageWidgetProps) {
  // 解析有效图片列表：多图优先，向后兼容旧数据 src
  const imageList: string[] = (images && images.length > 0) ? images : (src ? [src] : []);
  const isSlideshow = imageList.length > 1 && slideshowInterval > 0;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [enteringKey, setEnteringKey] = useState(0);
  const [leavingSrc, setLeavingSrc] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leavingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idxRef = useRef(currentIndex);
  idxRef.current = currentIndex;

  // 图片列表变化时重置
  useEffect(() => {
    setCurrentIndex(0);
    setLeavingSrc(null);
    setEnteringKey(k => k + 1);
  }, [imageList.length]);

  const switchToIndex = (nextIndex: number) => {
    if (imageList.length <= 1) return;
    const oldSrc = imageList[idxRef.current];
    // 启动旧图退场
    setLeavingSrc(oldSrc);
    // 退场动画结束后清除旧图 (0.35s，略长于 CSS 动画以避免闪烁)
    if (leavingTimerRef.current) clearTimeout(leavingTimerRef.current);
    leavingTimerRef.current = setTimeout(() => setLeavingSrc(null), 350);
    // 新图入场（延迟一点让退场先开始）
    setCurrentIndex(nextIndex);
    setEnteringKey(k => k + 1);
  };

  // 轮播逻辑
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!isSlideshow) return;
    timerRef.current = setInterval(() => {
      switchToIndex((idxRef.current + 1) % imageList.length);
    }, slideshowInterval * 1000);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (leavingTimerRef.current) { clearTimeout(leavingTimerRef.current); leavingTimerRef.current = null; }
    };
  }, [isSlideshow, slideshowInterval, imageList.length]);

  const currentSrc = imageList[currentIndex] || '';
  const hasAnimation = imageList.length > 0;

  return (
    <div className="w-full h-full relative overflow-hidden select-none"
      style={{ opacity }}>
      {currentSrc ? (
        <>
          <style>{`
            @keyframes imgReveal {
              0% { clip-path: inset(0 0 100% 0); }
              100% { clip-path: inset(0 0 0 0); }
            }
            @keyframes imgWipeOut {
              0% { clip-path: inset(0 0 0 0); }
              100% { clip-path: inset(100% 0 0 0); }
            }
          `}</style>
          {/* 旧图退场层 */}
          {leavingSrc && (
            <img
              key={`leave-${enteringKey}`}
              src={leavingSrc}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: fit,
                animation: 'imgWipeOut 0.3s ease-in-out forwards',
              }}
              draggable={false}
            />
          )}
          {/* 新图入场层 */}
          <img
            key={`enter-${enteringKey}`}
            src={currentSrc}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: fit,
              animation: hasAnimation ? 'imgReveal 0.3s ease-in-out both' : undefined,
            }}
            draggable={false}
          />
          {/* 幻灯片指示器 */}
          {imageList.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {imageList.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-accent-cool' : 'bg-white/25'
                }`} />
              ))}
            </div>
          )}
        </>
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
