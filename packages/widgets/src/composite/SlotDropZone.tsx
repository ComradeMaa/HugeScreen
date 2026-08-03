import { Suspense, useState, useEffect } from 'react';
import type { CompositeSubChartType } from '@hugescreen/shared';
import { widgetRegistry } from '@hugescreen/core';
import { getValidSubTypes } from './types';

interface SlotDropZoneProps {
  slotIndex: number;
  chartType: CompositeSubChartType | null;
  chartOptions?: Record<string, unknown>;
  dataSource?: import('@hugescreen/shared').DataSourceConfig;
  isSelected: boolean;
  onDrop: (slotIndex: number, chartType: CompositeSubChartType) => void;
  onClick: () => void;
  onDelete?: (slotIndex: number) => void;
  disabled?: boolean;
}

const AREA_LABELS = ['A', 'B', 'C', 'D'];

/** 判断拖拽数据中是否包含合法图表类型 */
function hasValidChartType(e: React.DragEvent): boolean {
  return e.dataTransfer.types.some(t => {
    // HTML5 drag data types are the MIME or custom type string
    // The palette sets 'application/widget-type' as custom data
    if (t === 'application/widget-type') return true;
    return false;
  });
}

export function SlotDropZone({
  slotIndex,
  chartType,
  chartOptions,
  dataSource,
  isSelected,
  onDrop,
  onClick,
  onDelete,
  disabled,
}: SlotDropZoneProps) {
  const filled = !!chartType;
  const area = AREA_LABELS[slotIndex] ?? String(slotIndex);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraggingOut, setIsDraggingOut] = useState(false);

  // Clean up global delete callback on unmount (abnormal close during drag)
  useEffect(() => () => {
    delete (window as any).__hugescreen_compositeSlotDelete;
  }, []);

  // ★ 荧光描边效果 — 与主界面 drop preview 一致
  const glowStyle = isDragOver ? {
    borderColor: 'rgba(0,212,255,0.6)',
    boxShadow: '0 0 16px rgba(0,212,255,0.35), inset 0 0 8px rgba(0,212,255,0.1)',
  } : {};

  const className = `composite-slot relative w-full h-full rounded-md border transition-all duration-150 cursor-pointer overflow-hidden ${
    filled
      ? isSelected
        ? 'border-[#00D4FF] bg-[rgba(0,212,255,0.06)]'
        : 'border-[rgba(0,212,255,0.18)] bg-[rgba(0,212,255,0.02)] hover:border-[rgba(0,212,255,0.35)]'
      : 'border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.01)] hover:border-[rgba(255,255,255,0.15)]'
  } ${isSelected ? 'ring-1 ring-[#00D4FF]/40' : ''}`;

  return (
    <div
      className={className}
      draggable={filled}
      style={{ gridArea: String.fromCharCode(97 + slotIndex), ...glowStyle }}
      onDragStart={(e) => {
        if (!filled) return;
        e.dataTransfer.setData('application/composite-slot', String(slotIndex));
        e.dataTransfer.effectAllowed = 'move';
        setIsDraggingOut(true);
        // Notify global delete target (read by EditorOverlay)
        if (onDelete) {
          (window as any).__hugescreen_compositeSlotDelete = () => onDelete(slotIndex);
        }
      }}
      onDragEnd={() => {
        setIsDraggingOut(false);
        delete (window as any).__hugescreen_compositeSlotDelete;
      }}
      onDragOver={(e) => {
        if (disabled) return;
        if (hasValidChartType(e)) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        if (disabled) return;
        e.stopPropagation();
        const type = e.dataTransfer.getData('application/widget-type');
        if (type && getValidSubTypes().includes(type)) {
          onDrop(slotIndex, type as CompositeSubChartType);
        }
      }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {filled ? (
        <>
          {/* ★ 渲染真实图表 */}
          <div className="absolute inset-0 pointer-events-none">
            {(() => {
              const def = widgetRegistry.get(chartType);
              const Comp = def?.component;
              const cfg = def?.defaultConfig ?? {};
              const merged = { ...cfg, ...(chartOptions ?? {}), dataSource };
              return Comp ? (
                <Suspense fallback={null}>
                  <Comp {...merged} />
                </Suspense>
              ) : null;
            })()}
          </div>
          {/* 槽位标签（半透明浮层） */}
          <div className="absolute top-1 left-1.5 z-10 pointer-events-none">
            <span className="text-[9px] text-[#00D4FF]/50 font-mono">{area}</span>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
          <span className="text-[10px] text-[#9E9EA8]/50">拖入图表</span>
          <span className="text-[10px] text-[#9E9EA8]/30">槽位 {area}</span>
        </div>
      )}
    </div>
  );
}
