import { useState, useEffect } from 'react';
import { CyberBorder1 } from './styles/CyberBorder1';
import { CyberBorder2 } from './styles/CyberBorder2';
import { DataVBorder1 } from './styles/DataVBorder1';
import { DataVBorder2 } from './styles/DataVBorder2';
import { DataVBorder3 } from './styles/DataVBorder3';
import { DataVBorder4 } from './styles/DataVBorder4';
import { DataVBorder5 } from './styles/DataVBorder5';
import { DataVBorder6 } from './styles/DataVBorder6';
import { DataVBorder7 } from './styles/DataVBorder7';
import { DataVBorder8 } from './styles/DataVBorder8';
import { DataVBorder9 } from './styles/DataVBorder9';
import { DataVBorder10 } from './styles/DataVBorder10';
import { DataVBorder11 } from './styles/DataVBorder11';
import { DataVBorder12 } from './styles/DataVBorder12';
import { DataVBorder13 } from './styles/DataVBorder13';
import './border.css';

export interface BorderFrameProps {
  /** 边框风格标识 */
  borderStyle: string;
  /** 自定义边框图片 URL（borderStyle='custom' 时有效） */
  customBorderImage?: string;
  /** 边框容器像素坐标（已含向外延伸 6px 偏移） */
  left: number;
  top: number;
  width: number;
  height: number;
  /** 当前组件是否被选中（编辑态高亮） */
  isSelected?: boolean;
}

/**
 * 边框样式注册表。
 * 新增风格：在此映射 + 创建对应组件即可。
 */
export const BORDER_REGISTRY: Record<string, React.ComponentType<BorderStyleProps>> = {
  style1: CyberBorder1,
  style2: CyberBorder2,
  DataV_1: DataVBorder1, DataV_2: DataVBorder2, DataV_3: DataVBorder3,
  DataV_4: DataVBorder4, DataV_5: DataVBorder5, DataV_6: DataVBorder6,
  DataV_7: DataVBorder7, DataV_8: DataVBorder8, DataV_9: DataVBorder9,
  DataV_10: DataVBorder10, DataV_11: DataVBorder11, DataV_12: DataVBorder12, DataV_13: DataVBorder13,
};

export interface BorderStyleProps {
  /** 动画阶段 */
  phase: 'mounting' | 'entering' | 'entered';
  /** 组件是否被选中 */
  isSelected?: boolean;
  /** 边框容器宽度 px（含向外延伸） */
  width: number;
  /** 边框容器高度 px（含向外延伸） */
  height: number;
}

const ENTRY_DURATION_MS = 2200; // 描边(~1.3s) + 故障闪烁(~0.45s)

/**
 * BorderFrame — 边框宿主容器。
 *
 * 负责：
 *   1. 根据 borderStyle 选择对应的风格组件
 *   2. 管理入场动画 → 循环动画的阶段切换
 *   3. 在编辑态画布上渲染为独立的绝对定位图层
 *
 * 空间策略：向内为主 (占内容区内侧)，向外为辅 (溢出 ≤6px)。
 * 外层调用者负责传入已扩展的 left/top/width/height。
 */
export function BorderFrame({ borderStyle, customBorderImage, left, top, width, height, isSelected }: BorderFrameProps) {
  const [phase, setPhase] = useState<'mounting' | 'entering' | 'entered'>('mounting');

  useEffect(() => {
    // 首帧保持 mounting（不可见），下一帧触发入场
    const rAF = requestAnimationFrame(() => setPhase('entering'));

    // 入场动画完成后切换到循环阶段
    const timer = setTimeout(() => setPhase('entered'), ENTRY_DURATION_MS);

    return () => {
      cancelAnimationFrame(rAF);
      clearTimeout(timer);
    };
  }, []);

  // ─── 自定义图片边框 ───
  if (borderStyle === 'custom' && customBorderImage) {
    return (
      <div
        className="absolute pointer-events-none"
        style={{ left, top, width, height, zIndex: 5 }}
      >
        <img
          src={customBorderImage}
          alt="自定义边框"
          className="w-full h-full"
          style={{ objectFit: 'fill', imageRendering: 'auto' }}
          draggable={false}
        />
      </div>
    );
  }

  const Component = BORDER_REGISTRY[borderStyle];
  if (!Component) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top, width, height, zIndex: 5 }}
    >
      <Component phase={phase} isSelected={isSelected} width={width} height={height} />
    </div>
  );
}
