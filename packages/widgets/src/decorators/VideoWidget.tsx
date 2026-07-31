import { useRef, useEffect } from 'react';

interface VideoItem {
  url: string;
  pinned?: boolean;
}

interface VideoWidgetProps {
  videos?: (string | VideoItem)[];
  fit?: 'contain' | 'cover' | 'fill';
  muted?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
}

function toVideoItem(v: string | VideoItem): VideoItem {
  return typeof v === 'string' ? { url: v } : v;
}

/** 2×2 网格布局 → 填充规则：0-1=视频, 2-4=按序填, 空位="暂无画面" */
function fillGrid(items: VideoItem[]): (VideoItem | null)[] {
  const grid: (VideoItem | null)[] = [null, null, null, null];
  const valid = items.filter(v => v && v.url);
  if (valid.length === 1) {
    grid[0] = valid[0];
  } else {
    for (let i = 0; i < Math.min(valid.length, 4); i++) {
      grid[i] = valid[i];
    }
  }
  return grid;
}

export function VideoWidget({
  videos,
  fit = 'contain',
  muted = true,
  autoplay = true,
  loop = true,
  controls = false,
}: VideoWidgetProps) {
  const items: VideoItem[] = (videos || []).map(toVideoItem);
  const grid = fillGrid(items);
  const hasAny = grid.some(v => v !== null);
  const single = items.length === 1 && items[0]?.url;

  if (!hasAny) {
    return (
      <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-lg">
        <div className="text-center text-[#9E9EA8]/50">
          <svg className="mx-auto mb-1" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span className="text-xs">暂无画面</span>
        </div>
      </div>
    );
  }

  // Single video → full area
  if (single) {
    return (
      <div className="w-full h-full">
        <video
          src={items[0].url}
          className="w-full h-full"
          style={{ objectFit: fit }}
          muted={muted}
          autoPlay={autoplay}
          loop={loop}
          controls={controls}
          playsInline
        />
      </div>
    );
  }

  // 2-4 videos → 2×2 grid
  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1">
      {grid.map((vid, i) => {
        if (!vid) {
          return (
            <div
              key={i}
              className="flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.08)] rounded"
            >
              <span className="text-[#9E9EA8]/40 text-xs">暂无画面</span>
            </div>
          );
        }
        return (
          <div key={i} className="relative overflow-hidden rounded">
            <video
              src={vid.url}
              className="w-full h-full"
              style={{ objectFit: fit }}
              muted={muted}
              autoPlay={autoplay}
              loop={loop}
              controls={controls}
              playsInline
            />
            {vid.pinned && (
              <div className="absolute top-1 right-1 w-4 h-4 text-[#FF8C42] opacity-80 pointer-events-none">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v4h1.6v-4H18v-2l-2-2z" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
