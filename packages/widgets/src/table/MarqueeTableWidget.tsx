import { useEffect, useRef, useState } from 'react';

interface MarqueeTableWidgetProps {
  /** 表头 */
  headers?: string[];
  /** 行数据（每行一个数组） */
  rows?: (string | number)[][];
  /** 滚动速度 (px/s) */
  speed?: number;
  /** 滚动方向（单向，默认向上） */
  direction?: 'up' | 'down';
  /** 悬停暂停 */
  pauseOnHover?: boolean;
  /** 表头文字颜色 */
  headerColor?: string;
}

const DEFAULT_HEADERS = ['排名', '地区', '销售额', '同比'];
const DEFAULT_ROWS: (string | number)[][] = [
  ['1', '华东', 320, '+12.4%'],
  ['2', '华南', 260, '+8.2%'],
  ['3', '华北', 240, '+15.7%'],
  ['4', '西南', 190, '-3.5%'],
  ['5', '华中', 170, '+5.1%'],
];

// 内容复制份数：5 份足够覆盖任意视口高度（一份滚出视口前下一份已接上）
const COPIES = 5;

/**
 * MarqueeTableWidget — 环形滚动表格（走马灯）。
 * 表头固定，行数据复制 COPIES 份拼接成无缝长带，rAF 逐帧平滑单向滚动。
 * 位移取模回绕：滚过一份高度后减去一份高度（拼接处内容相同，回绕无感），
 * 5 行数据永远 1234512345… 连续播放，无停顿、无跳变、无空缺。
 * 纯 CSS transform 驱动，不参与 React reconciliation，拖拽/显隐切换无副作用。
 */
export function MarqueeTableWidget({
  headers,
  rows,
  speed = 28,
  direction = 'up',
  pauseOnHover = true,
  headerColor = '#00D4FF',
}: MarqueeTableWidgetProps) {
  const hs = headers?.length ? headers : DEFAULT_HEADERS;
  const rs = rows?.length ? rows : DEFAULT_ROWS;
  const cols = Math.max(hs.length, ...rs.map((r) => r.length));
  const colWidths = Array.from({ length: cols }, () => '1fr').join(' ');

  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // 一份内容高度（全部行高之和），用于取模回绕
  const [cycleH, setCycleH] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const scroller = scrollerRef.current;
    if (!viewport || !scroller) return;
    const oneCycle = scroller.scrollHeight / COPIES;
    if (!oneCycle || oneCycle <= 0) return;
    setCycleH(oneCycle);

    let offset = 0;
    let raf = 0;
    let last = performance.now();
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.1);  // 切后台回来避免跳变
      last = now;
      offset += speed * dt;
      offset = offset % oneCycle;  // ★ 取模回绕：拼接处内容相同，肉眼无感
      // up：内容上移，新行从底部冒出；down：内容下移，从 -oneCycle 起反向走
      scroller.style.transform = direction === 'up'
        ? `translateY(${-offset}px)`
        : `translateY(${offset - oneCycle}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onEnter = () => {
      if (!pauseOnHover) return;
      running = false;
      cancelAnimationFrame(raf);
    };
    const onLeave = () => {
      if (!pauseOnHover) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    viewport.addEventListener('mouseenter', onEnter);
    viewport.addEventListener('mouseleave', onLeave);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      viewport.removeEventListener('mouseenter', onEnter);
      viewport.removeEventListener('mouseleave', onLeave);
    };
  }, [speed, direction, pauseOnHover, rs.length, hs.length]);

  // 行的完整序列：5 份连续拼接（第 5 行后紧接第 1 行）
  // 斑马纹按份内行号 i 决定（所有份一致），保证拼接处颜色连续
  const cycleRows = Array.from({ length: COPIES }, (_, k) =>
    rs.map((row, i) => ({ key: `${k}-${i}`, i, row }))
  ).flat();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* ═══ 表头（固定不滚动） ═══ */}
      <div
        className="grid shrink-0 items-center px-2"
        style={{
          gridTemplateColumns: colWidths,
          height: 26,
          backgroundColor: 'rgba(0,212,255,0.08)',
          borderBottom: '1px solid rgba(0,212,255,0.25)',
        }}
      >
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="text-[10px] font-semibold truncate" style={{ color: headerColor }}>
            {hs[i] ?? ''}
          </div>
        ))}
      </div>

      {/* ═══ 滚动视口 ═══ */}
      <div ref={viewportRef} className="flex-1 min-h-0 relative overflow-hidden">
        <div ref={scrollerRef} className="absolute left-0 right-0 top-0 will-change-transform">
          {cycleRows.map(({ key, i, row }) => (
            <div
              key={key}
              className="grid items-center px-2"
              style={{
                gridTemplateColumns: colWidths,
                height: 26,
                backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.055)',
              }}
            >
              {Array.from({ length: cols }, (_, c) => (
                <div key={c} className="text-[10px] truncate text-textSecondary" style={{ color: '#E8E8EC' }}>
                  {row[c] ?? ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
