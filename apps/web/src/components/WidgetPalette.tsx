import { useState } from 'react';
import { widgetRegistry } from '@hugescreen/core';
import type { WidgetDefinition } from '@hugescreen/core';
import type { WidgetCategory } from '@hugescreen/shared';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { HeaderElementDefinition } from '@hugescreen/widgets';
import {
  TrendingUp,
  LineChart,
  BarChart3,
  BarChart4,
  PieChart,
  Type,
  Clock,
  Globe,
  Image,
  LayoutDashboard,
  Map,
  Video,
  Droplets,
  CandlestickChart,
  ChartScatter,
  ChartArea,
  ChartLine,
  Radar,
  Grid3x3,
  Network,
  GitBranch,
  Orbit,
  MoveHorizontal,
  Waypoints,
  Filter,
  Gauge,
  Search,
  Plus,
  Trash2,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  LineChart,
  BarChart3,
  BarChart4,
  BarChartHorizontal: BarChart4,
  PieChart,
  Type,
  Clock,
  Globe,
  Image,
  LayoutDashboard,
  Map,
  Video,
  Droplets,
  CandlestickChart,
  ChartScatter,
  ChartArea,
  ChartLine,
  Radar,
  Grid3x3,
  Network,
  GitBranch,
  Orbit,
  MoveHorizontal,
  Waypoints,
  Filter,
  Gauge,
};

function WidgetIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon size={18} strokeWidth={1.5} />;
  return <span className="text-sm font-bold opacity-40">{name.slice(0, 2)}</span>;
}

/** Canvas: 圆角矩形 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** 创建拖拽缩略图 — Canvas 绘制图形化组件样本 */
function createWidgetThumbnail(type: string, w: number, h: number): HTMLElement {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${w}px;height:${h}px;opacity:0.82`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // 背景
  ctx.fillStyle = 'rgba(44,44,52,0.92)';
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.fill();

  // 边框
  ctx.strokeStyle = 'rgba(0,212,255,0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 6);
  ctx.stroke();

  const c = '#00D4FF';
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.2;
  ctx.font = '10px "Inter","PingFang SC",sans-serif';
  ctx.textAlign = 'center';

  const cx = w / 2, cy = h / 2;

  if (type === 'stat-card') {
    ctx.font = '8px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.fillText('VISITORS', cx, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "JetBrains Mono",monospace';
    ctx.fillText('12.8k', cx, 42);
    ctx.fillStyle = '#34d399';
    ctx.font = '9px "Inter","PingFang SC",sans-serif';
    ctx.fillText('↑ 12.5%', cx, 58);

  } else if (type === 'line-chart') {
    const pts = [[16, 58], [34, 40], [52, 48], [70, 22], [88, 32]];
    ctx.strokeStyle = 'rgba(0,212,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    // Points
    ctx.fillStyle = '#00D4FF';
    pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); });
    // Area
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[4][0], h - 10); ctx.lineTo(pts[0][0], h - 10); ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

  } else if (type === 'bar-chart') {
    const baseY = 58, barW = 10, gap = 9, startX = 22;
    const heights = [38, 24, 44, 18];
    heights.forEach((bh, i) => {
      const bx = startX + i * (barW + gap);
      ctx.fillStyle = i === 2 ? 'rgba(0,212,255,0.85)' : 'rgba(0,212,255,0.55)';
      roundRect(ctx, bx, baseY - bh, barW, bh, 2);
      ctx.fill();
    });
    // 基线
    ctx.strokeStyle = 'rgba(0,212,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(14, baseY);
    ctx.lineTo(106, baseY);
    ctx.stroke();

  } else if (type === 'pie-chart') {
    const slices = [[0, 0.35], [0.35, 0.65], [0.65, 1]];
    const colors = ['rgba(0,212,255,0.75)', 'rgba(0,212,255,0.45)', 'rgba(0,212,255,0.2)'];
    slices.forEach(([start, end], i) => {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 22, start * Math.PI * 2 - Math.PI / 2, end * Math.PI * 2 - Math.PI / 2);
      ctx.closePath();
      ctx.fill();
    });
    // Donut hole
    ctx.fillStyle = 'rgba(44,44,52,0.92)';
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'funnel-chart') {
    // 漏斗图：梯形层叠（上宽下窄），逐层变浅
    const layers = 5;
    const layerH = (h - 24) / layers;
    for (let i = 0; i < layers; i++) {
      const y = 12 + i * layerH;
      const halfW = (w / 2 - 8) * (1 - i / layers) * 0.92 + 4;
      const halfWNext = (w / 2 - 8) * (1 - (i + 1) / layers) * 0.92 + 4;
      ctx.fillStyle = `rgba(0,212,255,${0.85 - i * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, y);
      ctx.lineTo(cx + halfW, y);
      ctx.lineTo(cx + halfWNext, y + layerH);
      ctx.lineTo(cx - halfWNext, y + layerH);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(44,44,52,1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

  } else if (type === 'gauge-chart') {
    // 仪表盘：半圆弧轨道 + 进度弧 + 指针
    const gR = Math.min(w, h) / 2 - 10;
    const gStart = Math.PI * 0.75, gEnd = Math.PI * 2.25;
    // 轨道弧
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(cx, cy + 6, gR, gStart, gEnd); ctx.stroke();
    // 进度弧（约 65%）
    const gProg = gStart + (gEnd - gStart) * 0.65;
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(cx, cy + 6, gR, gStart, gProg); ctx.stroke();
    // 指针
    const ang = gStart + (gEnd - gStart) * 0.65;
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx + Math.cos(ang) * (gR - 8), cy + 6 + Math.sin(ang) * (gR - 8));
    ctx.stroke();
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath(); ctx.arc(cx, cy + 6, 3, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'bar-line-chart') {
    const bars = [[20, 52], [38, 44], [56, 38], [74, 30]];
    bars.forEach(([x, top]) => {
      ctx.fillStyle = 'rgba(0,212,255,0.6)';
      roundRect(ctx, x - 5, top, 10, 60 - top, 2);
      ctx.fill();
    });
    const pts = [[20, 30], [38, 24], [56, 18], [74, 12]];
    ctx.strokeStyle = '#FF8C42';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.fillStyle = '#FF8C42';
    pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); });

  } else if (type === 'image-widget') {
    // Image frame with mountain icon
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, 6, 8, w - 12, h - 16, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(0,212,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(cx - 10, h - 12); ctx.lineTo(cx - 4, h - 24); ctx.lineTo(cx + 3, h - 18);
    ctx.lineTo(cx + 6, h - 22); ctx.lineTo(cx + 12, h - 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.beginPath(); ctx.arc(cx - 4, h - 24, 2, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'water-pond') {
    // 圆形 + 波浪线
    ctx.strokeStyle = 'rgba(0,212,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,212,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 8);
    for (let x = -20; x <= 20; x += 2) {
      ctx.lineTo(cx + x, cy + 6 + Math.sin(x * 0.5) * 8);
    }
    ctx.lineTo(cx + 20, cy + 24);
    ctx.lineTo(cx - 20, cy + 24);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px JetBrains Mono,monospace';
    ctx.textAlign = 'center';
    ctx.fillText('60%', cx, cy + 2);

  } else if (type === 'box-plot') {
    const drawBox = (bx: number, min: number, q1: number, med: number, q3: number, max: number) => {
      const s = (v: number) => cy + 24 - v * 0.8;
      ctx.strokeStyle = "rgba(0,212,255,0.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, s(max)); ctx.lineTo(bx, s(min)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - 3, s(min)); ctx.lineTo(bx + 3, s(min)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - 3, s(max)); ctx.lineTo(bx + 3, s(max)); ctx.stroke();
      ctx.fillStyle = "rgba(0,212,255,0.25)"; ctx.strokeStyle = "rgba(0,212,255,0.6)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.rect(bx - 6, s(q3), 12, s(q1) - s(q3)); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx - 6, s(med)); ctx.lineTo(bx + 6, s(med)); ctx.stroke();
    };
    drawBox(20, 10, 20, 30, 45, 55);
    drawBox(60, 15, 25, 35, 48, 60);
    drawBox(100, 5, 18, 28, 40, 50);

  } else if (type === 'candlestick') {
    // K线：阳线绿实心、阴线红空心
    const drawCandle = (bx: number, open: number, close: number, high: number, low: number) => {
      const s = (v: number) => cy + 24 - v * 0.55;
      const up = close >= open;
      ctx.strokeStyle = up ? "rgba(52,211,153,0.8)" : "rgba(248,113,113,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, s(high)); ctx.lineTo(bx, s(low)); ctx.stroke();  // 影线
      ctx.fillStyle = up ? "rgba(52,211,153,0.8)" : "rgba(248,113,113,0.15)";
      ctx.strokeStyle = up ? "rgba(52,211,153,0.8)" : "rgba(248,113,113,0.8)";
      ctx.lineWidth = 1.2;
      ctx.fillRect(bx - 3, s(Math.max(open, close)), 6, Math.max(2, s(Math.min(open, close)) - s(Math.max(open, close))));
      ctx.strokeRect(bx - 3, s(Math.max(open, close)), 6, Math.max(2, s(Math.min(open, close)) - s(Math.max(open, close))));
    };
    drawCandle(25, 30, 38, 42, 26);
    drawCandle(60, 38, 34, 40, 30);
    drawCandle(95, 34, 46, 48, 32);

  } else if (type === 'histogram') {
    // 直方图：钟形分布的密集柱
    const barCount = 9, totalW = w - 20;
    const barW = totalW / barCount;
    const baseY = h - 12, maxH = h * 0.5;
    const heights = [0.2, 0.4, 0.65, 0.85, 1, 0.85, 0.65, 0.4, 0.2];
    ctx.fillStyle = 'rgba(0,212,255,0.55)';
    for (let i = 0; i < barCount; i++) {
      const bh = maxH * heights[i];
      ctx.fillRect(10 + i * barW + 1, baseY - bh, barW - 2, bh);
    }

  } else if (type === 'confidence-band') {
    // 置信区间带：主线 + 上下界淡色带
    const pts = (vals: number[]) => vals.map((v, i) => [10 + i * ((w - 20) / 4), h - 14 - v * 0.5]);
    const upper = pts([0.7, 0.55, 0.75, 0.6, 0.8]);
    const lower = pts([0.3, 0.2, 0.35, 0.25, 0.4]);
    const main = pts([0.5, 0.4, 0.55, 0.45, 0.6]);
    // 带填充
    ctx.fillStyle = 'rgba(0,212,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(upper[0][0], upper[0][1]);
    upper.forEach(([x, y]) => ctx.lineTo(x, y));
    lower.slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath(); ctx.fill();
    // 上下界虚线
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    for (const pts2 of [upper, lower]) {
      ctx.beginPath(); pts2.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
    }
    ctx.setLineDash([]);
    // 主线
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); main.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
    main.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fillStyle = '#00D4FF'; ctx.fill(); });

  } else if (type === 'step-line') {
    // 阶梯线图：水平 + 垂直交替的阶梯折线
    const sp = [
      [10, h - 30], [40, h - 30], [40, h - 18], [70, h - 18], [70, h - 38],
      [100, h - 38], [100, h - 24], [110, h - 24],
    ];
    ctx.strokeStyle = 'rgba(0,212,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    sp.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();
    sp.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fillStyle = '#00D4FF'; ctx.fill(); });

  } else if (type === 'dynamic-time') {
    // 动态时间轴：波形 + 滚动方向箭头
    const dv = [0.45, 0.65, 0.5, 0.75, 0.55, 0.85, 0.6, 0.7, 0.5, 0.65, 0.45];
    const dp = dv.map((v, i) => [10 + i * ((w - 20) / (dv.length - 1)), h - 14 - v * 0.45]);
    ctx.strokeStyle = 'rgba(0,212,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); dp.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();
    // 尾部箭头（向右滚动）
    const tail = dp[dp.length - 1];
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath();
    ctx.moveTo(tail[0] + 4, tail[1]);
    ctx.lineTo(tail[0] - 2, tail[1] - 3.5);
    ctx.lineTo(tail[0] - 2, tail[1] + 3.5);
    ctx.closePath(); ctx.fill();

  } else if (type === 'large-area-chart') {
    // 大规模面积图：密集波形 + 渐变面积
    const wv = (pts: number[]) => pts.map((v, i) => [10 + i * ((w - 20) / (pts.length - 1)), h - 14 - v * 0.45]);
    const wave = wv([0.5, 0.7, 0.45, 0.8, 0.55, 0.9, 0.6, 0.75, 0.4, 0.65, 0.5]);
    ctx.fillStyle = 'rgba(0,212,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(wave[0][0], wave[0][1]);
    wave.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(wave[wave.length - 1][0], h - 12);
    ctx.lineTo(wave[0][0], h - 12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); wave.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.stroke();

  } else if (type === 'scatter-plot') {
    // 散点图：分布散点（无区域线）
    const spts = [[15, 22], [32, 40], [48, 18], [60, 52], [78, 30], [95, 44], [70, 58], [40, 56], [55, 36], [25, 50]];
    ctx.fillStyle = 'rgba(0,212,255,0.8)';
    spts.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); });

  } else if (type === 'intraday-chart') {
    // 盘中走势图：两段走势线，中部断开（午休间隔）
    const seg = (pts: number[][]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.stroke();
    };
    ctx.strokeStyle = 'rgba(0,212,255,0.8)';
    ctx.lineWidth = 1.5;
    seg([[10, 40], [40, 34], [55, 38], [68, 30]]);
    seg([[80, 40], [95, 36], [110, 44]]);

  } else if (type === 'radar-chart') {
    // 雷达图：五边形 + 网格线
    const rn = 5, rc = 24;
    const rpt = (i: number, r: number) => [cx + r * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / rn), cy + r * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / rn)];
    // 网格
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth = 0.8;
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= rn; i++) {
        const [x, y] = rpt(i % rn, (rc * ring) / 3);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < rn; i++) {
      const [x, y] = rpt(i, rc);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    }
    // 数据多边形
    const vals = [0.9, 0.65, 0.8, 0.5, 0.7];
    ctx.fillStyle = 'rgba(0,212,255,0.25)';
    ctx.strokeStyle = 'rgba(0,212,255,0.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    vals.forEach((v, i) => {
      const [x, y] = rpt(i, rc * v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.fill(); ctx.stroke();

  } else if (type === 'heatmap') {
    // 热力图：渐变色格子矩阵
    const hc = ['rgba(26,26,36,1)', 'rgba(10,61,92,0.9)', 'rgba(0,168,204,0.8)', 'rgba(0,212,255,0.9)', 'rgba(255,140,66,0.95)'];
    const hrows = 5, hcols = 9;
    for (let r = 0; r < hrows; r++) {
      for (let c = 0; c < hcols; c++) {
        const heat = Math.exp(-((r - 2) ** 2 + (c - 4) ** 2) / 6);
        const idx = Math.min(hc.length - 1, Math.floor(heat * hc.length));
        ctx.fillStyle = hc[idx];
        ctx.fillRect(12 + c * (w - 24) / hcols, 8 + r * (h - 16) / hrows, (w - 24) / hcols + 0.5, (h - 16) / hrows + 0.5);
      }
    }

  } else if (type === 'relation-chart') {
    // 关系图：中心节点 + 放射连线 + 周围节点
    const rnC = [cx, cy];
    const rnPts = [[15, 18], [95, 16], [12, 52], [100, 55], [52, 62]];
    ctx.strokeStyle = 'rgba(0,212,255,0.45)';
    ctx.lineWidth = 0.8;
    rnPts.forEach(([x, y]) => {
      ctx.beginPath(); ctx.moveTo(rnC[0], rnC[1]); ctx.lineTo(x, y); ctx.stroke();
    });
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath(); ctx.arc(rnC[0], rnC[1], 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,212,255,0.85)';
    rnPts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });

  } else if (type === 'tree-chart') {
    // 树形图：根节点 + 分级分支线
    ctx.strokeStyle = 'rgba(0,212,255,0.5)';
    ctx.lineWidth = 0.8;
    // 一级分支
    ctx.beginPath(); ctx.moveTo(60, 14); ctx.lineTo(60, 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(100, 30); ctx.stroke();
    // 二级分支
    ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(20, 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 44); ctx.lineTo(28, 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 30); ctx.lineTo(60, 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(52, 44); ctx.lineTo(68, 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(100, 30); ctx.lineTo(100, 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(92, 44); ctx.lineTo(108, 44); ctx.stroke();
    ctx.fillStyle = '#00D4FF';
    [[60, 14], [20, 30], [60, 30], [100, 30], [20, 44], [60, 44], [100, 44]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    });

  } else if (type === 'treemap-chart') {
    // 矩形树图：嵌套矩形分布
    ctx.fillStyle = 'rgba(0,212,255,0.9)';
    ctx.fillRect(12, 10, 30, 52);
    ctx.fillStyle = 'rgba(0,212,255,0.65)';
    ctx.fillRect(44, 10, 56, 24);
    ctx.fillStyle = 'rgba(0,212,255,0.35)';
    ctx.fillRect(44, 36, 24, 26);
    ctx.fillStyle = 'rgba(0,212,255,0.55)';
    ctx.fillRect(70, 36, 30, 26);
    ctx.strokeStyle = 'rgba(44,44,52,1)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 10, 30, 52);
    ctx.strokeRect(44, 10, 56, 24);
    ctx.strokeRect(44, 36, 24, 26);
    ctx.strokeRect(70, 36, 30, 26);

  } else if (type === 'sunburst-chart') {
    // 旭日图：同心环扇区（中心盘 + 三环，逐层变浅）
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8;
    const rings = [
      { r0: 0, r1: 0.3, alpha: 0.9, sectors: [[0, 1.8], [1.8, 3.6], [3.6, 5.2], [5.2, 6.28]] },
      { r0: 0.3, r1: 0.62, alpha: 0.6, sectors: [[0, 2.1], [2.1, 4.3], [4.3, 6.28]] },
      { r0: 0.62, r1: 1, alpha: 0.35, sectors: [[0, 1.4], [1.4, 3.0], [3.0, 4.6], [4.6, 6.28]] },
    ];
    rings.forEach((ring) => {
      ring.sectors.forEach(([a0, a1]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r1 * R, a0, a1);
        ctx.arc(cx, cy, ring.r0 * R, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,212,255,${ring.alpha})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(44,44,52,1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });

  } else if (type === 'multiple-x-axis-chart') {
    // 多 X 轴：上下双轴 + 两条折线十字交叉
    // 顶部轴
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(w - 10, 10); ctx.stroke();
    // 底部轴
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.moveTo(10, h - 10); ctx.lineTo(w - 10, h - 10); ctx.stroke();
    // 底部折线（电光蓝，从左下向上）
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(10, h - 16);
    ctx.lineTo(w * 0.35, h * 0.62);
    ctx.lineTo(w * 0.6, h * 0.4);
    ctx.lineTo(w - 10, h * 0.2);
    ctx.stroke();
    // 顶部折线（琥珀橙，从右上向下）
    ctx.strokeStyle = '#FF8C42';
    ctx.beginPath();
    ctx.moveTo(w - 10, 16);
    ctx.lineTo(w * 0.65, h * 0.42);
    ctx.lineTo(w * 0.4, h * 0.62);
    ctx.lineTo(10, h * 0.8);
    ctx.stroke();

  } else if (type === 'sankey-chart') {
    // 桑基图：左1中2右3节点 + 渐变流量连线
    const nodeW = 8, nodeH = 20;
    const cols = [
      { x: 12, ys: [cy - nodeH / 2] },
      { x: 44, ys: [cy - 16, cy + 8] },
      { x: 88, ys: [cy - 22, cy - 2, cy + 16] },
    ];
    // 连线（先画，节点覆盖其端点）
    ctx.lineWidth = 2.5;
    const links = [
      [0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1],
    ];
    links.forEach(([c, f, t]) => {
      const x0 = cols[c].x + nodeW, y0 = cols[c].ys[f] + nodeH / 2;
      const x1 = cols[c + 1].x, y1 = cols[c + 1].ys[t] + nodeH / 2;
      ctx.strokeStyle = `rgba(0,212,255,${0.22 + c * 0.1})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + 18, y0, x1 - 18, y1, x1, y1);
      ctx.stroke();
    });
    // 节点
    cols.forEach((col) => {
      col.ys.forEach((y) => {
        ctx.fillStyle = 'rgba(0,212,255,0.85)';
        ctx.fillRect(col.x, y, nodeW, nodeH);
        ctx.strokeStyle = 'rgba(44,44,52,1)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(col.x, y, nodeW, nodeH);
      });
    });

  } else if (type === 'voronoi') {
    // Voronoi：区域分割线 + 散点
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(10, 14); ctx.lineTo(58, 34); ctx.lineTo(30, 62); ctx.lineTo(10, 14); ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(58, 34); ctx.lineTo(110, 18); ctx.lineTo(94, 60); ctx.lineTo(58, 34); ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, 62); ctx.lineTo(58, 34); ctx.lineTo(94, 60); ctx.lineTo(110, 18); ctx.lineTo(110, 64); ctx.lineTo(94, 60); ctx.closePath(); ctx.stroke();
    const pts = [[10, 14], [58, 34], [30, 62], [110, 18], [94, 60]];
    ctx.fillStyle = '#00D4FF';
    pts.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); });

  } else if (type === 'group-chart') {
    // 分组柱状图：电光蓝 + 琥珀橙两组并列柱
    const barCount = 4, gap = 4, totalW = w - 24;
    const groupW = (totalW - gap * (barCount - 1)) / barCount;
    const barW = groupW * 0.3;
    const baseY = h - 12, maxH = h * 0.55;
    const v1 = [0.7, 0.45, 0.9, 0.55];
    const v2 = [0.5, 0.8, 0.6, 0.75];
    for (let i = 0; i < barCount; i++) {
      const gx = 12 + i * (groupW + gap);
      ctx.fillStyle = 'rgba(0,212,255,0.6)';
      ctx.fillRect(gx, baseY - v1[i] * maxH, barW, v1[i] * maxH);
      ctx.fillStyle = 'rgba(255,140,66,0.6)';
      ctx.fillRect(gx + barW + 1, baseY - v2[i] * maxH, barW, v2[i] * maxH);
    }

  } else if (type === 'video-widget') {
    // 2x2 grid with play icons
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 0.5;
    // 2x2 grid lines
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, cy); ctx.lineTo(w - 8, cy); ctx.stroke();
    // Play triangles in 4 quadrants
    const playTriangle = (qx: number, qy: number) => {
      ctx.fillStyle = 'rgba(0,212,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(qx - 3, qy - 5); ctx.lineTo(qx - 3, qy + 5); ctx.lineTo(qx + 4, qy);
      ctx.closePath(); ctx.fill();
    };
    playTriangle(cx / 2, cy / 2);
    playTriangle(cx + cx / 2, cy / 2);
    playTriangle(cx / 2, cy + cy / 2);
    playTriangle(cx + cx / 2, cy + cy / 2);

  } else if (type === 'text-widget') {
    // Text lines
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px "Inter","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aa', cx, cy + 4);
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(12, h - 10); ctx.lineTo(w - 12, h - 10); ctx.stroke();

  } else if (type.startsWith('composite-')) {
    // 2×2 grid with dashed dividers
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([3, 3]);
    // Vertical divider
    ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10); ctx.stroke();
    // Horizontal divider
    ctx.beginPath(); ctx.moveTo(10, cy); ctx.lineTo(w - 10, cy); ctx.stroke();
    ctx.setLineDash([]);
    // Quadrant labels
    ctx.fillStyle = 'rgba(0,212,255,0.4)';
    ctx.font = '7px "Inter","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', cx / 2, cy / 2 + 2);
    ctx.fillText('B', cx + cx / 2, cy / 2 + 2);
    ctx.fillText('C', cx / 2, cy + cy / 2 + 2);
    ctx.fillText('D', cx + cx / 2, cy + cy / 2 + 2);

  } else if (type === 'cyber-map') {
    // Map outline with grid and pin
    ctx.strokeStyle = 'rgba(0,212,255,0.55)';
    ctx.lineWidth = 1;
    // Irregular polygon (simplified map shape)
    ctx.beginPath();
    ctx.moveTo(16, 20); ctx.lineTo(28, 14); ctx.lineTo(50, 12); ctx.lineTo(70, 16);
    ctx.lineTo(90, 22); ctx.lineTo(104, 28); ctx.lineTo(100, 48); ctx.lineTo(88, 55);
    ctx.lineTo(62, 58); ctx.lineTo(40, 55); ctx.lineTo(22, 48); ctx.lineTo(12, 36);
    ctx.closePath();
    ctx.stroke();
    // Offset outline (thickness effect)
    ctx.strokeStyle = 'rgba(0,212,255,0.2)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(17, 19); ctx.lineTo(29, 13); ctx.lineTo(51, 11); ctx.lineTo(71, 15);
    ctx.lineTo(91, 21); ctx.lineTo(105, 29); ctx.lineTo(101, 49); ctx.lineTo(89, 56);
    ctx.lineTo(61, 59); ctx.lineTo(39, 56); ctx.lineTo(21, 49); ctx.lineTo(11, 37);
    ctx.closePath();
    ctx.stroke();
    // Grid cross lines
    ctx.strokeStyle = 'rgba(0,212,255,0.1)';
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.moveTo(8, cy); ctx.lineTo(w - 8, cy); ctx.stroke();
    // Pin dot
    ctx.fillStyle = '#FF8C42';
    ctx.beginPath(); ctx.arc(60, 30, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FF8C42';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(60, 30, 5, 0, Math.PI * 2); ctx.stroke();

  } else {
    // Fallback: centered label
    ctx.font = '12px "Inter","PingFang SC",sans-serif';
    ctx.fillText(type, cx, cy + 4);
  }

  return canvas;
}

/** 创建顶栏组件拖拽缩略图 */
function createHeaderThumbnail(type: string, w: number, h: number): HTMLElement {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${w}px;height:${h}px;opacity:0.82`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const c = '#00D4FF';
  const cx = w / 2, cy = h / 2;

  // 背景
  ctx.fillStyle = 'rgba(44,44,52,0.92)';
  roundRect(ctx, 0, 0, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,212,255,0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 4);
  ctx.stroke();

  if (type === 'header-datetime') {
    // Digital clock display — dark panel
    const bx = 8, by = 5, bw = w - 16, bh = h - 10;
    ctx.fillStyle = 'rgba(10,14,26,0.7)';
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.25)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 4);
    ctx.stroke();
    // Time — digital font
    ctx.font = 'bold 20px "JetBrains Mono",monospace';
    ctx.fillStyle = '#00D4FF';
    ctx.textAlign = 'center';
    ctx.fillText('14:32', bx + bw / 2, by + 19);
    // Date below
    ctx.font = '8px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(0,212,255,0.45)';
    ctx.fillText('2026-07-16', bx + bw / 2, by + 30);

  } else if (type === 'header-title') {
    // Title lines
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    roundRect(ctx, 10, 14, w - 20, 5, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,212,255,0.5)';
    roundRect(ctx, 10, 24, w * 0.5, 4, 2); ctx.fill();

  } else if (type === 'mini-globe') {
    const gr = 14; // globe radius
    const gx = w / 2, gy = h / 2;
    // Sphere body
    ctx.fillStyle = 'rgba(44,44,52,0.7)';
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.stroke();
    // Latitude lines
    ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.lineWidth = 0.5;
    [-6, -3, 0, 3, 6].forEach(dy => {
      const rx = Math.sqrt(gr * gr - dy * dy);
      ctx.beginPath();
      ctx.ellipse(gx, gy + dy, rx, 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Equator ring
    ctx.strokeStyle = 'rgba(0,212,255,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(gx, gy, gr + 1, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Highlight dot
    ctx.fillStyle = 'rgba(0,212,255,0.5)';
    ctx.beginPath(); ctx.arc(gx - 4, gy - 5, 1.2, 0, Math.PI * 2); ctx.fill();

  } else if (type === 'spectrum-bar') {
    // 5 bars with varying heights
    const barW = 3, gap = 2.5;
    const barXs = [18, 25, 32, 39, 46].map(x => cx - 16 + x * 0.8);
    const barHs = [22, 14, 30, 18, 26];
    barXs.forEach((bx, i) => {
      const bh = barHs[i];
      const by = h - 10 - bh;
      ctx.fillStyle = `rgba(0,212,255,${0.3 + i * 0.08})`;
      roundRect(ctx, bx, by, barW, bh, 1.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,212,255,0.5)';
      ctx.beginPath(); ctx.arc(bx + barW / 2, by, 1.2, 0, Math.PI * 2); ctx.fill();
    });

  } else if (type === 'signal-tower') {
    // A-shaped tower
    ctx.strokeStyle = 'rgba(0,212,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 14, h - 8); ctx.lineTo(cx, 8); ctx.lineTo(cx + 14, h - 8); ctx.stroke();
    // Cross bars
    ctx.strokeStyle = 'rgba(0,212,255,0.2)';
    ctx.lineWidth = 0.5;
    for (let t = 0.3; t < 1; t += 0.25) {
      const y = 8 + (h - 16) * t;
      const lx = cx - 14 * (1 - t);
      const rx = cx + 14 * (1 - t);
      ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke();
    }
    // Pulse dot at top
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.beginPath(); ctx.arc(cx, 8, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, 8, 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

  } else if (type === 'wire-sphere') {
    // Icosahedron-like wireframe
    const gr = 13;
    // Outer circles
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2); ctx.stroke();
    // Diagonal lines (suggesting facets)
    ctx.strokeStyle = 'rgba(0,212,255,0.2)';
    ctx.lineWidth = 0.4;
    for (let a = 0; a < Math.PI; a += Math.PI / 5) {
      const x1 = cx + Math.cos(a) * gr;
      const y1 = cy + Math.sin(a) * gr;
      const x2 = cx + Math.cos(a + Math.PI * 0.6) * gr * 0.6;
      const y2 = cy + Math.sin(a + Math.PI * 0.6) * gr * 0.6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Vertex dots
    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * gr, cy + Math.sin(a) * gr * 0.55, 1, 0, Math.PI * 2);
      ctx.fill();
    }

  } else {
    ctx.font = '11px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = '#00D4FF';
    ctx.textAlign = 'center';
    ctx.fillText(type, cx, cy + 4);
  }

  return canvas;
}

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  stat: '统计卡',
  chart: '图表',
  table: '表格',
  '3d': '3D 组件',
  media: '媒体',
  decorator: '装饰',
  custom: '自定义',
};

/**
 * 组件池面板
 * 像手机主屏幕那样展示组件缩略图，拖入画布即放置。
 */
export function WidgetPalette({ onCreateComposite }: { onCreateComposite?: () => void }) {
  const grouped = widgetRegistry.getGroupedByCategory();
  const allWidgets = widgetRegistry.getAll();
  const headerElements = headerElementRegistry.getAll();
  const deleteCustomComponent = useEditorStore((s) => s.deleteCustomComponent);
  const renameCustomComponent = useEditorStore((s) => s.renameCustomComponent);
  const instances = useEditorStore((s) => s.config.widgets);
  const toggleHeader = useEditorStore((s) => s.toggleHeader);
  const headerVisible = useEditorStore((s) => s.config.header?.visible !== false);
  if (allWidgets.length === 0 && headerElements.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-textSecondary/50 py-12">
        暂无可用的数据组件
      </div>
    );
  }

  // ─── 搜索过滤：名称/描述/类型模糊匹配（大小写不敏感） ───
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const match = (w: { name: string; description?: string; type: string }) =>
    !q || w.name.toLowerCase().includes(q)
      || (w.description ?? '').toLowerCase().includes(q)
      || w.type.toLowerCase().includes(q);
  const filteredHeader = headerElements.filter(match);
  const filteredGroups = Array.from(grouped.entries())
    .map(([category, widgets]) => [category, widgets.filter(match)] as const)
    .filter(([, widgets]) => widgets.length > 0);
  const totalMatched = filteredHeader.length
    + filteredGroups.reduce((s, [, widgets]) => s + widgets.length, 0);

  return (
    <div className="p-3 space-y-4">
      {/* ─── 搜索栏 ─── */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-textSecondary/40 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索组件..."
          className="w-full bg-surface-base border border-[rgba(255,255,255,0.06)] rounded-md pl-7 pr-2 py-1.5 text-xs text-text placeholder:text-textSecondary/30 focus:outline-none focus:border-accent-cool/50 transition-colors"
        />
      </div>

      {totalMatched === 0 ? (
        <div className="text-center text-xs text-textSecondary/40 py-8">无匹配组件</div>
      ) : (
        <>
          {/* ─── 顶栏组件 ─── */}
          {filteredHeader.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-semibold text-accent-warm/50 uppercase tracking-wider">顶栏</span>
                <button
                  onClick={toggleHeader}
                  className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                    headerVisible
                      ? 'bg-accent-cool/10 text-accent-cool border-accent-cool/25'
                      : 'bg-surface-hover text-textSecondary/40 border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  {headerVisible ? '显示' : '隐藏'}
                </button>
              </div>
              <div className="space-y-1">
                {filteredHeader.map((el) => (
                  <HeaderPaletteItem key={el.type} element={el} />
                ))}
              </div>
            </div>
          )}

          {/* ─── 普通组件 ─── */}
          {filteredGroups.map(([category, widgets]) => (
            <div key={category}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-semibold text-textSecondary/40 uppercase tracking-wider">
                  {CATEGORY_LABELS[category]}
                </span>
                {/* ★ 图表分类显示"创建组合"入口 */}
                {category === 'chart' && (
                  <button
                    onClick={() => onCreateComposite?.()}
                    className="flex items-center gap-1 text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors px-1.5 py-0.5 rounded border border-[rgba(0,212,255,0.15)] hover:border-[rgba(0,212,255,0.35)]"
                  >
                    <Plus size={10} />
                    创建组合
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {widgets.map((widget) => (
                  <PaletteItem
                    key={widget.type}
                    widget={widget}
                    onRename={category === 'custom' ? () => {
                      const name = window.prompt('重命名', widget.name);
                      if (name && name.trim()) renameCustomComponent(widget.type, name.trim());
                    } : undefined}
                    onDelete={category === 'custom' ? () => {
                      const count = instances.filter((w) => w.type === widget.type).length;
                      const msg = count > 0
                        ? `删除自定义组件「${widget.name}」？画布上有 ${count} 个实例将一并删除。`
                        : `删除自定义组件「${widget.name}」？`;
                      if (window.confirm(msg)) deleteCustomComponent(widget.type);
                    } : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function PaletteItem({ widget, onDelete, onRename }: { widget: WidgetDefinition; onDelete?: () => void; onRename?: () => void }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/widget-type', widget.type);
    e.dataTransfer.effectAllowed = 'copy';
    const thumb = createWidgetThumbnail(widget.type, 120, 72);
    e.dataTransfer.setDragImage(thumb, 60, 36);
    requestAnimationFrame(() => thumb.remove());
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-grab active:cursor-grabbing
        hover:bg-surface-hover transition-colors group border border-transparent hover:border-[rgba(255,255,255,0.04)]"
    >
      {/* 图标 */}
      <div className="w-9 h-9 rounded-md bg-surface-base flex items-center justify-center
        text-accent-cool/70 group-hover:text-accent-cool group-hover:bg-surface-hover transition-all flex-shrink-0">
        <WidgetIcon name={widget.icon} />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-textSecondary group-hover:text-text truncate">
          {widget.name}
        </div>
        <div className="text-[10px] text-textSecondary/40 truncate mt-0.5">
          {widget.description}
        </div>
      </div>

      {/* 默认尺寸标签 */}
      <div className="text-[9px] text-textSecondary/20 font-mono flex-shrink-0 bg-surface-base/50 px-1 py-0.5 rounded">
        {widget.defaultSize.colSpan}×{widget.defaultSize.rowSpan}
      </div>

      {onRename && (
        <button
          onClick={(e) => { e.stopPropagation(); onRename(); }}
          onDragStart={(e) => e.stopPropagation()}
          draggable={false}
          title="重命名"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-textSecondary/40 hover:text-accent-cool hover:bg-accent-cool/10 transition-colors"
        >
          <Pencil size={12} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onDragStart={(e) => e.stopPropagation()}
          draggable={false}
          title="删除自定义组件"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-textSecondary/40 hover:text-negative hover:bg-negative/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

/** 顶栏组件项 — 拖入顶栏槽位 */
function HeaderPaletteItem({ element }: { element: HeaderElementDefinition }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/header-element-type', element.type);
    e.dataTransfer.effectAllowed = 'copy';
    const thumb = createHeaderThumbnail(element.type, 90, 42);
    e.dataTransfer.setDragImage(thumb, 45, 21);
    requestAnimationFrame(() => thumb.remove());
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-grab active:cursor-grabbing
        hover:bg-surface-hover transition-colors group border border-transparent hover:border-[rgba(255,255,255,0.04)]"
    >
      <div className="w-9 h-9 rounded-md bg-surface-base flex items-center justify-center
        text-accent-warm/70 group-hover:text-accent-warm group-hover:bg-surface-hover transition-all flex-shrink-0">
        <WidgetIcon name={element.icon} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-textSecondary group-hover:text-text truncate">
          {element.name}
        </div>
        <div className="text-[10px] text-textSecondary/40 truncate mt-0.5">
          仅顶栏可用
        </div>
      </div>

      <div className="text-[9px] text-textSecondary/20 font-mono flex-shrink-0 bg-surface-base/50 px-1 py-0.5 rounded">
        {element.defaultColSpan}列
      </div>
    </div>
  );
}
