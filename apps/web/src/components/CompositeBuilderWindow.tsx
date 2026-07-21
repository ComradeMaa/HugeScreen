import { useState, useCallback } from 'react';
import type { CompositeLayoutTemplate, CompositeSubChartType, CompositeSlotConfig, CompositeConfig } from '@hugescreen/shared';
import { widgetRegistry } from '@hugescreen/core';
import { useEditorStore } from '../store/editorStore';
import { TEMPLATE_GRID_AREAS, TEMPLATE_SLOT_COUNTS, templateColumns, templateRows } from '@hugescreen/widgets/composite';
import { TemplatePicker } from '@hugescreen/widgets/composite';
import { SlotDropZone } from '@hugescreen/widgets/composite';
import { generateId } from '../utils/id';

interface CompositeBuilderWindowProps {
  onClose: () => void;
  onComplete: (typeName: string, displayName: string, composite: CompositeConfig) => void;
}

function createInitialSlots(count: number): CompositeSlotConfig[] {
  return Array.from({ length: count }, () => ({
    id: generateId(),
    chartType: '' as never,
    chartOptions: {},
  }));
}

/** HMR-safe counter — survives Vite hot reloads via window global */
function getBuilderCounter(): number {
  if ((window as any).__hugescreen_builderCounter == null) {
    (window as any).__hugescreen_builderCounter = 0;
  }
  return ++(window as any).__hugescreen_builderCounter;
}

export function CompositeBuilderWindow({ onClose, onComplete }: CompositeBuilderWindowProps) {
  const [phase, setPhase] = useState<'template' | 'building'>('template');
  const [template, setTemplate] = useState<CompositeLayoutTemplate | null>(null);
  const [slots, setSlots] = useState<CompositeSlotConfig[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const setCompositeSlotEdit = useEditorStore(s => s.setCompositeSlotEdit);

  const handleSelectTemplate = useCallback((tpl: CompositeLayoutTemplate) => {
    const count = TEMPLATE_SLOT_COUNTS[tpl];
    setTemplate(tpl);
    setSlots(createInitialSlots(count));
    setPhase('building');
  }, []);

  /** Push slot options to PropertyInspector via store */
  const pushToInspector = useCallback((slotId: string | null) => {
    if (!slotId) {
      setCompositeSlotEdit(null);
      setSelectedSlotId(null);
      return;
    }
    const slot = slots.find(s => s.id === slotId);
    if (!slot || !slot.chartType) return;

    setSelectedSlotId(slotId);
    setCompositeSlotEdit({
      chartType: slot.chartType as CompositeSubChartType,
      options: { ...slot.chartOptions },
      onUpdate: (patch: Record<string, unknown>) => {
        setSlots(prev => prev.map(s =>
          s.id === slotId ? { ...s, chartOptions: { ...s.chartOptions, ...patch } } : s
        ));
      },
      dataSource: slot.dataSource,
      onUpdateDataSource: (ds) => {
        setSlots(prev => prev.map(s =>
          s.id === slotId ? { ...s, dataSource: ds } : s
        ));
      },
    });
  }, [slots, setCompositeSlotEdit]);

  const handleSlotDrop = useCallback((slotIndex: number, chartType: CompositeSubChartType) => {
    setSlots(prev => prev.map((sl, i) =>
      i === slotIndex
        ? { ...sl, chartType, chartOptions: widgetRegistry.get(chartType)?.defaultConfig ?? {} }
        : sl
    ));
    // Select the newly filled slot and push to inspector
    const newSlotId = slots[slotIndex]?.id;
    if (newSlotId) {
      const defCfg = widgetRegistry.get(chartType)?.defaultConfig ?? {};
      setSelectedSlotId(newSlotId);
      setCompositeSlotEdit({
        chartType,
        options: { ...defCfg },
        onUpdate: (patch: Record<string, unknown>) => {
          setSlots(prev => prev.map(s =>
            s.id === newSlotId ? { ...s, chartOptions: { ...s.chartOptions, ...patch } } : s
          ));
        },
        dataSource: undefined,
        onUpdateDataSource: (ds) => {
          setSlots(prev => prev.map(s =>
            s.id === newSlotId ? { ...s, dataSource: ds } : s
          ));
        },
      });
    }
  }, [slots, setCompositeSlotEdit]);

  /** 从槽位拖出 → 删除槽位中的图表 */
  const handleSlotDelete = useCallback((slotIndex: number) => {
    setSlots(prev => prev.map((sl, i) =>
      i === slotIndex ? { ...sl, chartType: '' as never, chartOptions: {} } : sl
    ));
    // 如果正在编辑这个槽位，清除属性面板状态
    if (slots[slotIndex]?.id === selectedSlotId) {
      setSelectedSlotId(null);
      setCompositeSlotEdit(null);
    }
  }, [slots, selectedSlotId, setCompositeSlotEdit]);

  const handleSlotClick = useCallback((slotId: string | null) => {
    pushToInspector(slotId);
  }, [pushToInspector]);

  const handleCommit = useCallback(() => {
    if (!template) return;
    if (!slots.every(s => s.chartType)) return;

    const counter = getBuilderCounter();
    const typeName = `composite-${generateId()}`;
    const displayName = `自定义组件 ${counter}`;
    const config: CompositeConfig = { layoutTemplate: template, slots };

    setCompositeSlotEdit(null);
    onComplete(typeName, displayName, config);
  }, [template, slots, onComplete, setCompositeSlotEdit]);

  const handleClose = useCallback(() => {
    setCompositeSlotEdit(null);
    delete (window as any).__hugescreen_compositeSlotDelete;
    onClose();
  }, [onClose, setCompositeSlotEdit]);

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-[#2C2C34] border border-[rgba(0,212,255,0.25)] rounded-xl w-[700px] h-[520px] flex flex-col shadow-2xl shadow-[rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[#E8E8EC] tracking-wide">创建组合图表</h2>
          {template && (
            <span className="text-[11px] text-[#9E9EA8]">
              {phase === 'template' ? '步骤 1/2' : '步骤 2/2'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {slots.length > 0 && (
            <button
              onClick={() => handleSlotClick(null)}
              className="px-2 py-1.5 text-[12px] text-[#9E9EA8] border border-[rgba(255,255,255,0.06)] rounded hover:text-[#E8E8EC] transition-colors"
            >
              {selectedSlotId ? '取消选中' : ''}
            </button>
          )}
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-[12px] text-[#9E9EA8] border border-[rgba(255,255,255,0.06)] rounded hover:text-[#f87171] hover:border-[rgba(248,113,113,0.3)] transition-colors"
          >
            取消
          </button>
        </div>
      </div>

      {/* Body — full width, no right panel */}
      <div className="flex-1 flex min-h-0">
        <div className="relative flex-1 p-4 min-w-0">
          {phase === 'template' && (
            <TemplatePicker onSelect={handleSelectTemplate} onCancel={handleClose} />
          )}

          {phase === 'building' && template && (
            <div className="w-full h-full flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <span className="text-[12px] text-[#E8E8EC] tracking-wide">
                  {TEMPLATE_SLOT_COUNTS[template]} 槽位 · 拖拽图表到槽位 · 点击槽位在左侧属性面板配置
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setPhase('template'); setTemplate(null); setSelectedSlotId(null); setCompositeSlotEdit(null); }}
                    className="px-2 py-1 text-[11px] text-[#9E9EA8] border border-[rgba(255,255,255,0.06)] rounded hover:text-[#E8E8EC] transition-colors"
                  >
                    ← 返回选模板
                  </button>
                  {slots.every(s => s.chartType) && (
                    <button
                      onClick={handleCommit}
                      className="px-3 py-1 text-[11px] font-medium text-[#2C2C34] bg-[#00D4FF] rounded hover:bg-[#00D4FF]/80 transition-colors"
                    >
                      ✓ 创建组件
                    </button>
                  )}
                </div>
              </div>

              <div
                className="flex-1 min-h-0"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${templateColumns(template)}, 1fr)`,
                  gridTemplateRows: `repeat(${templateRows(template)}, 1fr)`,
                  gridTemplateAreas: TEMPLATE_GRID_AREAS[template],
                  gap: '6px',
                }}
              >
                {slots.map((slot, i) => (
                  <SlotDropZone
                    key={slot.id}
                    slotIndex={i}
                    chartType={slot.chartType as CompositeSubChartType | null}
                    chartOptions={slot.chartOptions as Record<string, unknown>}
                    isSelected={slot.id === selectedSlotId}
                    onDrop={handleSlotDrop}
                    onClick={() => handleSlotClick(slot.id)}
                    onDelete={handleSlotDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
