import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { WidgetStyle } from '@hugescreen/shared';
import type { CompositeSubChartType, CompositeConfig } from '@hugescreen/shared';
import { SUB_CHART_LABELS, TEMPLATE_LABELS, getCompositeConfig } from '@hugescreen/widgets/composite';
import { ChevronDown, Ban } from 'lucide-react';
import { DataSourceEditor } from './DataSourceEditor';

/** 供复合槽位编辑时展示的图表专属配置（与画布组件编辑器相同） */
function SlotChartEditors({
  chartType,
  opts,
  onUpdate,
}: {
  chartType: CompositeSubChartType;
  opts: Record<string, unknown>;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      {/* 折线图 */}
      {chartType === 'line-chart' && (
        <>
          <CollapsibleFieldGroup label="折线" defaultOpen={false}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">平滑曲线</span>
              <input type="checkbox" checked={!!opts.smooth}
                onChange={(e) => onUpdate({ smooth: e.target.checked })} className="rounded" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">面积填充</span>
              <input type="checkbox" checked={!!opts.showArea}
                onChange={(e) => onUpdate({ showArea: e.target.checked })} className="rounded" />
            </label>
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="数据" defaultOpen={false}>
            <LineChartDataEditor
              xLabels={Array.isArray(opts.xLabels) ? opts.xLabels as string[] : ['周一','周二','周三','周四','周五','周六','周日']}
              lineSeries={Array.isArray(opts.lineSeries) ? opts.lineSeries as any[] : [{ name: '系列1', data: [120,200,150,80,70,110,130] }]}
              onChange={(xLabels, lineSeries) => onUpdate({ xLabels, lineSeries })} />
          </CollapsibleFieldGroup>
        </>
      )}

      {/* 柱状图 */}
      {chartType === 'bar-chart' && (
        <>
          <CollapsibleFieldGroup label="柱体" defaultOpen={false}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">条形图</span>
              <input type="checkbox" checked={opts.direction === 'horizontal'}
                onChange={(e) => onUpdate({ direction: e.target.checked ? 'horizontal' : 'vertical' })} className="rounded" />
            </label>
            <LabelSelectRow label="粗细" value={String(opts.barWidth ?? '50%')}
              options={['30%','50%','70%','90%']}
              onChange={(v) => onUpdate({ barWidth: v })} />
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="数值" defaultOpen={false}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">显示数值</span>
              <input type="checkbox" checked={!!opts.showLabel}
                onChange={(e) => onUpdate({ showLabel: e.target.checked })} className="rounded" />
            </label>
            <LabelSelectRow label="字号" value={String(opts.labelFontSize ?? '10px')}
              options={['8px','10px','12px','14px','16px','18px','20px']}
              onChange={(v) => onUpdate({ labelFontSize: v })} />
            <LabelSelectRow label="字重" value={String(opts.labelFontWeight ?? '600')}
              options={['400','500','600','700','800']}
              onChange={(v) => onUpdate({ labelFontWeight: v })} />
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">颜色</span>
              <span className="flex items-center gap-1.5">
                <input type="color" value={String(opts.labelColor ?? '#FF8C42')}
                  onChange={(e) => onUpdate({ labelColor: e.target.value })}
                  className="w-6 h-6 rounded border border-[rgba(255,255,255,0.06)] bg-transparent cursor-pointer p-0" />
                <input type="text" value={String(opts.labelColor ?? '#FF8C42')}
                  onChange={(e) => onUpdate({ labelColor: e.target.value })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </span>
            </label>
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="数据" defaultOpen={false}>
            <BarCategoriesEditor
              categories={Array.isArray(opts.categories) && opts.categories.length > 0
                ? opts.categories as any[] : [{ name: '类别A', value: 182 }, { name: '类别B', value: 234 }, { name: '类别C', value: 165 }, { name: '类别D', value: 298 }, { name: '类别E', value: 210 }]}
              onChange={(cats) => onUpdate({ categories: cats })} />
          </CollapsibleFieldGroup>
        </>
      )}

      {/* 柱线组合图 */}
      {chartType === 'bar-line-chart' && (
        <CollapsibleFieldGroup label="柱线" defaultOpen={false}>
          <label className="flex items-center justify-between">
            <span className="text-[11px] text-textSecondary/70">平滑曲线</span>
            <input type="checkbox" checked={!!opts.smooth}
              onChange={(e) => onUpdate({ smooth: e.target.checked })} className="rounded" />
          </label>
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">面积填充</span>
            <input type="checkbox" checked={!!opts.showArea}
              onChange={(e) => onUpdate({ showArea: e.target.checked })} className="rounded" />
          </label>
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">显示数值</span>
            <input type="checkbox" checked={!!opts.showLabel}
              onChange={(e) => onUpdate({ showLabel: e.target.checked })} className="rounded" />
          </label>
          <LabelSelectRow label="柱宽" value={String(opts.barWidth ?? '50%')}
            options={['30%','50%','70%','90%']}
            onChange={(v) => onUpdate({ barWidth: v })} />
        </CollapsibleFieldGroup>
      )}

      {/* 统计卡 */}
      {chartType === 'stat-card' && (
        <CollapsibleFieldGroup label="统计卡" defaultOpen={false}>
          <label className="flex items-center justify-between">
            <span className="text-[11px] text-textSecondary/70">占比环</span>
            <input type="checkbox" checked={!!opts.showRing}
              onChange={(e) => onUpdate({ showRing: e.target.checked })} className="rounded" />
          </label>
          {!!opts.showRing && (
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">占比(%)</span>
              <input type="number" value={Number(opts.ringPercent ?? 0)}
                onChange={(e) => onUpdate({ ringPercent: Number(e.target.value) })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
          )}
          <label className="flex flex-col gap-1 mt-2">
            <span className="text-[11px] text-textSecondary/70">数据名</span>
            <input type="text" value={String(opts.title ?? '')}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors"
              placeholder="指标名称" />
          </label>
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">数值</span>
            <input type="number" value={Number(opts.value ?? 0)}
              onChange={(e) => onUpdate({ value: Number(e.target.value) })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
          </label>
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">单位</span>
            <input type="text" value={String(opts.suffix ?? '')}
              onChange={(e) => onUpdate({ suffix: e.target.value })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
          </label>
          <ColorSwatchRow label="数值颜色" value={opts.valueColor ?? "#FFFFFF"} colors={PRESET_VALUE_COLORS} onChange={(c) => onUpdate({ valueColor: c })} />
          <ColorSwatchRow label="单位颜色" value={opts.suffixColor ?? "#9E9EA8"} colors={PRESET_SUFFIX_COLORS} onChange={(c) => onUpdate({ suffixColor: c })} />
        </CollapsibleFieldGroup>
      )}

      {/* 文本 */}
      {chartType === 'text-widget' && (
        <CollapsibleFieldGroup label="文本" defaultOpen={true}>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">文字内容</span>
            <textarea rows={3} value={String(opts.text ?? '')}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors resize-y"
              placeholder="输入文字" />
          </label>
          <LabelSelectRow label="字号" value={String(opts.fontSize ?? '16px')}
            options={['12px','14px','16px','18px','20px','24px','28px','32px','40px','48px']}
            onChange={(v) => onUpdate({ fontSize: v })} />
          <LabelSelectRow label="字重" value={String(opts.fontWeight ?? '400')}
            options={['300','400','500','600','700','800']}
            onChange={(v) => onUpdate({ fontWeight: v })} />
          <LabelSelectRow label="斜体" value={String(opts.fontStyle ?? 'normal')}
            options={['normal','italic']} labels={['否','是']}
            onChange={(v) => onUpdate({ fontStyle: v })} />
          <LabelSelectRow label="对齐" value={String(opts.textAlign ?? 'center')}
            options={['left','center','right']} labels={['左','中','右']}
            onChange={(v) => onUpdate({ textAlign: v })} />
          <label className="flex items-center justify-between">
            <span className="text-[11px] text-textSecondary/70">颜色</span>
            <span className="flex items-center gap-1.5">
              <input type="color" value={String(opts.color ?? '#E8E8EC')}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="w-6 h-6 rounded border border-[rgba(255,255,255,0.06)] bg-transparent cursor-pointer p-0" />
              <input type="text" value={String(opts.color ?? '#E8E8EC')}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </span>
          </label>
        </CollapsibleFieldGroup>
      )}

      {/* 图片 */}
      {chartType === 'image-widget' && (
        <CollapsibleFieldGroup label="图片" defaultOpen={true}>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">图片文件 (JPG/PNG)</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => onUpdate({ src: reader.result });
                reader.readAsDataURL(file);
              }}
              className="text-[11px] text-textSecondary/70 file:mr-2 file:py-1 file:px-2 file:text-[11px] file:rounded file:border file:border-[rgba(0,212,255,0.2)] file:bg-surface-hover file:text-textSecondary hover:file:text-text file:cursor-pointer" />
          </label>
          {opts.src && (
            <button onClick={() => onUpdate({ src: undefined })}
              className="text-[11px] text-negative/60 hover:text-negative mt-1"
            >移除图片</button>
          )}
          <LabelSelectRow label="填充方式" value={String(opts.fit ?? 'contain')}
            options={['contain','cover','fill']} labels={['适配','裁剪','拉伸']}
            onChange={(v) => onUpdate({ fit: v })} />
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">透明度</span>
            <input type="range" min="0.1" max="1" step="0.05"
              value={Number(opts.opacity ?? 1)}
              onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
              className="w-24" />
          </label>
        </CollapsibleFieldGroup>
      )}

      {/* 饼图 */}
      {chartType === 'pie-chart' && (
        <>
          <CollapsibleFieldGroup label="图名" defaultOpen={false}>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-textSecondary/70">文字</span>
              <input type="text" value={String(opts.titleText ?? '')}
                onChange={(e) => onUpdate({ titleText: e.target.value })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors"
                placeholder="输入图表名" />
            </label>
            <LabelSelectRow label="位置" value={String(opts.titlePosition ?? 'none')}
              options={['none', 'topLeft', 'bottom']}
              labels={['无', '左上角', '底部']}
              onChange={(v) => onUpdate({ titlePosition: v })} />
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">颜色图例</span>
              <input type="checkbox" checked={opts.showColorLegend !== false}
                onChange={(e) => onUpdate({ showColorLegend: e.target.checked })} className="rounded" />
            </label>
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="数据" defaultOpen={false}>
            <BarCategoriesEditor
              showLabelLineToggle
              categories={Array.isArray(opts.categories) && opts.categories.length > 0
                ? opts.categories as any[] : [{ name: '类别A', value: 335 }, { name: '类别B', value: 310 }, { name: '类别C', value: 234 }, { name: '类别D', value: 135 }, { name: '类别E', value: 548 }]}
              onChange={(cats) => onUpdate({ categories: cats })} />
          </CollapsibleFieldGroup>
        </>
      )}
    </>
  );
}

/** 地图钉类型编辑器 */
function PinTypeEditor({ pinTypes, onChange }: { pinTypes: any[]; onChange: (pts: any[]) => void }) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors';
  const icons = ['circle', 'diamond', 'pin', 'square', 'triangle', 'hex', 'pulse', 'tower'] as const;
  const iconLabels: Record<string, string> = { circle: '圆形', diamond: '菱形', pin: '图钉', square: '方形', triangle: '三角', hex: '六边形', pulse: '脉冲', tower: '基站' };
  const colors = ['#00D4FF', '#FF8C42', '#34d399', '#f87171', '#c084fc', '#fbbf24'];

  return (
    <div className="space-y-2">
      <button
        onClick={() => onChange([...pinTypes, { id: 'pt_' + Date.now(), name: '', icon: 'circle', color: '#FF8C42' }])}
        className="w-full text-[11px] py-1.5 rounded border border-[rgba(0,212,255,0.15)] text-accent-cool/70 hover:text-accent-cool transition-colors"
      >+ 添加类型</button>
      {pinTypes.map((pt: any, i: number) => (
        <div key={pt.id ?? i} className="flex items-center gap-1.5 flex-wrap p-1.5 rounded bg-surface-base/50">
          <input type="text" value={pt.name ?? ''} placeholder="名称"
            onChange={(e) => { const next = [...pinTypes]; next[i] = { ...pt, name: e.target.value }; onChange(next); }}
            className={`${inputCls} flex-1 min-w-0 w-16`} />
          <div className="flex gap-0.5">
            {icons.map((ic) => (
              <button key={ic} title={iconLabels[ic]}
                onClick={() => { const next = [...pinTypes]; next[i] = { ...pt, icon: ic }; onChange(next); }}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[15px] leading-none transition-colors ${pt.icon === ic ? 'bg-accent-cool/15 text-accent-cool' : 'text-textSecondary/30 hover:text-textSecondary/60'}`}
              >{ic === 'circle' ? '●' : ic === 'diamond' ? '◆' : ic === 'pin' ? '📍' : ic === 'square' ? '■' : ic === 'triangle' ? '▲' : ic === 'hex' ? '⬢' : ic === 'pulse' ? '◎' : '△'}</button>
            ))}
          </div>
          <div className="flex gap-0.5">
            {colors.map((c) => (
              <button key={c}
                onClick={() => { const next = [...pinTypes]; next[i] = { ...pt, color: c }; onChange(next); }}
                className="w-4 h-4 rounded-full border transition-colors"
                style={{ backgroundColor: c, borderColor: pt.color === c ? '#fff' : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
          <button
            onClick={() => onChange(pinTypes.filter((_: any, j: number) => j !== i))}
            className="text-textSecondary/30 hover:text-negative text-sm leading-none px-0.5"
          >×</button>
        </div>
      ))}
    </div>
  );
}

/** 地图钉实例编辑器 */
function PinInstanceEditor({ pinInstances, pinTypes, onChange }: { pinInstances: any[]; pinTypes: any[]; onChange: (pis: any[]) => void }) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors';

  return (
    <div className="space-y-2">
      {pinTypes.length === 0 && (
        <p className="text-[10px] text-textSecondary/40">请先添加地图钉类型</p>
      )}
      <button
        onClick={() => onChange([...pinInstances, { id: 'pi_' + Date.now(), pinTypeId: pinTypes[0]?.id ?? '', lat: 32.2, lng: 119.4 }])}
        disabled={pinTypes.length === 0}
        className="w-full text-[11px] py-1.5 rounded border border-[rgba(0,212,255,0.15)] text-accent-cool/70 hover:text-accent-cool transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >+ 添加实例</button>
      {pinInstances.map((pi: any, i: number) => {
        const pt = pinTypes.find((t: any) => t.id === pi.pinTypeId);
        return (
          <div key={pi.id ?? i} className="flex items-center gap-1 flex-wrap p-1.5 rounded bg-surface-base/50">
            <select value={pi.pinTypeId ?? ''}
              onChange={(e) => { const next = [...pinInstances]; next[i] = { ...pi, pinTypeId: e.target.value }; onChange(next); }}
              className={`${inputCls} flex-1 min-w-0`}>
              {pinTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.icon === 'circle' ? '●' : t.icon === 'diamond' ? '◆' : t.icon === 'pin' ? '📍' : t.icon === 'square' ? '■' : t.icon === 'triangle' ? '▲' : t.icon === 'hex' ? '⬢' : t.icon === 'pulse' ? '◎' : '△'} {t.name || '(未命名)'}</option>
              ))}
            </select>
            <input type="number" step="0.001" value={pi.lat ?? 0} placeholder="纬度"
              onChange={(e) => { const next = [...pinInstances]; next[i] = { ...pi, lat: Number(e.target.value) }; onChange(next); }}
              className={`${inputCls} w-16 font-mono`} />
            <input type="number" step="0.001" value={pi.lng ?? 0} placeholder="经度"
              onChange={(e) => { const next = [...pinInstances]; next[i] = { ...pi, lng: Number(e.target.value) }; onChange(next); }}
              className={`${inputCls} w-16 font-mono`} />
            <button
              onClick={() => onChange(pinInstances.filter((_: any, j: number) => j !== i))}
              className="text-textSecondary/30 hover:text-negative text-sm leading-none px-0.5"
            >×</button>
          </div>
        );
      })}
    </div>
  );
}

/** 已知属性 key → 可选值列表（渲染为下拉菜单） */
const SELECT_OPTIONS: Record<string, string[]> = {
  fontSize:  ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px', '56px', '64px', '72px'],
  fontWeight: ['300', '400', '500', '600', '700', '800'],
  fontStyle: ['normal', 'italic'],
  textAlign: ['left', 'center', 'right'],
};

/** 已知属性 key → 中文标签 */
const PROP_LABELS: Record<string, string> = {
  text: '标题文字',
  fontSize: '字号',
  fontWeight: '字重',
  fontStyle: '斜体',
  color: '文字颜色',
  textAlign: '对齐',
  showSeconds: '显示秒',
  borderStyle: '边框',
};

/** 顶栏边框样式选项（与一般组件边框独立） */
const HEADER_BORDER_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'header-style1', label: 'HUD-1' },
  { value: 'header-style2', label: 'HUD-2' },
];

/**
 * 属性配置面板
 * 选中普通组件 → 显示组件属性
 * 选中顶栏槽位 → 显示顶栏元素属性
 */
export function PropertyInspector() {
  const {
    config, selectedWidgetId, selectedHeaderSlotId,
    updateWidget, setHeaderSlot,
    compositeSlotEdit, setCompositeSlotEdit,
    pinEditWidgetId, setPinEditWidgetId, selectWidget,
  } = useEditorStore();

  // ─── 组合图表槽位编辑（构建窗口中选中了子图表）───
  if (compositeSlotEdit) {
    const { chartType, options: opts, onUpdate, dataSource, onUpdateDataSource } = compositeSlotEdit;
    // Check if a canvas widget was displaced
    const displacedWidget = config.widgets.find(w => w.id === selectedWidgetId);
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setCompositeSlotEdit(null)}
            className="text-[11px] text-accent-cool hover:text-accent-cool/70 transition-colors"
          >
            ← 返回构建
          </button>
          <h2 className="text-sm font-semibold text-textSecondary uppercase tracking-wider">
            槽位配置
          </h2>
        </div>
        {displacedWidget && (
          <div className="mb-3 px-2 py-1.5 rounded bg-[rgba(0,212,255,0.04)] border border-[rgba(0,212,255,0.08)] text-[10px] text-textSecondary/50">
            已暂停编辑画布组件「{displacedWidget.displayName}」— 关闭构建窗口或取消选中槽位后恢复
          </div>
        )}
        <div className="space-y-4">
          <FieldGroup label="信息">
            <div className="text-xs text-textSecondary/60 space-y-1">
              <div className="flex justify-between py-0.5">
                <span>类型</span>
                <span className="font-mono text-accent-cool">{SUB_CHART_LABELS[chartType] ?? chartType}</span>
              </div>
            </div>
          </FieldGroup>

          <SlotChartEditors chartType={chartType} opts={opts} onUpdate={onUpdate} />

          {onUpdateDataSource && (
            <CollapsibleFieldGroup label="数据源" defaultOpen={false}>
              <DataSourceEditor
                dataSource={dataSource}
                chartType={chartType}
                onChange={onUpdateDataSource}
              />
            </CollapsibleFieldGroup>
          )}
        </div>
      </div>
    );
  }

  // ─── 顶栏槽位编辑 ───
  const headerSlot = selectedHeaderSlotId
    ? config.header.slots.find((s) => s.id === selectedHeaderSlotId)
    : undefined;

  if (headerSlot && headerSlot.elementType) {
    const elDef = headerElementRegistry.get(headerSlot.elementType);
    return (
      <div className="p-3">
        <h2 className="text-sm font-semibold text-textSecondary uppercase tracking-wider px-2 mb-3">
          顶栏属性
        </h2>
        <div className="space-y-4">
          <FieldGroup label="信息">
            <div className="text-xs text-textSecondary/60">
              <div className="flex justify-between py-1">
                <span>类型</span>
                <span className="font-mono">{headerSlot.elementType}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>名称</span>
                <span className="font-mono">{elDef?.name ?? '-'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>宽度</span>
                <span className="font-mono">{headerSlot.colSpan} 列</span>
              </div>
            </div>
          </FieldGroup>

          {/* 动态配置项 */}
          {elDef?.defaultConfig && Object.keys(elDef.defaultConfig).length > 0 && (
            <FieldGroup label="配置">
              {Object.entries(elDef.defaultConfig).map(([key, defaultValue]) => {
                const currentValue = (headerSlot.options as Record<string, unknown>)[key] ?? defaultValue;
                const label = PROP_LABELS[key] ?? key;
                const isBool = typeof defaultValue === 'boolean';
                const selectOptions = SELECT_OPTIONS[key];
                const isColor = key === 'color';
                const isBorderStyle = key === 'borderStyle';

                const update = (newValue: unknown) =>
                  setHeaderSlot(headerSlot.id, headerSlot.elementType, {
                    ...headerSlot.options,
                    [key]: newValue,
                  });

                return (
                  <label key={key} className="flex items-center justify-between">
                    <span className="text-[11px] text-textSecondary/70 flex-shrink-0">{label}</span>
                    {isBool ? (
                      <input type="checkbox" checked={!!currentValue}
                        onChange={(e) => update(e.target.checked)} className="rounded" />
                    ) : isColor ? (
                      <span className="flex items-center gap-1.5">
                        <input type="color" value={String(currentValue ?? '#ffffff')}
                          onChange={(e) => update(e.target.value)}
                          className="w-6 h-6 rounded border border-[rgba(255,255,255,0.06)] bg-transparent cursor-pointer p-0" />
                        <input type="text" value={String(currentValue ?? '')}
                          onChange={(e) => update(e.target.value)}
                          className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
                      </span>
                    ) : isBorderStyle ? (
                      <select value={String(currentValue ?? 'none')}
                        onChange={(e) => update(e.target.value)}
                        className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors text-right appearance-none cursor-pointer" >
                        {HEADER_BORDER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : selectOptions ? (
                      <select value={String(currentValue ?? '')}
                        onChange={(e) => update(e.target.value)}
                        className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors text-right appearance-none cursor-pointer" >
                        {selectOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={String(currentValue ?? '')}
                        onChange={(e) => update(e.target.value)}
                        className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 w-32 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
                    )}
                  </label>
                );
              })}
            </FieldGroup>
          )}
        </div>
      </div>
    );
  }

  // ─── 普通组件编辑 ───
  const widget = config.widgets.find((w) => w.id === selectedWidgetId);

  if (!widget) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-4">
          属性
        </h2>
        <p className="text-xs text-textSecondary opacity-60 text-center py-8">
          选择一个组件或顶栏槽位以编辑其属性
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <h2 className="text-sm font-semibold text-textSecondary uppercase tracking-wider px-2 mb-3">
        属性
      </h2>

      <div className="space-y-4">
        {/* ═══ 信息 ═══ */}
        <CollapsibleFieldGroup label="信息" defaultOpen={true}>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">组件名称</span>
            <input
              type="text"
              value={widget.displayName}
              onChange={(e) => updateWidget(widget.id, { displayName: e.target.value })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors"
            />
          </label>
          <div className="text-xs text-textSecondary/60 space-y-1">
            <div className="flex justify-between py-0.5">
              <span>类型</span>
              <span className="font-mono">{widget.type}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>位置</span>
              <span className="font-mono">({widget.layout.col}, {widget.layout.row})</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>尺寸</span>
              <span className="font-mono">{widget.layout.colSpan}×{widget.layout.rowSpan}</span>
            </div>
          </div>
        </CollapsibleFieldGroup>

        {/* ═══ 标题配置 ═══ */}
        <CollapsibleFieldGroup label="标题" defaultOpen={true}>
          <TitleRow
            label="一级标题"
            value={widget.style.title?.primary?.text ?? ''}
            onChange={(text) => updateWidget(widget.id, {
              style: { ...widget.style, title: { ...widget.style.title, primary: text ? { text } : undefined } },
            })}
            onRemove={() => updateWidget(widget.id, {
              style: { ...widget.style, title: { ...widget.style.title, primary: undefined } },
            })}
            hasSecondary={!!widget.style.title?.secondary}
          />
          <TitleRow
            label="二级标题"
            value={widget.style.title?.secondary?.text ?? ''}
            onChange={(text) => updateWidget(widget.id, {
              style: { ...widget.style, title: { ...widget.style.title, secondary: text ? { text } : undefined } },
            })}
            onRemove={() => updateWidget(widget.id, {
              style: { ...widget.style, title: { ...widget.style.title, secondary: undefined } },
            })}
            hasPrimary={!!widget.style.title?.primary}
          />
        </CollapsibleFieldGroup>

        {/* ═══ 组合图表 — 只读摘要 ═══ */}
        {widget.type.startsWith('composite-') && (() => {
          const comp: CompositeConfig | undefined = getCompositeConfig(widget.type);
          if (!comp) return null;
          const slots = comp.slots ?? [];
          return (
            <CollapsibleFieldGroup label="组合配置" defaultOpen={true}>
              <div className="text-xs text-textSecondary/60 space-y-2">
                <div className="flex justify-between py-0.5">
                  <span>布局</span>
                  <span className="font-mono text-accent-cool">
                    {TEMPLATE_LABELS[comp.layoutTemplate as keyof typeof TEMPLATE_LABELS] ?? comp.layoutTemplate}
                  </span>
                </div>
                <div className="border-t border-[rgba(255,255,255,0.04)] pt-2">
                  {slots.map((slot: any, i: number) => (
                    <div key={slot.id} className="flex justify-between py-1">
                      <span className="text-[11px]">槽位 {String.fromCharCode(65 + i)}</span>
                      <span className="font-mono text-[11px]">
                        {SUB_CHART_LABELS[slot.chartType as CompositeSubChartType] ?? slot.chartType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleFieldGroup>
          );
        })()}

        {/* ═══ 柱状图专属配置 ═══ */}
        {widget.type === 'bar-chart' && (
          <>
            <CollapsibleFieldGroup label="柱体" defaultOpen={false}>
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">条形图</span>
                <input type="checkbox"
                  checked={(widget.options as Record<string, unknown>).direction === 'horizontal'}
                  onChange={(e) => updateWidget(widget.id, {
                    options: { ...(widget.options as object), direction: e.target.checked ? 'horizontal' : 'vertical' },
                  })}
                  className="rounded" />
              </label>
              <LabelSelectRow label="粗细" value={String((widget.options as any).barWidth ?? '50%')}
                options={['30%','50%','70%','90%']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), barWidth: v } })} />
            </CollapsibleFieldGroup>

            <CollapsibleFieldGroup label="数值" defaultOpen={false}>
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">显示数值</span>
                <input type="checkbox"
                  checked={!!(widget.options as Record<string, unknown>).showLabel}
                  onChange={(e) => updateWidget(widget.id, {
                    options: { ...(widget.options as object), showLabel: e.target.checked },
                  })}
                  className="rounded" />
              </label>
              <LabelSelectRow label="字号" value={String((widget.options as any).labelFontSize ?? '10px')}
                options={['8px','10px','12px','14px','16px','18px','20px']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), labelFontSize: v } })} />
              <LabelSelectRow label="字重" value={String((widget.options as any).labelFontWeight ?? '600')}
                options={['400','500','600','700','800']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), labelFontWeight: v } })} />
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">颜色</span>
                <span className="flex items-center gap-1.5">
                  <input type="color" value={String((widget.options as any).labelColor ?? '#FF8C42')}
                    onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), labelColor: e.target.value } })}
                    className="w-6 h-6 rounded border border-[rgba(255,255,255,0.06)] bg-transparent cursor-pointer p-0" />
                  <input type="text" value={String((widget.options as any).labelColor ?? '#FF8C42')}
                    onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), labelColor: e.target.value } })}
                    className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
                </span>
              </label>
            </CollapsibleFieldGroup>

            <CollapsibleFieldGroup label="数据" defaultOpen={false}>
              <BarCategoriesEditor
                categories={
                  Array.isArray((widget.options as any).categories) && (widget.options as any).categories.length > 0
                    ? (widget.options as any).categories
                    : [{ name: '类别A', value: 182 }, { name: '类别B', value: 234 }, { name: '类别C', value: 165 }, { name: '类别D', value: 298 }, { name: '类别E', value: 210 }]
                }
                onChange={(cats) => updateWidget(widget.id, {
                  options: { ...(widget.options as object), categories: cats },
                })}
              />
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 折线图专属配置 ═══ */}
        {widget.type === 'line-chart' && (
          <>
            <CollapsibleFieldGroup label="折线" defaultOpen={false}>
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">平滑曲线</span>
                <input type="checkbox"
                  checked={!!(widget.options as Record<string, unknown>).smooth}
                  onChange={(e) => updateWidget(widget.id, {
                    options: { ...(widget.options as object), smooth: e.target.checked },
                  })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">面积填充</span>
                <input type="checkbox"
                  checked={!!(widget.options as Record<string, unknown>).showArea}
                  onChange={(e) => updateWidget(widget.id, {
                    options: { ...(widget.options as object), showArea: e.target.checked },
                  })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>

            <CollapsibleFieldGroup label="数据" defaultOpen={false}>
              <LineChartDataEditor
                xLabels={Array.isArray((widget.options as any).xLabels) ? (widget.options as any).xLabels : ['周一','周二','周三','周四','周五','周六','周日']}
                lineSeries={Array.isArray((widget.options as any).lineSeries) ? (widget.options as any).lineSeries : [{ name: '系列1', data: [120,200,150,80,70,110,130] }]}
                onChange={(xLabels, lineSeries) => updateWidget(widget.id, {
                  options: { ...(widget.options as object), xLabels, lineSeries },
                })}
              />
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 饼图专属配置 ═══ */}
        {widget.type === 'pie-chart' && (
          <>
            <CollapsibleFieldGroup label="图名" defaultOpen={false}>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-textSecondary/70">文字</span>
                <input type="text" value={String((widget.options as any).titleText ?? '')}
                  onChange={(e) => updateWidget(widget.id, {
                    options: { ...(widget.options as object), titleText: e.target.value },
                  })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors"
                  placeholder="输入图表名" />
              </label>
              <LabelSelectRow label="位置" value={String((widget.options as any).titlePosition ?? 'none')}
                options={['none', 'topLeft', 'bottom']}
                labels={['无', '左上角', '底部']}
                onChange={(v) => updateWidget(widget.id, {
                  options: { ...(widget.options as object), titlePosition: v },
                })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">颜色图例</span>
                <input type="checkbox" checked={(widget.options as any).showColorLegend !== false}
                  onChange={(e) => updateWidget(widget.id, {
                    options: { ...(widget.options as object), showColorLegend: e.target.checked },
                  })} className="rounded" />
              </label>
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="数据" defaultOpen={false}>
              <BarCategoriesEditor
                showLabelLineToggle
                categories={
                  Array.isArray((widget.options as any).categories) && (widget.options as any).categories.length > 0
                    ? (widget.options as any).categories
                    : [{ name: '类别A', value: 335 }, { name: '类别B', value: 310 }, { name: '类别C', value: 234 }, { name: '类别D', value: 135 }, { name: '类别E', value: 548 }]
                }
                onChange={(cats) => updateWidget(widget.id, {
                  options: { ...(widget.options as object), categories: cats },
                })}
              />
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 柱线组合图专属配置 ═══ */}
        {widget.type === 'bar-line-chart' && (
          <CollapsibleFieldGroup label="柱线" defaultOpen={false}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">平滑曲线</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).smooth}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), smooth: e.target.checked } })}
                className="rounded" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">面积填充</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).showArea}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showArea: e.target.checked } })}
                className="rounded" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">显示数值</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).showLabel}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showLabel: e.target.checked } })}
                className="rounded" />
            </label>
            <LabelSelectRow label="柱宽" value={String((widget.options as Record<string, unknown>).barWidth ?? '50%')}
              options={['30%','50%','70%','90%']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), barWidth: v } })} />
          </CollapsibleFieldGroup>
        )}

        {/* ═══ 图片专属配置 ═══ */}
        {widget.type === 'image-widget' && (
          <CollapsibleFieldGroup label="图片" defaultOpen={true}>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-textSecondary/70">图片文件 (JPG/PNG)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    updateWidget(widget.id, { options: { ...(widget.options as object), src: reader.result } });
                  };
                  reader.readAsDataURL(file);
                }}
                className="text-[11px] text-textSecondary/70 file:mr-2 file:py-1 file:px-2 file:text-[11px] file:rounded file:border file:border-[rgba(0,212,255,0.2)] file:bg-surface-hover file:text-textSecondary hover:file:text-text file:cursor-pointer" />
            </label>
            {(widget.options as any).src && (
              <button
                onClick={() => updateWidget(widget.id, { options: { ...(widget.options as object), src: undefined } })}
                className="text-[11px] text-negative/60 hover:text-negative mt-1"
              >移除图片</button>
            )}
            <LabelSelectRow label="填充方式" value={String((widget.options as any).fit ?? 'contain')}
              options={['contain','cover','fill']}
              labels={['适配','裁剪','拉伸']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), fit: v } })} />
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">透明度</span>
              <input type="range" min="0.1" max="1" step="0.05"
                value={Number((widget.options as any).opacity ?? 1)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), opacity: Number(e.target.value) } })}
                className="w-24" />
            </label>
          </CollapsibleFieldGroup>
        )}

        {/* ═══ 文本专属配置 ═══ */}
        {widget.type === 'text-widget' && (
          <CollapsibleFieldGroup label="文本" defaultOpen={true}>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-textSecondary/70">文字内容</span>
              <textarea rows={3} value={String((widget.options as any).text ?? '')}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), text: e.target.value } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors resize-y"
                placeholder="输入文字" />
            </label>
            <LabelSelectRow label="字号" value={String((widget.options as any).fontSize ?? '16px')}
              options={['12px','14px','16px','18px','20px','24px','28px','32px','40px','48px']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), fontSize: v } })} />
            <LabelSelectRow label="字重" value={String((widget.options as any).fontWeight ?? '400')}
              options={['300','400','500','600','700','800']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), fontWeight: v } })} />
            <LabelSelectRow label="斜体" value={String((widget.options as any).fontStyle ?? 'normal')}
              options={['normal','italic']}
              labels={['否','是']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), fontStyle: v } })} />
            <LabelSelectRow label="对齐" value={String((widget.options as any).textAlign ?? 'center')}
              options={['left','center','right']}
              labels={['左','中','右']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), textAlign: v } })} />
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">颜色</span>
              <span className="flex items-center gap-1.5">
                <input type="color" value={String((widget.options as any).color ?? '#E8E8EC')}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), color: e.target.value } })}
                  className="w-6 h-6 rounded border border-[rgba(255,255,255,0.06)] bg-transparent cursor-pointer p-0" />
                <input type="text" value={String((widget.options as any).color ?? '#E8E8EC')}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), color: e.target.value } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </span>
            </label>
          </CollapsibleFieldGroup>
        )}

        {/* ═══ 统计卡专属配置 ═══ */}
        {widget.type === 'stat-card' && (
          <CollapsibleFieldGroup label="统计卡" defaultOpen={false}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">占比环</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).showRing}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showRing: e.target.checked } })}
                className="rounded" />
            </label>
            {!!(widget.options as Record<string, unknown>).showRing && (
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">占比(%)</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).ringPercent ?? 0)}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), ringPercent: Number(e.target.value) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
            )}
            <label className="flex flex-col gap-1 mt-2">
              <span className="text-[11px] text-textSecondary/70">数据名</span>
              <input type="text" value={String((widget.options as Record<string, unknown>).title ?? '')}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), title: e.target.value } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors"
                placeholder="指标名称" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">数值</span>
              <input type="number" value={Number((widget.options as Record<string, unknown>).value ?? 0)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), value: Number(e.target.value) } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">单位</span>
              <input type="text" value={String((widget.options as Record<string, unknown>).suffix ?? '')}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), suffix: e.target.value } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <ColorSwatchRow label="数值颜色" value={((widget.options as Record<string, unknown>).valueColor as string) ?? "#FFFFFF"} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), valueColor: c } })} />
            <ColorSwatchRow label="单位颜色" value={((widget.options as Record<string, unknown>).suffixColor as string) ?? "#9E9EA8"} colors={PRESET_SUFFIX_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), suffixColor: c } })} />
          </CollapsibleFieldGroup>
        )}

        {/* ═══ 赛博地图专属配置 ═══ */}
        {widget.type === 'cyber-map' && (
          <>
            <CollapsibleFieldGroup label="地图配置" defaultOpen={true}>
              <label className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-textSecondary/70">厚度</span>
                <input type="range" min={1} max={20} value={Number((widget.options as Record<string, unknown>).thickness ?? 3)}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), thickness: Number(e.target.value) } })}
                  className="w-24" />
                <span className="text-[11px] text-textSecondary/50 w-6 text-right font-mono">{(widget.options as Record<string, unknown>).thickness as number ?? 3}</span>
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">显示网格</span>
                <input type="checkbox" checked={Boolean((widget.options as Record<string, unknown>).showGrid ?? true)}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showGrid: e.target.checked } })} />
              </label>
            </CollapsibleFieldGroup>

            {/* ═══ 地图钉类型 ═══ */}
            <CollapsibleFieldGroup label="地图钉类型" defaultOpen={false}>
              <PinTypeEditor
                pinTypes={(widget.options as Record<string, unknown>).pinTypes as any[] ?? []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), pinTypes: pts } })}
              />
            </CollapsibleFieldGroup>

            {/* ═══ 地图钉实例 ═══ */}
            <CollapsibleFieldGroup label="地图钉实例" defaultOpen={false}>
              <PinInstanceEditor
                pinInstances={(widget.options as Record<string, unknown>).pinInstances as any[] ?? []}
                pinTypes={(widget.options as Record<string, unknown>).pinTypes as any[] ?? []}
                onChange={(pis) => updateWidget(widget.id, { options: { ...(widget.options as object), pinInstances: pis } })}
              />
            </CollapsibleFieldGroup>

            {/* ═══ 编辑地图钉按钮 ═══ */}
            <div className="mt-2">
              {pinEditWidgetId === widget.id ? (
                <button
                  onClick={() => setPinEditWidgetId(null)}
                  className="w-full text-[11px] py-1.5 rounded border border-accent-cool/50 text-accent-cool bg-accent-cool/5 hover:bg-accent-cool/10 transition-colors"
                >
                  ✓ 完成编辑
                </button>
              ) : (
                <button
                  onClick={() => {
                    selectWidget(widget.id);
                    setPinEditWidgetId(widget.id);
                  }}
                  className="w-full text-[11px] py-1.5 rounded border border-[rgba(0,212,255,0.25)] text-accent-cool hover:bg-accent-cool/5 transition-colors"
                >
                  ✏ 编辑地图钉位置
                </button>
              )}
            </div>
          </>
        )}

        {/* ═══ 数据源 ═══ */}
        <CollapsibleFieldGroup label="数据源" defaultOpen={false}>
          <DataSourceEditor
            dataSource={widget.dataSource}
            chartType={widget.type}
            onChange={(ds) => updateWidget(widget.id, { dataSource: ds })}
          />
        </CollapsibleFieldGroup>

        {/* ═══ 边框样式 ═══ */}
        <CollapsibleFieldGroup label="边框" defaultOpen={false}>
          <BorderStylePicker
            value={widget.style.borderStyle ?? 'none'}
            onChange={(v) => updateWidget(widget.id, {
              style: { ...widget.style, borderStyle: v as WidgetStyle['borderStyle'] },
            })}
          />
        </CollapsibleFieldGroup>

        <FieldGroup label="动效">
          <label className="flex items-center justify-between">
            <span className="text-[11px] text-textSecondary/70">启用动效</span>
            <input
              type="checkbox"
              checked={widget.animation.enabled}
              onChange={(e) =>
                updateWidget(widget.id, {
                  animation: { ...widget.animation, enabled: e.target.checked },
                })
              }
              className="rounded"
            />
          </label>
        </FieldGroup>
      </div>
    </div>
  );
}

/** 预设颜色色块选择器 */
const PRESET_VALUE_COLORS = ["#FFFFFF", "#00D4FF", "#FF8C42", "#34d399"];
const PRESET_SUFFIX_COLORS = ["#9E9EA8", "#00D4FF", "#FF8C42", "#34d399"];

function ColorSwatchRow({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <label className="flex items-center justify-between mt-2">
      <span className="text-[11px] text-textSecondary/70">{label}</span>
      <div className="flex gap-1">
        {colors.map((c) => (
          <button key={c} onClick={() => onChange(c)}
            className="w-5 h-5 rounded-full border-2 transition-colors"
            style={{ backgroundColor: c, borderColor: value === c ? "#00D4FF" : "rgba(255,255,255,0.1)" }}
          />
        ))}
      </div>
    </label>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-textSecondary/50 uppercase tracking-wider mb-2 px-1">
        {label}
      </div>
      <div className="bg-surface-base/50 rounded p-2 space-y-2">{children}</div>
    </div>
  );
}

/** 可折叠配置区 */
function CollapsibleFieldGroup({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-semibold text-textSecondary/50 uppercase tracking-wider mb-2 px-1 hover:text-textSecondary/70 transition-colors w-full text-left"
      >
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
        {label}
      </button>
      {open && (
        <div className="bg-surface-base/50 rounded p-2 space-y-2">{children}</div>
      )}
    </div>
  );
}

/** 下拉选择行 */
interface BarCategory { name: string; value: number; showLabelLine?: boolean; }

function BarCategoriesEditor({ categories, onChange, showLabelLineToggle }: { categories: BarCategory[]; onChange: (cats: BarCategory[]) => void; showLabelLineToggle?: boolean }) {
  const updateCat = (i: number, patch: Partial<BarCategory>) => {
    const next = categories.map((c, j) => (j === i ? { ...c, ...patch } : c));
    onChange(next);
  };
  const removeCat = (i: number) => {
    if (categories.length <= 1) return;
    onChange(categories.filter((_, j) => j !== i));
  };
  const addCat = () => {
    onChange([...categories, { name: `类别${categories.length + 1}`, value: 100, showLabelLine: false }]);
  };

  return (
    <div className="space-y-1.5">
      {categories.map((cat, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="text"
            value={cat.name}
            onChange={(e) => updateCat(i, { name: e.target.value })}
            className="w-[52px] bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors"
            placeholder="名称"
          />
          <input
            type="number"
            value={cat.value}
            onChange={(e) => updateCat(i, { value: Number(e.target.value) || 0 })}
            className="w-14 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right"
            placeholder="值"
          />
          {showLabelLineToggle && (
            <button
              onClick={() => updateCat(i, { showLabelLine: !(cat as any).showLabelLine })}
              className={`text-[10px] px-1 py-0.5 rounded transition-colors flex-shrink-0 ${
                (cat as any).showLabelLine
                  ? 'bg-[rgba(0,212,255,0.12)] text-[#00D4FF]'
                  : 'text-textSecondary/20 hover:text-textSecondary/50'
              }`}
              title="引出线标签"
            >↗</button>
          )}
          <button
            onClick={() => removeCat(i)}
            disabled={categories.length <= 1}
            className="text-textSecondary/30 hover:text-negative transition-colors text-xs px-0.5 disabled:opacity-20"
          >×</button>
        </div>
      ))}
      <button
        onClick={addCat}
        className="w-full text-[10px] py-1 rounded border border-dashed border-[rgba(255,255,255,0.08)] text-textSecondary/40 hover:text-accent-cool hover:border-accent-cool/30 transition-colors"
      >
        + 添加类别
      </button>
    </div>
  );
}

interface LineSeries { name: string; data: number[]; }

function LineChartDataEditor({
  xLabels, lineSeries, onChange,
}: {
  xLabels: string[];
  lineSeries: LineSeries[];
  onChange: (xLabels: string[], series: LineSeries[]) => void;
}) {
  const updateLabel = (i: number, val: string) => {
    const next = xLabels.map((l, j) => (j === i ? val : l));
    onChange(next, lineSeries);
  };
  const addLabel = () => onChange([...xLabels, `未定义${xLabels.length + 1}`], lineSeries);
  const removeLabel = (i: number) => {
    if (xLabels.length <= 1) return;
    // 删除标签时同步截断所有系列的数据
    const nextLabels = xLabels.filter((_, j) => j !== i);
    const nextSeries = lineSeries.map(s => ({ ...s, data: s.data.filter((_, j) => j !== i) }));
    onChange(nextLabels, nextSeries);
  };

  const updateSeriesName = (i: number, name: string) => {
    const next = lineSeries.map((s, j) => (j === i ? { ...s, name } : s));
    onChange(xLabels, next);
  };
  const updateSeriesData = (si: number, di: number, val: number) => {
    const next = lineSeries.map((s, j) => {
      if (j !== si) return s;
      const data = [...s.data];
      data[di] = val;
      return { ...s, data };
    });
    onChange(xLabels, next);
  };
  const addSeries = () => {
    const next = [...lineSeries, { name: `系列${lineSeries.length + 1}`, data: xLabels.map(() => 0) }];
    onChange(xLabels, next);
  };
  const removeSeries = (i: number) => {
    if (lineSeries.length <= 1) return;
    onChange(xLabels, lineSeries.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-3">
      {/* X 轴标签 */}
      <div>
        <div className="text-[10px] text-textSecondary/40 mb-1">X 轴标签</div>
        <div className="space-y-1">
          {xLabels.map((l, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-[10px] text-textSecondary/30 w-5 text-right">{i + 1}</span>
              <input type="text" value={l}
                onChange={(e) => updateLabel(i, e.target.value)}
                className="flex-1 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 text-[11px] text-text focus:outline-none focus:border-accent-cool/50 transition-colors" />
              <button onClick={() => removeLabel(i)} disabled={xLabels.length <= 1}
                className="text-textSecondary/30 hover:text-negative text-xs disabled:opacity-20">×</button>
            </div>
          ))}
        </div>
        <button onClick={addLabel}
          className="w-full text-[10px] py-0.5 mt-1 rounded border border-dashed border-[rgba(255,255,255,0.08)] text-textSecondary/40 hover:text-accent-cool hover:border-accent-cool/30 transition-colors">+ 标签</button>
      </div>

      {/* 数据系列 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-textSecondary/40">数据系列</span>
          <button onClick={addSeries}
            className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加系列</button>
        </div>
        {lineSeries.map((s, si) => (
          <div key={si} className="mb-2 bg-surface-base/30 rounded p-2">
            <div className="flex items-center gap-1 mb-1.5">
              <input type="text" value={s.name}
                onChange={(e) => updateSeriesName(si, e.target.value)}
                className="flex-1 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 text-[11px] text-accent-cool font-medium focus:outline-none focus:border-accent-cool/50 transition-colors" />
              <button onClick={() => removeSeries(si)} disabled={lineSeries.length <= 1}
                className="text-textSecondary/30 hover:text-negative text-xs disabled:opacity-20">×</button>
            </div>
            <div className="space-y-0.5">
              {xLabels.map((lbl, di) => (
                <div key={di} className="flex items-center gap-1">
                  <span className="text-[9px] text-textSecondary/25 w-12 truncate text-right" title={lbl}>{lbl}</span>
                  <input type="number" value={s.data[di] ?? 0}
                    onChange={(e) => updateSeriesData(si, di, Number(e.target.value) || 0)}
                    className="w-16 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 text-[11px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabelSelectRow({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-[11px] text-textSecondary/70">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors text-right appearance-none cursor-pointer">
        {options.map((opt, i) => <option key={opt} value={opt}>{labels?.[i] ?? opt}</option>)}
      </select>
    </label>
  );
}

/** 标题行：有值时显示输入框+删除按钮，无值时显示添加按钮 */
function TitleRow({
  label, value, onChange, onRemove, hasPrimary, hasSecondary,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onRemove: () => void;
  hasPrimary?: boolean;
  hasSecondary?: boolean;
}) {
  if (value || (hasPrimary !== undefined && hasSecondary !== undefined)) {
    // 已有标题 → 显示编辑
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-textSecondary/50 w-12 flex-shrink-0">{label}</span>
        {value ? (
          <>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={label}
              className="flex-1 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors min-w-0"
            />
            <button
              onClick={onRemove}
              className="text-[10px] text-textSecondary/30 hover:text-negative transition-colors flex-shrink-0 px-1"
              title={`删除${label}`}
            >
              ×
            </button>
          </>
        ) : (
          <span className="flex-1 text-[10px] text-textSecondary/30 italic">未设置</span>
        )}
      </div>
    );
  }

  // 无标题 → 显示添加按钮
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-textSecondary/50 w-12 flex-shrink-0">{label}</span>
      <button
        onClick={() => onChange(label === '一级标题' ? '主标题' : '副标题')}
        className="text-[10px] text-accent-cool/50 hover:text-accent-cool transition-colors"
      >
        + 添加
      </button>
    </div>
  );
}

/** 边框样式选择器 — SVG 缩略图预览 */
const BORDER_STYLES: { value: WidgetStyle['borderStyle']; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'style1', label: '电光蓝角标' },
  { value: 'style2', label: '琥珀橙扫描线' },
  { value: 'style3', label: '样式3' },
  { value: 'style4', label: '样式4' },
  { value: 'style5', label: '样式5' },
  { value: 'style6', label: '样式6' },
];

function BorderThumbnail({ style }: { style: WidgetStyle['borderStyle'] }) {
  const SIZE = 48;
  const PAD = 8;
  if (style === 'none') return <Ban size={18} strokeWidth={1.5} className="text-textSecondary/40" />;
  // 尚未实现的样式 → 占位符
  if (style === 'style3' || style === 'style4' || style === 'style5' || style === 'style6') {
    return <span className="text-[9px] text-textSecondary/30">即将推出</span>;
  }
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
      <rect x="0" y="0" width={SIZE} height={SIZE} rx="3" fill="#1E1E24" />
      {style === 'style1' && (
        <>
          {/* Beveled corners */}
          <path d={`M${PAD},${PAD+4} L${PAD+4},${PAD}`} stroke="#00D4FF" strokeWidth="0.8" fill="none" />
          <path d={`M${SIZE-PAD-4},${PAD} L${SIZE-PAD},${PAD+4}`} stroke="#00D4FF" strokeWidth="0.8" fill="none" />
          <path d={`M${SIZE-PAD},${SIZE-PAD-4} L${SIZE-PAD-4},${SIZE-PAD}`} stroke="#00D4FF" strokeWidth="0.8" fill="none" />
          <path d={`M${PAD+4},${SIZE-PAD} L${PAD},${SIZE-PAD-4}`} stroke="#00D4FF" strokeWidth="0.8" fill="none" />
          {/* Top line */}
          <line x1={PAD+6} y1={PAD-0.5} x2={SIZE-PAD-6} y2={PAD-0.5} stroke="#00D4FF" strokeWidth="0.8" />
          {/* Top ticks */}
          <line x1={SIZE-PAD-9} y1={PAD} x2={SIZE-PAD-9} y2={PAD+4} stroke="#00D4FF" strokeWidth="0.7" />
          <line x1={SIZE-PAD-12} y1={PAD} x2={SIZE-PAD-12} y2={PAD+4} stroke="#00D4FF" strokeWidth="0.7" />
          <line x1={SIZE-PAD-15} y1={PAD} x2={SIZE-PAD-15} y2={PAD+4} stroke="#00D4FF" strokeWidth="0.7" />
          {/* Bottom V arrows */}
          <path d={`M${SIZE-PAD-12},${SIZE-PAD} l2,2 l2,-2 l2,2 l2,-2`} stroke="#00D4FF" strokeWidth="0.7" fill="none" />
          {/* Bottom line */}
          <line x1={PAD+6} y1={SIZE-PAD+0.5} x2={SIZE-PAD-14} y2={SIZE-PAD+0.5} stroke="#00D4FF" strokeWidth="0.8" />
          {/* Left cross-lines */}
          <line x1={PAD} y1={PAD+14} x2={PAD+3} y2={PAD+14} stroke="#00D4FF" strokeWidth="0.6" />
          <line x1={PAD} y1={PAD+18} x2={PAD+3} y2={PAD+18} stroke="#00D4FF" strokeWidth="0.6" />
          <line x1={PAD} y1={PAD+22} x2={PAD+3} y2={PAD+22} stroke="#00D4FF" strokeWidth="0.6" />
          {/* Right cross-lines */}
          <line x1={SIZE-PAD-3} y1={PAD+14} x2={SIZE-PAD} y2={PAD+14} stroke="#00D4FF" strokeWidth="0.6" />
          <line x1={SIZE-PAD-3} y1={PAD+18} x2={SIZE-PAD} y2={PAD+18} stroke="#00D4FF" strokeWidth="0.6" />
          <line x1={SIZE-PAD-3} y1={PAD+22} x2={SIZE-PAD} y2={PAD+22} stroke="#00D4FF" strokeWidth="0.6" />
          {/* Inner layer hints */}
          <line x1={PAD+4} y1={PAD+3} x2={SIZE-PAD-8} y2={PAD+3} stroke="#00D4FF" strokeWidth="0.5" opacity="0.5" />
          <line x1={PAD+3} y1={PAD+6} x2={PAD+3} y2={SIZE-PAD-6} stroke="#00D4FF" strokeWidth="0.5" opacity="0.5" />
          {/* Bottom-left dots */}
          <circle cx={PAD+8} cy={SIZE-PAD-1} r={0.6} fill="#00D4FF" opacity="0.6" />
          <circle cx={PAD+12} cy={SIZE-PAD-1} r={0.6} fill="#00D4FF" opacity="0.6" />
          <circle cx={PAD+16} cy={SIZE-PAD-1} r={0.6} fill="#00D4FF" opacity="0.6" />
        </>
      )}
      {style === 'style2' && (
        <>
          {/* L corners */}
          <polyline points={`${PAD},${PAD+5} ${PAD},${PAD} ${PAD+5},${PAD}`} stroke="#00D4FF" strokeWidth="1.5" fill="none" />
          <polyline points={`${SIZE-PAD-5},${PAD} ${SIZE-PAD},${PAD} ${SIZE-PAD},${PAD+5}`} stroke="#00D4FF" strokeWidth="1.5" fill="none" />
          <polyline points={`${PAD},${SIZE-PAD-5} ${PAD},${SIZE-PAD} ${PAD+5},${SIZE-PAD}`} stroke="#00D4FF" strokeWidth="1.5" fill="none" />
          <polyline points={`${SIZE-PAD-5},${SIZE-PAD} ${SIZE-PAD},${SIZE-PAD} ${SIZE-PAD},${SIZE-PAD-5}`} stroke="#00D4FF" strokeWidth="1.5" fill="none" />
          {/* Top/bottom lines */}
          <line x1={PAD+8} y1={PAD} x2={SIZE-PAD-8} y2={PAD} stroke="#00D4FF" strokeWidth="1" />
          <line x1={PAD+8} y1={SIZE-PAD} x2={SIZE-PAD-8} y2={SIZE-PAD} stroke="#00D4FF" strokeWidth="1" />
          {/* Corner dots */}
          <circle cx={PAD} cy={PAD} r="1.5" fill="#00D4FF" />
          <circle cx={SIZE-PAD} cy={PAD} r="1.5" fill="#00D4FF" />
          <circle cx={PAD} cy={SIZE-PAD} r="1.5" fill="#00D4FF" />
          <circle cx={SIZE-PAD} cy={SIZE-PAD} r="1.5" fill="#00D4FF" />
          {/* Center triangle */}
          <polygon points={`${SIZE/2-3},${PAD} ${SIZE/2},${PAD+3} ${SIZE/2+3},${PAD}`} fill="#00D4FF" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

function BorderStylePicker({ value, onChange }: { value: WidgetStyle['borderStyle']; onChange: (v: WidgetStyle['borderStyle']) => void }) {
  return (
    <div className="flex gap-2 px-1 flex-wrap">
      {BORDER_STYLES.map((s) => {
        const active = (value ?? 'none') === s.value;
        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            title={s.label}
            className={`relative w-14 h-12 rounded-md border flex flex-col items-center justify-center transition-all flex-shrink-0 ${
              active
                ? 'border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40'
                : 'border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-[rgba(255,255,255,0.15)]'
            }`}
          >
            <BorderThumbnail style={s.value} />
            <span className="text-[8px] text-textSecondary/40 mt-0.5 leading-none">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
