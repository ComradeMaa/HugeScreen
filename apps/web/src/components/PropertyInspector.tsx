import { useState, useEffect } from 'react';
import { useEditorStore, stageUploadFile } from '../store/editorStore';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { WidgetStyle } from '@hugescreen/shared';
import type { CompositeSubChartType, CompositeConfig } from '@hugescreen/shared';
import { getSubChartLabel, TEMPLATE_LABELS, getCompositeConfig } from '@hugescreen/widgets/composite';
import { ChevronDown, Ban } from 'lucide-react';
import { DataSourceEditor } from './DataSourceEditor';
import { ICON_PRESET_KEYS, IconPresetRenderer } from '@hugescreen/widgets/stat-card/IconPresets';
import { getPinIconKeys, getPinIconLabel, PIN_ICON_PATHS, getPinCustomIcon } from '@hugescreen/widgets/geo';

/** 图片类预设图标（URL 路径） */
const IMAGE_ICON_PRESETS = [
  { key: 'server-rack', label: '服务器机柜', url: '/presets/icons/server-rack.svg' },
];

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
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
              <input type="checkbox" checked={(opts.showTick as boolean) ?? true}
                onChange={(e) => onUpdate({ showTick: e.target.checked })} className="rounded" />
            </label>
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
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
            <input type="checkbox" checked={(opts.showTick as boolean) ?? true}
              onChange={(e) => onUpdate({ showTick: e.target.checked })} className="rounded" />
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
            <span className="text-[11px] text-textSecondary/70">显示图标</span>
            <input type="checkbox" checked={!!opts.showIcon}
              onChange={(e) => onUpdate({ showIcon: e.target.checked, showRing: e.target.checked ? false : opts.showRing })} className="rounded" />
          </label>
          {!!opts.showIcon && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2 flex-wrap">
                {ICON_PRESET_KEYS.map((key) => {
                  const active = opts.customIconImage === 'supercons:' + key;
                  return (
                    <button key={key}
                      onClick={() => onUpdate({ customIconImage: active ? undefined : 'supercons:' + key })}
                      title={key}
                      className={`w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                        active ? 'border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40'
                               : 'border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-accent-cool/50 hover:bg-accent-cool/5'
                      }`}
                      style={{ color: '#00D4FF' }}
                    >
                      <IconPresetRenderer name={key} size={20} />
                    </button>
                  );
                })}
                {IMAGE_ICON_PRESETS.map((p) => {
                  const active = opts.customIconImage === p.url;
                  return (
                    <button key={p.key}
                      onClick={() => onUpdate({ customIconImage: active ? undefined : p.url })}
                      title={p.label}
                      className={`w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                        active ? 'border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40'
                               : 'border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-accent-cool/50 hover:bg-accent-cool/5'
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="w-5 h-5 object-contain" />
                    </button>
                  );
                })}
                {opts.customIconImage && !String(opts.customIconImage).startsWith('supercons:') && !IMAGE_ICON_PRESETS.some(p => p.url === opts.customIconImage) ? (
                  <button onClick={() => onUpdate({ customIconImage: undefined })}
                    className="w-9 h-9 rounded-md border border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40 flex flex-col items-center justify-center flex-shrink-0"
                  >
                    <img src={String(opts.customIconImage)} alt="" className="w-5 h-5 object-contain rounded" />
                  </button>
                ) : (
                  <label className="w-9 h-9 rounded-md border border-dashed border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-accent-cool/50 hover:bg-accent-cool/5 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer">
                    <span className="text-[10px] text-textSecondary/30">+</span>
                    <input type="file" accept=".png,.jpg,.jpeg,.svg" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = stageUploadFile(file);
                        onUpdate({ customIconImage: url });
                      }} />
                  </label>
                )}
              </div>
            </div>
          )}
          <hr className="border-[rgba(255,255,255,0.04)] my-1" />
          <label className="flex items-center justify-between">
            <span className="text-[11px] text-textSecondary/70">占比环</span>
            <input type="checkbox" checked={!!opts.showRing}
              onChange={(e) => onUpdate({ showRing: e.target.checked, showIcon: e.target.checked ? false : opts.showIcon })} className="rounded" />
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
          <ColorSwatchRow label="数值颜色" value={(opts.valueColor as string) ?? "#FFFFFF"} colors={PRESET_VALUE_COLORS} onChange={(c) => onUpdate({ valueColor: c })} />
          <ColorSwatchRow label="单位颜色" value={(opts.suffixColor as string) ?? "#9E9EA8"} colors={PRESET_SUFFIX_COLORS} onChange={(c) => onUpdate({ suffixColor: c })} />

          <hr className="border-[rgba(255,255,255,0.04)] my-1" />
          <label className="flex items-center justify-between">
            <span className="text-[11px] text-textSecondary/70">增长率</span>
            <input type="checkbox" checked={!!opts.showTrend}
              onChange={(e) => onUpdate({ showTrend: e.target.checked })} className="rounded" />
          </label>
          {!!opts.showTrend && (
            <>
              <LabelSelectRow label="数据来源" value={String(opts.trendMode ?? 'auto')}
                options={['auto','manual']} labels={['自动计算','手动输入']}
                onChange={(v) => onUpdate({ trendMode: v })} />
              {opts.trendMode === 'manual' && (
                <label className="flex items-center justify-between">
                  <span className="text-[11px] text-textSecondary/70">增长率(%)</span>
                  <input type="number" value={Number(opts.trend ?? 0)}
                    onChange={(e) => onUpdate({ trend: Number(e.target.value) })}
                    className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
                </label>
              )}
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">对比标签</span>
                <input type="text" value={String(opts.trendLabel ?? '')}
                  onChange={(e) => onUpdate({ trendLabel: e.target.value })}
                  placeholder="如: vs 昨日"
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
            </>
          )}
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
            <span className="text-[11px] text-textSecondary/70">图片文件 (JPG/PNG/SVG，可多选)</span>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                const existing: any[] = [...((opts.images as any[]) || [])];
                let loaded = 0;
                files.forEach((file) => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    existing.push({ url: reader.result as string, pinned: true });
                    loaded++;
                    if (loaded === files.length) {
                      onUpdate({ images: [...existing] });
                    }
                  };
                  reader.readAsDataURL(file);
                });
              }}
              className="text-[11px] text-textSecondary/70 file:mr-2 file:py-1 file:px-2 file:text-[11px] file:rounded file:border file:border-[rgba(0,212,255,0.2)] file:bg-surface-hover file:text-textSecondary hover:file:text-text file:cursor-pointer" />
          </label>
          {(opts.images as any[])?.length > 0 && (
            <div className="space-y-1 mt-1">
              {(opts.images as any[]).map((img: any, i: number) => {
                const url = typeof img === 'string' ? img : img?.url || '';
                const pinned = !!(img && typeof img === 'object' && img.pinned);
                return (
                  <div key={i} className={`flex items-center gap-2 rounded p-1 transition-colors ${pinned ? 'bg-accent-warm/10 border border-accent-warm/25' : 'bg-surface-base/50'}`}>
                    <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    <span className="text-[10px] text-textSecondary/60 flex-1 min-w-0 truncate">图片 {i + 1}</span>
                    <button
                      onClick={(e2) => {
                        e2.stopPropagation();
                        const next = (opts.images as any[]).map((item: any, j: number) =>
                          j === i ? { url: typeof item === 'string' ? item : item.url, pinned: !pinned } : item
                        );
                        onUpdate({ images: next });
                      }}
                      className={`flex-shrink-0 p-1 rounded transition-all ${pinned ? 'text-accent-warm bg-accent-warm/15 hover:bg-accent-warm/25' : 'text-textSecondary/20 hover:text-textSecondary/50 hover:bg-surface-hover'}`}
                      title={pinned ? '已固定 · 点击取消' : '未固定 · 点击保护'}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={pinned ? '1' : '1.5'} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v2" />
                        <path d="M4 7h16" />
                        <path d="M17 7l-1.5 9.5a2 2 0 0 1-2 1.5h-3a2 2 0 0 1-2-1.5L7 7" />
                        <path d="M9.5 21h5" />
                      </svg>
                    </button>
                    <button
                      onClick={(e2) => {
                        e2.stopPropagation();
                        const next = (opts.images as any[]).filter((_: any, j: number) => j !== i);
                        onUpdate({ images: next.length > 0 ? next : undefined });
                      }}
                      className="text-negative/40 hover:text-negative flex-shrink-0 p-1 hover:bg-negative/10 rounded transition-colors"
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}
          {(opts.src as string) && !(opts.images as any[])?.length && (
            <button onClick={() => onUpdate({ src: undefined })}
              className="text-[11px] text-negative/60 hover:text-negative mt-1"
            >移除图片</button>
          )}
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">轮播间隔(秒)</span>
            <input type="number" min={0} step={1} value={Number(opts.slideshowInterval ?? 0)}
              onChange={(e) => onUpdate({ slideshowInterval: Math.max(0, Number(e.target.value)) })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
          </label>
          <p className="text-[10px] text-textSecondary/40 -mt-1">0 = 不轮播，显示第一张</p>
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
            <LabelSelectRow label="玫瑰图" value={String(opts.roseType ?? 'none')}
              options={['none', 'radius', 'area']}
              labels={['关闭', '按半径', '按面积']}
              onChange={(v) => onUpdate({ roseType: v })} />
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

      {/* ═══ 视频 — 与主编辑器一致 ═══ */}
      {chartType === 'video-widget' && (
        <CollapsibleFieldGroup label="视频" defaultOpen={true}>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">
              视频文件 (MP4/WebM，可多选)
              <span className="ml-1 text-accent-cool/60">{((opts as any).videos?.length ?? 0)}/4</span>
            </span>
            {((opts as any).videos?.length ?? 0) >= 4 ? (
              <p className="text-[10px] text-accent-warm/60">已达上限（4个），请先删除旧视频再添加</p>
            ) : (
              <input type="file" multiple accept=".mp4,.webm,video/mp4,video/webm"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  const existing: any[] = [...((opts as any).videos || [])];
                  const remaining = 4 - existing.length;
                  const toAdd = files.slice(0, remaining);
                  toAdd.forEach((file) => {
                    const blobUrl = stageUploadFile(file);
                    existing.push({ url: blobUrl, pinned: true });
                  });
                  onUpdate({ videos: [...existing] });
                }}
                className="text-[11px] text-textSecondary/70 file:mr-2 file:py-1 file:px-2 file:text-[11px] file:rounded file:border file:border-[rgba(0,212,255,0.2)] file:bg-surface-hover file:text-textSecondary hover:file:text-text file:cursor-pointer" />
            )}
          </label>
          {((opts as any).videos as any[])?.length > 0 && (
            <div className="space-y-1 mt-1">
              {((opts as any).videos as any[]).map((vid: any, i: number) => {
                const url = typeof vid === 'string' ? vid : vid?.url || '';
                const pinned = !!(vid && typeof vid === 'object' && vid.pinned);
                return (
                  <div key={i} className={`flex items-center gap-2 rounded p-1 transition-colors ${pinned ? 'bg-accent-warm/10 border border-accent-warm/25' : 'bg-surface-base/50'}`}>
                    <span className="text-[10px] text-textSecondary/60 flex-1 min-w-0 truncate">{url.startsWith('blob:') ? '📹 待上传' : `🎬 视频 ${i + 1}`}</span>
                    <button onClick={() => {
                      const next = ((opts as any).videos as any[]).map((item: any, j: number) =>
                        j === i ? { url: typeof item === 'string' ? item : item.url, pinned: !pinned } : item);
                      onUpdate({ videos: next });
                    }}
                    className={`flex-shrink-0 p-1 rounded transition-all ${pinned ? 'text-accent-warm bg-accent-warm/15 hover:bg-accent-warm/25' : 'text-textSecondary/20 hover:text-textSecondary/50 hover:bg-surface-hover'}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={pinned ? '1' : '1.5'}>
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v4h1.6v-4H18v-2l-2-2z" />
                      </svg>
                    </button>
                    <button onClick={() => {
                      const next = ((opts as any).videos as any[]).filter((_: any, j: number) => j !== i);
                      onUpdate({ videos: next.length > 0 ? next : undefined });
                    }} className="text-negative/40 hover:text-negative flex-shrink-0 p-1 hover:bg-negative/10 rounded transition-colors">×</button>
                  </div>
                );
              })}
            </div>
          )}
          <LabelSelectRow label="填充方式" value={String((opts as any).fit ?? 'contain')}
            options={['contain','cover','fill']} labels={['适配','裁剪','拉伸']}
            onChange={(v) => onUpdate({ fit: v })} />
          <div className="flex flex-wrap gap-2 mt-2">
            {[['muted','静音'],['autoplay','自动播放'],['loop','循环'],['controls','控件']].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1 text-[11px] text-textSecondary/70">
                <input type="checkbox" checked={!!(opts as any)[key]}
                  onChange={(e) => onUpdate({ [key]: e.target.checked })} className="w-3 h-3" />
                {label}
              </label>
            ))}
          </div>
          <LabelSelectRow label="预加载" value={String((opts as any).preload ?? 'metadata')}
            options={['metadata','auto','none']} labels={['仅元数据','自动','不预加载']}
            onChange={(v) => onUpdate({ preload: v })} />
        </CollapsibleFieldGroup>
      )}

      {/* ═══ 箱线图 — 与主编辑器一致 ═══ */}
      {chartType === 'box-plot' && (
        <>
          <CollapsibleFieldGroup label="数值" defaultOpen={true}>
            <BoxPlotDataEditor
              categories={Array.isArray(opts.categories) ? opts.categories as any[] : []}
              onChange={(cats) => onUpdate({ categories: cats })} />
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="样式" defaultOpen={false}>
            <ColorSwatchRow label="盒子颜色" value={(opts.boxColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => onUpdate({ boxColor: c })} />
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
              <input type="checkbox" checked={(opts.showTick as boolean) ?? true}
                onChange={(e) => onUpdate({ showTick: e.target.checked })}
                className="rounded" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">盒子宽度</span>
              <input type="number" value={Number(opts.boxWidth ?? 20)} min={5} max={50}
                onChange={(e) => onUpdate({ boxWidth: Number(e.target.value) })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
          </CollapsibleFieldGroup>
        </>
      )}

      {/* ═══ 水位球 — 与主编辑器一致 ═══ */}
      {chartType === 'water-pond' && (
        <>
          <CollapsibleFieldGroup label="数据" defaultOpen={true}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">百分比</span>
              <input type="number" value={Number(opts.value ?? 60)} min={0} max={100}
                onChange={(e) => onUpdate({ value: Number(e.target.value) })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">标题</span>
              <input type="text" value={String(opts.title ?? '')}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="(空)"
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">后缀</span>
              <input type="text" value={String(opts.suffix ?? '%')}
                onChange={(e) => onUpdate({ suffix: e.target.value })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-12 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <ColorSwatchRow label="标题颜色" value={(opts.titleColor as string) ?? '#E8E8EC'} colors={PRESET_VALUE_COLORS} onChange={(c) => onUpdate({ titleColor: c })} />
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">标题字号</span>
              <input type="number" value={Number(opts.titleFontSize ?? 14)} min={8} max={48}
                onChange={(e) => onUpdate({ titleFontSize: Number(e.target.value) })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="样式" defaultOpen={false}>
            <LabelSelectRow label="形状" value={String((opts as any).shape ?? 'round')}
              options={['round','roundRect','rect']} labels={['圆形','圆角矩形','矩形']}
              onChange={(v) => onUpdate({ shape: v })} />
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">波浪高度</span>
              <input type="number" value={Number((opts as any).waveHeight ?? 30)} min={5} max={120}
                onChange={(e) => onUpdate({ waveHeight: Number(e.target.value) })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">波浪层数</span>
              <input type="number" value={Number((opts as any).waveNum ?? 3)} min={1} max={6}
                onChange={(e) => onUpdate({ waveNum: Number(e.target.value) })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
          </CollapsibleFieldGroup>
        </>
      )}

      {/* ═══ 赛博地图 — 与主编辑器一致 ═══ */}
      {chartType === 'cyber-map' && (
        <>
          <CollapsibleFieldGroup label="地图" defaultOpen={true}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">厚度</span>
              <input type="number" value={Number(opts.thickness ?? 3)} min={0} max={20} step={0.5}
                onChange={(e) => onUpdate({ thickness: Number(e.target.value) })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">显示网格</span>
              <input type="checkbox" checked={!!(opts.showGrid ?? true)}
                onChange={(e) => onUpdate({ showGrid: e.target.checked })} className="rounded" />
            </label>
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="地图钉" defaultOpen={false}>
            <div className="text-[10px] text-textSecondary/40 mb-2">地图钉配置请在主编辑器中操作</div>
          </CollapsibleFieldGroup>
        </>
      )}

      {/* ═══ 赛博城市 — 与主编辑器一致 ═══ */}
      {chartType === 'cyber-city' && (
        <CollapsibleFieldGroup label="城市" defaultOpen={true}>
          <label className="flex items-center justify-between">
            <span className="text-[11px] text-textSecondary/70">高度倍率</span>
            <input type="number" value={Number(opts.heightScale ?? 1)} min={0.1} max={5} step={0.1}
              onChange={(e) => onUpdate({ heightScale: Number(e.target.value) })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
          </label>
          <label className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-textSecondary/70">显示网格</span>
            <input type="checkbox" checked={!!(opts.showGrid ?? true)}
              onChange={(e) => onUpdate({ showGrid: e.target.checked })} className="rounded" />
          </label>
        </CollapsibleFieldGroup>
      )}
    </>
  );
}

/** 箱线图数据编辑器 */
function BoxPlotDataEditor({ categories, onChange }: { categories: any[]; onChange: (cats: any[]) => void }) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right w-12';
  const cats = categories.length ? categories : [{ name: 'A组', min: 10, q1: 30, median: 45, q3: 60, max: 85 }];
  return (
    <div className="space-y-1.5">
      <button onClick={() => onChange([...cats, { name: `E组`, min: 10, q1: 30, median: 50, q3: 70, max: 90 }])}
        className="w-full text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加组</button>
      {cats.map((c: any, i: number) => (
        <div key={i} className="flex items-center gap-1 flex-wrap p-1 rounded bg-surface-base/50">
          <input type="text" value={c.name ?? ''} placeholder="名称"
            onChange={(e) => { const n = [...cats]; n[i] = { ...c, name: e.target.value }; onChange(n); }}
            className={`${inputCls} w-10 text-left`} />
          {(['min','q1','median','q3','max'] as const).map((f) => (
            <input key={f} type="number" value={c[f] ?? ''} title={f} placeholder="0" step="any"
              onChange={(e) => {
                const raw = e.target.value;
                // 空字符串 → 保留原值，不写入 0（防止用户清空输入框时 Number('')=0 污染数据）
                if (raw === '' || raw === '-') return;
                const n = [...cats]; n[i] = { ...c, [f]: Number(raw) }; onChange(n);
              }}
              className={inputCls} />
          ))}
          <button onClick={() => onChange(cats.filter((_: any, j: number) => j !== i))}
            className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
        </div>
      ))}
    </div>
  );
}

/** Voronoi 图数据编辑器 — 每点: 名称 + X + Y */
function VoronoiDataEditor({ points, onChange }: { points: any[]; onChange: (pts: any[]) => void }) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right w-12';
  const pts = points.length ? points : [{ name: 'A', x: 12, y: 38 }];
  return (
    <div className="space-y-1.5">
      <button onClick={() => onChange([...pts, { name: String.fromCharCode(65 + pts.length), x: 50, y: 50 }])}
        className="w-full text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加点</button>
      {pts.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1 flex-wrap p-1 rounded bg-surface-base/50">
          <input type="text" value={p.name ?? ''} placeholder="名称"
            onChange={(e) => { const n = [...pts]; n[i] = { ...p, name: e.target.value }; onChange(n); }}
            className={`${inputCls} w-10 text-left`} />
          {(['x','y'] as const).map((f) => (
            <input key={f} type="number" value={p[f] ?? ''} title={f.toUpperCase()} placeholder="0" step="any"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || raw === '-') return;
                const n = [...pts]; n[i] = { ...p, [f]: Number(raw) }; onChange(n);
              }}
              className={inputCls} />
          ))}
          <button onClick={() => onChange(pts.filter((_: any, j: number) => j !== i))}
            className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
        </div>
      ))}
    </div>
  );
}

/** 层级数据编辑器（矩形树图/旭日图共用）— 递归嵌套：节点带名称+值，每个节点可继续添加子节点 */
function HierarchyDataEditor({ label, data, onChange }: {
  label: string;
  data: { name: string; value?: number; children?: unknown[] }[];
  onChange: (ts: { name: string; value?: number; children?: unknown[] }[]) => void;
}) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors';
  const ts = data.length ? data : [];
  const depthCls = (depth: number) => `flex items-center gap-1 p-1 rounded bg-surface-base/50 ${depth > 0 ? 'mt-0.5' : ''}`;

  const renderNode = (
    node: { name: string; value?: number; children?: unknown[] },
    depth: number,
    update: (n: { name: string; value?: number; children?: unknown[] }) => void,
    remove: () => void,
    key: number,
  ) => {
    const kids = Array.isArray(node.children) ? node.children as { name: string; value?: number; children?: unknown[] }[] : [];
    const updateKid = (i: number) => (n: { name: string; value?: number; children?: unknown[] }) => {
      const next = [...kids]; next[i] = n;
      update({ ...node, children: next });
    };
    return (
      <div key={key}>
        <div className={depthCls(depth)} style={{ paddingLeft: depth * 16 }}>
          <input type="text" value={node.name ?? ''}
            onChange={(e) => update({ ...node, name: e.target.value })}
            className={`${inputCls} flex-1 min-w-0 w-16`} />
          <input type="number" value={node.value ?? ''} placeholder="值" step="any"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '' || raw === '-') return;
              update({ ...node, value: Number(raw) });
            }}
            className={`${inputCls} w-14`} />
          <button
            onClick={() => update({ ...node, children: [...kids, { name: `子节点${kids.length + 1}` }] })}
            className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors whitespace-nowrap">+ 子节点</button>
          <button onClick={remove}
            className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
        </div>
        {kids.map((k, i) => renderNode(k, depth + 1, updateKid(i), () => {
          const next = [...kids]; next.splice(i, 1);
          update({ ...node, children: next });
        }, i))}
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-textSecondary/40">{label}</span>
        <button
          onClick={() => onChange([...ts, { name: `根节点${ts.length + 1}` }])}
          className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加根节点</button>
      </div>
      {ts.map((t, i) => renderNode(t, 0, (n) => {
        const next = [...ts]; next[i] = n; onChange(next);
      }, () => onChange(ts.filter((_, j) => j !== i)), i))}
      {ts.length === 0 && (
        <div className="text-[10px] text-textSecondary/30 text-center py-2">暂无数据，点击「+ 添加根节点」创建</div>
      )}
    </div>
  );
}

/** 树形图数据编辑器 — 递归嵌套结构：添加根节点（=一棵树），每个节点可继续添加子节点 */
function TreeDataEditor({ trees, onChange }: {
  trees: { name: string; children?: unknown[] }[];
  onChange: (ts: { name: string; children?: unknown[] }[]) => void;
}) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors';
  const ts = trees.length ? trees : [];
  const depthCls = (depth: number) => `flex items-center gap-1 p-1 rounded bg-surface-base/50 ${depth > 0 ? 'mt-0.5' : ''}`;

  // 递归节点行：名称 + 添加子节点 + 删除
  const renderNode = (
    node: { name: string; children?: unknown[] },
    depth: number,
    update: (n: { name: string; children?: unknown[] }) => void,
    remove: () => void,
    key: number,
  ) => {
    const kids = Array.isArray(node.children) ? node.children as { name: string; children?: unknown[] }[] : [];
    const updateKid = (i: number) => (n: { name: string; children?: unknown[] }) => {
      const next = [...kids]; next[i] = n;
      update({ ...node, children: next });
    };
    return (
      <div key={key}>
        <div className={depthCls(depth)} style={{ paddingLeft: depth * 16 }}>
          <input type="text" value={node.name ?? ''}
            onChange={(e) => update({ ...node, name: e.target.value })}
            className={`${inputCls} flex-1 min-w-0 w-16`} />
          <button
            onClick={() => update({ ...node, children: [...kids, { name: `子节点${kids.length + 1}` }] })}
            className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors whitespace-nowrap">+ 子节点</button>
          <button onClick={remove}
            className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
        </div>
        {kids.map((k, i) => renderNode(k, depth + 1, updateKid(i), () => {
          const next = [...kids]; next.splice(i, 1);
          update({ ...node, children: next });
        }, i))}
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-textSecondary/40">树（每个根节点一棵树）</span>
        <button
          onClick={() => onChange([...ts, { name: `根节点${ts.length + 1}` }])}
          className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加根节点</button>
      </div>
      {ts.map((t, i) => renderNode(t, 0, (n) => {
        const next = [...ts]; next[i] = n; onChange(next);
      }, () => onChange(ts.filter((_, j) => j !== i)), i))}
      {ts.length === 0 && (
        <div className="text-[10px] text-textSecondary/30 text-center py-2">暂无树，点击「+ 添加根节点」创建</div>
      )}
    </div>
  );
}

/** 关系图数据编辑器 — 节点列表（名称+坐标）+ 连线列表（起点/终点下拉） */
function RelationDataEditor({ nodes, links, onChange }: {
  nodes: { name: string; x: number; y: number }[];
  links: { source: string; target: string }[];
  onChange: (ns: { name: string; x: number; y: number }[], ls: { source: string; target: string }[]) => void;
}) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right w-12';
  const ns = nodes.length ? nodes : [{ name: '节点1', x: 50, y: 50 }];
  const ls = links.length ? links : [];
  const selectCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text focus:outline-none focus:border-accent-cool/50 transition-colors flex-1 min-w-0';

  return (
    <div className="space-y-2">
      {/* 节点 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-textSecondary/40">节点</span>
          <button
            onClick={() => onChange([...ns, { name: `节点${ns.length + 1}`, x: 50, y: 50 }], ls)}
            className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加节点</button>
        </div>
        <div className="space-y-1">
          {ns.map((n, i) => (
            <div key={i} className="flex items-center gap-1 p-1 rounded bg-surface-base/50">
              <input type="text" value={n.name ?? ''}
                onChange={(e) => {
                  const next = [...ns]; next[i] = { ...n, name: e.target.value };
                  onChange(next, ls);
                }}
                className={`${inputCls} flex-1 text-left w-auto`} />
              <input type="number" value={n.x ?? 50} step="any"
                onChange={(e) => {
                  if (e.target.value === '' || e.target.value === '-') return;
                  const next = [...ns]; next[i] = { ...n, x: Number(e.target.value) }; onChange(next, ls);
                }}
                className={inputCls} />
              <input type="number" value={n.y ?? 50} step="any"
                onChange={(e) => {
                  if (e.target.value === '' || e.target.value === '-') return;
                  const next = [...ns]; next[i] = { ...n, y: Number(e.target.value) }; onChange(next, ls);
                }}
                className={inputCls} />
              <button onClick={() => onChange(ns.filter((_, j) => j !== i), ls)}
                className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
            </div>
          ))}
        </div>
      </div>
      {/* 连线 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-textSecondary/40">连线</span>
          <button
            onClick={() => onChange(ns, [...ls, { source: ns[0]?.name ?? '', target: ns[1]?.name ?? ns[0]?.name ?? '' }])}
            className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加连线</button>
        </div>
        <div className="space-y-1">
          {ls.map((l, i) => (
            <div key={i} className="flex items-center gap-1 p-1 rounded bg-surface-base/50">
              <select
                value={l.source}
                onChange={(e) => {
                  const next = [...ls]; next[i] = { ...l, source: e.target.value }; onChange(ns, next);
                }}
                className={selectCls}>
                {ns.map((n) => <option key={n.name} value={n.name}>{n.name}</option>)}
              </select>
              <span className="text-[10px] text-textSecondary/40">→</span>
              <select
                value={l.target}
                onChange={(e) => {
                  const next = [...ls]; next[i] = { ...l, target: e.target.value }; onChange(ns, next);
                }}
                className={selectCls}>
                {ns.map((n) => <option key={n.name} value={n.name}>{n.name}</option>)}
              </select>
              <button onClick={() => onChange(ns, ls.filter((_, j) => j !== i))}
                className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 桑基图数据编辑器 — 节点（名称+值）+ 连线（起点/终点下拉 + 流量值） */
function SankeyDataEditor({ nodes, links, onChange }: {
  nodes: { name: string; value?: number }[];
  links: { source: string; target: string; value: number }[];
  onChange: (ns: { name: string; value?: number }[], ls: { source: string; target: string; value: number }[]) => void;
}) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors';
  const ns = nodes.length ? nodes : [];
  const ls = links.length ? links : [];
  const selectCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text focus:outline-none focus:border-accent-cool/50 transition-colors flex-1 min-w-0';

  return (
    <div className="space-y-2">
      {/* 节点 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-textSecondary/40">节点（名称 + 值）</span>
          <button
            onClick={() => onChange([...ns, { name: `节点${ns.length + 1}` }], ls)}
            className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加节点</button>
        </div>
        <div className="space-y-1">
          {ns.map((n, i) => (
            <div key={i} className="flex items-center gap-1 p-1 rounded bg-surface-base/50">
              <input type="text" value={n.name ?? ''}
                onChange={(e) => {
                  const next = [...ns]; next[i] = { ...n, name: e.target.value };
                  onChange(next, ls);
                }}
                className={`${inputCls} flex-1 text-left w-auto`} />
              <input type="number" value={n.value ?? ''} placeholder="值" step="any"
                onChange={(e) => {
                  if (e.target.value === '' || e.target.value === '-') return;
                  const next = [...ns]; next[i] = { ...n, value: Number(e.target.value) }; onChange(next, ls);
                }}
                className={`${inputCls} w-12 text-right`} />
              <button onClick={() => onChange(ns.filter((_, j) => j !== i), ls)}
                className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
            </div>
          ))}
        </div>
      </div>
      {/* 连线 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-textSecondary/40">连线（流量）</span>
          <button
            onClick={() => onChange(ns, [...ls, { source: ns[0]?.name ?? '', target: ns[1]?.name ?? ns[0]?.name ?? '', value: 1 }])}
            className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加连线</button>
        </div>
        <div className="space-y-1">
          {ls.map((l, i) => (
            <div key={i} className="flex items-center gap-1 p-1 rounded bg-surface-base/50">
              <select
                value={l.source}
                onChange={(e) => {
                  const next = [...ls]; next[i] = { ...l, source: e.target.value }; onChange(ns, next);
                }}
                className={selectCls}>
                {ns.map((n) => <option key={n.name} value={n.name}>{n.name}</option>)}
              </select>
              <span className="text-[10px] text-textSecondary/40">→</span>
              <select
                value={l.target}
                onChange={(e) => {
                  const next = [...ls]; next[i] = { ...l, target: e.target.value }; onChange(ns, next);
                }}
                className={selectCls}>
                {ns.map((n) => <option key={n.name} value={n.name}>{n.name}</option>)}
              </select>
              <input type="number" value={l.value ?? ''} placeholder="流量" step="any"
                onChange={(e) => {
                  if (e.target.value === '' || e.target.value === '-') return;
                  const next = [...ls]; next[i] = { ...l, value: Number(e.target.value) }; onChange(ns, next);
                }}
                className={`${inputCls} w-12 text-right`} />
              <button onClick={() => onChange(ns, ls.filter((_, j) => j !== i))}
                className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 热力图数据编辑器 — 每行「x, y, value」三元组，支持生成模拟数据（2万点验证性能） */
function HeatmapDataEditor({ points, onChange }: { points: { x: number; y: number; value: number }[]; onChange: (pts: { x: number; y: number; value: number }[]) => void }) {
  const parse = (raw: string): { x: number; y: number; value: number }[] =>
    raw.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [x, y, v] = line.split(/[,，\s]+/);
      return { x: Number(x), y: Number(y), value: Number(v) };
    }).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.value));

  const [text, setText] = useState(points.map((p) => `${p.x}, ${p.y}, ${p.value}`).join('\n'));
  useEffect(() => {
    const fromText = parse(text);
    if (JSON.stringify(fromText) !== JSON.stringify(points)) {
      setText(points.map((p) => `${p.x}, ${p.y}, ${p.value}`).join('\n'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  // 生成模拟热力数据（平滑螺旋云状分布，对应官方示例 sin/cos + 噪声）
  const genMock = (count: number) => {
    const pts: { x: number; y: number; value: number }[] = [];
    for (let i = 0; i < count; i++) {
      const x = 50 + Math.sin(i / 120) * 30 + (Math.random() - 0.5) * 14;
      const y = 50 + Math.cos(i / 90) * 30 + (Math.random() - 0.5) * 14;
      const value = 50 + Math.sin(i / 40) * 30 + Math.random() * 15;
      pts.push({ x: Math.round(x), y: Math.round(y), value: Math.max(0, Math.min(100, Math.round(value))) });
    }
    onChange(pts);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button onClick={() => genMock(2000)}
          className="flex-1 text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">生成模拟数据 (2千点)</button>
        <button onClick={() => genMock(20000)}
          className="flex-1 text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">生成模拟数据 (2万点)</button>
      </div>
      <textarea
        value={text}
        rows={6}
        placeholder={'x, y, value（每行一组）\n如: 25, 30, 85'}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(parse(raw));
        }}
        className="w-full bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors resize-y" />
    </div>
  );
}

/** 雷达图数据编辑器 — 指标列表（名称+最大值）+ 多系列数值（每系列一个卡片） */
function RadarDataEditor({ indicators, series, onChange }: {
  indicators: { name: string; max: number }[];
  series: { name: string; value: number[] }[];
  onChange: (inds: { name: string; max: number }[], sers: { name: string; value: number[] }[]) => void;
}) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right w-12';
  const inds = indicators.length ? indicators : [{ name: '指标1', max: 100 }];
  const sers = series.length ? series : [{ name: '数据', value: inds.map(() => 0) }];

  return (
    <div className="space-y-1.5">
      <button onClick={() => {
        const nextInds = [...inds, { name: `指标${inds.length + 1}`, max: 100 }];
        onChange(nextInds, sers.map((s) => ({ ...s, value: [...s.value, 0] })));
      }}
        className="w-full text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加指标</button>
      <div className="flex items-center gap-1 px-1 text-[9px] text-textSecondary/40">
        <span className="flex-1">指标名称</span>
        <span className="w-12 text-right">最大值</span>
        <span className="w-4" />
      </div>
      {inds.map((ind, i) => (
        <div key={i} className="flex items-center gap-1 p-1 rounded bg-surface-base/50">
          <input type="text" value={ind.name ?? ''}
            onChange={(e) => {
              const n = [...inds]; n[i] = { ...ind, name: e.target.value }; onChange(n, sers);
            }}
            className={`${inputCls} flex-1 text-left w-auto`} />
          <input type="number" value={ind.max ?? 100} min={1} step="any"
            onChange={(e) => {
              if (e.target.value === '' || e.target.value === '-') return;
              const n = [...inds]; n[i] = { ...ind, max: Number(e.target.value) }; onChange(n, sers);
            }}
            className={inputCls} />
          <button onClick={() => {
            onChange(
              inds.filter((_, j) => j !== i),
              sers.map((s) => ({ ...s, value: s.value.filter((_, j) => j !== i) })),
            );
          }}
            className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
        </div>
      ))}

      {/* 多系列：每系列一个卡片（名称 + 每指标值） */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-textSecondary/40">数据系列</span>
        <button
          onClick={() => onChange(inds, [...sers, { name: `系列${sers.length + 1}`, value: inds.map(() => 0) }])}
          className="text-[10px] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加系列</button>
      </div>
      {sers.map((s, si) => (
        <div key={si} className="mb-2 bg-surface-base/30 rounded p-1.5">
          <div className="flex items-center gap-1 mb-1">
            <input type="text" value={s.name ?? ''}
              onChange={(e) => onChange(inds, sers.map((x, xi) => (xi === si ? { ...x, name: e.target.value } : x)))}
              className="flex-1 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 text-[10px] text-accent-cool font-medium focus:outline-none focus:border-accent-cool/50 transition-colors" />
            <button
              onClick={() => onChange(inds, sers.filter((_, xi) => xi !== si))}
              disabled={sers.length <= 1}
              className="text-textSecondary/30 hover:text-negative text-xs disabled:opacity-20">×</button>
          </div>
          <div className="space-y-0.5">
            {inds.map((ind, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[9px] text-textSecondary/25 flex-1 truncate text-right" title={ind.name}>{ind.name}</span>
                <input type="number" value={s.value?.[i] ?? 0} step="any"
                  onChange={(e) => {
                    if (e.target.value === '' || e.target.value === '-') return;
                    onChange(inds, sers.map((x, xi) => {
                      if (xi !== si) return x;
                      const v = [...(x.value ?? [])]; v[i] = Number(e.target.value); return { ...x, value: v };
                    }));
                  }}
                  className="w-16 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 断轴走势图数据编辑器 — 每行「时间, 数值」，支持生成模拟盘中数据（午休断开） */
function IntradayDataEditor({ points, onChange }: { points: { time: string; value: number }[]; onChange: (pts: { time: string; value: number }[]) => void }) {
  const parse = (raw: string): { time: string; value: number }[] =>
    raw.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [t, v] = line.split(/[,，\s]+/);
      return { time: t ?? '', value: Number(v) };
    }).filter((p) => p.time !== '' && Number.isFinite(p.value));

  const [text, setText] = useState(points.map((p) => `${p.time}, ${p.value}`).join('\n'));
  useEffect(() => {
    const fromText = parse(text);
    if (JSON.stringify(fromText) !== JSON.stringify(points)) {
      setText(points.map((p) => `${p.time}, ${p.value}`).join('\n'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  // 生成模拟盘中数据：9:30-11:30 + 13:00-15:00（5 分钟间隔）
  const genMock = () => {
    const pts: { time: string; value: number }[] = [];
    const mk = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    let v = 100;
    let i = 0;
    const push = (h: number, m: number) => {
      v += Math.sin(i / 6) * 0.8 + (Math.random() - 0.5) * 0.6;
      pts.push({ time: mk(h, m), value: Math.round(v * 100) / 100 });
      i++;
    };
    for (let m = 30; m <= 90; m += 5) push(9, m % 60);
    for (let m = 0; m <= 90; m += 5) push(10, m % 60);
    for (let m = 0; m <= 120; m += 5) push(13, m % 60);
    onChange(pts);
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={genMock}
        className="w-full text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">生成模拟盘中数据（含午休间隔）</button>
      <textarea
        value={text}
        rows={6}
        placeholder={'时间, 数值（每行一组）\n如: 09:30, 100.5\n或: 10:05, 101.2'}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(parse(raw));
        }}
        className="w-full bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors resize-y" />
    </div>
  );
}

/** 阶梯线图数据编辑器 — 每行「x, 数值」（x 纯数字自动转时间戳，否则保留字符串标签） */
function StepLineDataEditor({ points, onChange }: { points: { x: number | string; value: number }[]; onChange: (pts: { x: number | string; value: number }[]) => void }) {
  const parse = (raw: string): { x: number | string; value: number }[] =>
    raw.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [xv, v] = line.split(/[,，\s]+/);
      const x = /^[-.\d]+$/.test(xv) ? parseFloat(xv) : xv;
      return { x, value: Number(v) };
    }).filter((p) => p.x != null && p.x !== '' && Number.isFinite(p.value));

  const [text, setText] = useState(points.map((p) => `${p.x}, ${p.value}`).join('\n'));
  useEffect(() => {
    const fromText = parse(text);
    if (JSON.stringify(fromText) !== JSON.stringify(points)) {
      setText(points.map((p) => `${p.x}, ${p.value}`).join('\n'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  return (
    <textarea
      value={text}
      rows={6}
      placeholder={'x, 数值（每行一组）\n如: 2026-08-04, 82\n或: 1710000000000, 95'}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onChange(parse(raw));
      }}
      className="w-full bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors resize-y" />
  );
}

/** 大规模面积图数据编辑器 — 每行「时间戳, 数值」，支持批量粘贴与生成模拟数据 */
function LargeAreaDataEditor({ points, onChange }: { points: { time: number; value: number }[]; onChange: (pts: { time: number; value: number }[]) => void }) {
  const parse = (raw: string): { time: number; value: number }[] =>
    raw.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [t, v] = line.split(/[,，\s]+/);
      return { time: Number(t), value: Number(v) };
    }).filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value));

  const [text, setText] = useState(points.map((p) => `${p.time}, ${p.value}`).join('\n'));
  useEffect(() => {
    const fromText = parse(text);
    if (JSON.stringify(fromText) !== JSON.stringify(points)) {
      setText(points.map((p) => `${p.time}, ${p.value}`).join('\n'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  const genMock = (count: number) => {
    const start = Date.now() - count * 3600_000;
    const pts: { time: number; value: number }[] = [];
    let v = 100;
    for (let i = 0; i < count; i++) {
      v += Math.sin(i / 25) * 2.5 + (Math.sin(i / 7) * 0.8) + (Math.random() - 0.5) * 3;
      pts.push({ time: start + i * 3600_000, value: Math.round(v * 10) / 10 });
    }
    onChange(pts);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => genMock(600)}
          className="flex-1 text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">生成模拟数据 (600点)</button>
        <button
          onClick={() => genMock(10000)}
          className="flex-1 text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">生成模拟数据 (1万点)</button>
      </div>
      <textarea
        value={text}
        rows={6}
        placeholder={'时间戳, 数值（每行一组，支持粘贴 CSV）\n如: 1710000000000, 102.5'}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(parse(raw));
        }}
        className="w-full bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors resize-y" />
    </div>
  );
}

/**
 * 通用数值数组编辑器 — 逗号/空格分隔的 textarea（直方图数据、置信区间上下界等复用）。
 * 本地文本缓冲：空串不解析（避免 Number('')=0 占位）、删减不被打断；
 * 仅当解析结果与外部数据不一致时（REST 推送）才回写显示。
 */
function NumberArrayTextEditor({ data, onChange, placeholder }: { data: number[]; onChange: (d: number[]) => void; placeholder?: string }) {
  const parse = (raw: string): number[] =>
    raw.split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter((s) => s !== '')          // ★ 关键：空串不解析，避免 Number('')=0 占位
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));

  const [text, setText] = useState(data.join(', '));
  useEffect(() => {
    const fromText = parse(text);
    if (JSON.stringify(fromText) !== JSON.stringify(data)) {
      setText(data.join(', '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  return (
    <textarea
      value={text}
      rows={4}
      placeholder={placeholder ?? "35, 42, 38, 51, 47, 55, 60 ..."}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onChange(parse(raw));
      }}
      className="w-full bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors resize-y" />
  );
}

/** 直方图数据编辑器 — 逗号/空格分隔的数值数组（复用通用编辑器） */
function HistogramDataEditor({ data, onChange }: { data: number[]; onChange: (d: number[]) => void }) {
  return <NumberArrayTextEditor data={data} onChange={onChange} placeholder="35, 42, 38, 51, 47, 55, 60 ..." />;
}

/** 多 X 轴走势图 — 单条线的数据编辑（标签 + 数值两个逗号分隔输入） */
function AxisLineFieldsEditor({ name, color, data, onChange }: {
  name: string;
  color: string;
  data: { labels?: string[]; values?: number[] } | undefined;
  onChange: (d: { labels?: string[]; values?: number[] } | undefined) => void;
}) {
  const parseList = (raw: string): string[] =>
    raw.split(/[,，\s]+/).map((s) => s.trim()).filter((s) => s !== '');
  const parseValues = (raw: string): number[] =>
    parseList(raw).map(Number).filter((n) => Number.isFinite(n));

  const [labelText, setLabelText] = useState(data?.labels?.join(', ') ?? '');
  const [valueText, setValueText] = useState(data?.values?.join(', ') ?? '');

  // 外部数据变化（REST 推送）时回写显示，仅当解析结果不一致才覆盖本地输入
  useEffect(() => {
    const cur = { labels: parseList(labelText), values: parseValues(valueText) };
    const ext = { labels: data?.labels ?? [], values: data?.values ?? [] };
    if (JSON.stringify(cur) !== JSON.stringify(ext)) {
      setLabelText(ext.labels.join(', '));
      setValueText(ext.values.join(', '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors flex-1 min-w-0';

  return (
    <div className="p-1.5 rounded bg-surface-base/50">
      <div className="flex items-center gap-1 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[10px] text-textSecondary/60">{name}</span>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] text-textSecondary/40 w-8 shrink-0">标签</span>
        <input
          value={labelText}
          placeholder="周一, 周二, 周三 ..."
          onChange={(e) => {
            const raw = e.target.value;
            setLabelText(raw);
            onChange({ labels: parseList(raw), values: parseValues(valueText) });
          }}
          className={inputCls} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-textSecondary/40 w-8 shrink-0">数值</span>
        <input
          value={valueText}
          placeholder="12, 23, 34, 45 ..."
          onChange={(e) => {
            const raw = e.target.value;
            setValueText(raw);
            onChange({ labels: parseList(labelText), values: parseValues(raw) });
          }}
          className={inputCls} />
      </div>
    </div>
  );
}

/** 多 X 轴走势图数据编辑器 — 底部/顶部两条线 */
function MultiXAxisDataEditor({ bottom, top, onChange }: {
  bottom: { labels?: string[]; values?: number[] } | undefined;
  top: { labels?: string[]; values?: number[] } | undefined;
  onChange: (b: { labels?: string[]; values?: number[] } | undefined, t: { labels?: string[]; values?: number[] } | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <AxisLineFieldsEditor name="底部线（下轴）" color="#00D4FF" data={bottom}
        onChange={(b) => onChange(b, top)} />
      <AxisLineFieldsEditor name="顶部线（上轴）" color="#FF8C42" data={top}
        onChange={(t) => onChange(bottom, t)} />
    </div>
  );
}

/** 蜡烛图数据编辑器 — 每根 K 线: 名称 + 开盘/收盘/最高/最低 */
function CandlestickDataEditor({ candles, onChange }: { candles: any[]; onChange: (cs: any[]) => void }) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-0.5 text-[10px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right w-12';
  const cs = candles.length ? candles : [{ name: '周一', open: 100, close: 105, high: 110, low: 98 }];
  return (
    <div className="space-y-1.5">
      <button onClick={() => onChange([...cs, { name: `K${cs.length + 1}`, open: 100, close: 105, high: 110, low: 98 }])}
        className="w-full text-[10px] py-1 rounded border border-[rgba(0,212,255,0.12)] text-accent-cool/60 hover:text-accent-cool transition-colors">+ 添加K线</button>
      {cs.map((c: any, i: number) => (
        <div key={i} className="flex items-center gap-1 flex-wrap p-1 rounded bg-surface-base/50">
          <input type="text" value={c.name ?? ''} placeholder="名称"
            onChange={(e) => { const n = [...cs]; n[i] = { ...c, name: e.target.value }; onChange(n); }}
            className={`${inputCls} w-10 text-left`} />
          {(['open','close','high','low'] as const).map((f) => (
            <input key={f} type="number" value={c[f] ?? ''} title={f} placeholder="0" step="any"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || raw === '-') return;
                const n = [...cs]; n[i] = { ...c, [f]: Number(raw) }; onChange(n);
              }}
              className={inputCls} />
          ))}
          <button onClick={() => onChange(cs.filter((_: any, j: number) => j !== i))}
            className="text-textSecondary/30 hover:text-negative text-xs px-0.5">×</button>
        </div>
      ))}
    </div>
  );
}

/** 地图钉类型编辑器 */
function PinTypeEditor({ pinTypes, onChange }: { pinTypes: any[]; onChange: (pts: any[]) => void }) {
  const inputCls = 'bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors';
  const icons = getPinIconKeys();
  const colors = ['#00D4FF', '#FF8C42', '#34d399', '#f87171', '#c084fc', '#fbbf24'];

  return (
    <div className="space-y-2">
      <button
        onClick={() => onChange([...pinTypes, { id: 'pt_' + Date.now(), name: '', icon: 'pulse', color: '#FF8C42' }])}
        className="w-full text-[11px] py-1.5 rounded border border-[rgba(0,212,255,0.15)] text-accent-cool/70 hover:text-accent-cool transition-colors"
      >+ 添加类型</button>
      {pinTypes.map((pt: any, i: number) => (
        <div key={pt.id ?? i} className="flex items-center gap-1.5 flex-wrap p-1.5 rounded bg-surface-base/50">
          <input type="text" value={pt.name ?? ''} placeholder="名称"
            onChange={(e) => { const next = [...pinTypes]; next[i] = { ...pt, name: e.target.value }; onChange(next); }}
            className={`${inputCls} flex-1 min-w-0 w-16`} />
          <div className="flex gap-1 flex-wrap" style={{ maxWidth: 148 }}>
            {icons.map((ic) => {
              const active = pt.icon === ic;
              const CustomIcon = getPinCustomIcon(ic);
              const pathD = PIN_ICON_PATHS[ic];
              return (
                <button key={ic} title={getPinIconLabel(ic)}
                  onClick={() => { const next = [...pinTypes]; next[i] = { ...pt, icon: ic }; onChange(next); }}
                  className={`w-8 h-8 rounded-md border flex items-center justify-center transition-all ${
                    active ? 'border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40' : 'border-[rgba(255,255,255,0.06)] bg-surface-base/50 hover:border-accent-cool/50'
                  }`}
                >
                  {CustomIcon ? (
                    <CustomIcon size={16} color={active ? '#00D4FF' : '#9E9EA8'} />
                  ) : pathD ? (
                    <svg width="16" height="16" viewBox="0 0 24 24"><path d={pathD} fill={active ? '#00D4FF' : '#9E9EA8'} /></svg>
                  ) : null}
                </button>
              );
            })}
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
  const lastDraggedPinId = useEditorStore((s) => s.lastDraggedPinId);

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
        const isActive = lastDraggedPinId === pi.id;
        return (
          <div key={pi.id ?? i}
            className={`flex items-center gap-1 flex-wrap p-1.5 rounded transition-colors duration-300 ${
              isActive
                ? 'bg-accent-cool/15 ring-1 ring-accent-cool/40'
                : 'bg-surface-base/50'
            }`}>
            <select value={pi.pinTypeId ?? ''}
              onChange={(e) => { const next = [...pinInstances]; next[i] = { ...pi, pinTypeId: e.target.value }; onChange(next); }}
              className={`${inputCls} flex-1 min-w-0`}>
              {pinTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{getPinIconLabel(t.icon)} {t.name || '(未命名)'}</option>
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
  { value: 'header-custom', label: '自定义图片' },
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
                <span className="font-mono text-accent-cool">{getSubChartLabel(chartType)}</span>
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
                      <>
                        <select value={String(currentValue ?? 'none')}
                          onChange={(e) => update(e.target.value)}
                          className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors text-right appearance-none cursor-pointer" >
                          {HEADER_BORDER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {currentValue === 'header-custom' && (
                          <div className="mt-2">
                            {(headerSlot.options as Record<string, unknown>).customBorderImage ? (
                              <div className="flex items-center gap-2">
                                <img src={String((headerSlot.options as Record<string, unknown>).customBorderImage)} alt="预览" className="w-14 h-8 rounded border border-[rgba(255,255,255,0.08)] object-cover" />
                                <button
                                  onClick={() => setHeaderSlot(headerSlot.id, headerSlot.elementType, { ...headerSlot.options, customBorderImage: undefined })}
                                  className="text-[10px] text-textSecondary/50 hover:text-negative transition-colors"
                                >✕ 清除</button>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-accent-cool border border-accent-cool/25 rounded hover:bg-accent-cool/10 transition-colors cursor-pointer">
                                <span>📁 上传边框图片</span>
                                <input
                                  type="file"
                                  accept=".png,.jpg,.jpeg,.svg"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const url = stageUploadFile(file);
                                    setHeaderSlot(headerSlot.id, headerSlot.elementType, {
                                      ...headerSlot.options,
                                      customBorderImage: url,
                                    });
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </>
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
                        {getSubChartLabel(slot.chartType)}
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
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
                <input type="checkbox"
                  checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">正负着色</span>
                <input type="checkbox"
                  checked={!!(widget.options as Record<string, unknown>).colorBySign}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), colorBySign: e.target.checked } })}
                  className="rounded" />
              </label>
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
              <LabelSelectRow label="玫瑰图" value={String((widget.options as any).roseType ?? 'none')}
                options={['none', 'radius', 'area']}
                labels={['关闭', '按半径', '按面积']}
                onChange={(v) => updateWidget(widget.id, {
                  options: { ...(widget.options as object), roseType: v },
                })} />
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
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
              <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                className="rounded" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">正负着色</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).colorBySign}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), colorBySign: e.target.checked } })}
                className="rounded" />
            </label>
            <LabelSelectRow label="柱宽" value={String((widget.options as Record<string, unknown>).barWidth ?? '50%')}
              options={['30%','50%','70%','90%']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), barWidth: v } })} />
          </CollapsibleFieldGroup>
        )}

        {/* ═══ 分组柱状图配置 ═══ */}
        {widget.type === 'group-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <LineChartDataEditor
                xLabels={Array.isArray((widget.options as any).xLabels) ? (widget.options as any).xLabels : ['周一','周二','周三','周四','周五']}
                lineSeries={Array.isArray((widget.options as any).barSeries) ? (widget.options as any).barSeries : [{ name: '系列1', data: [120,200,150,80,70] }]}
                onChange={(xLabels, series) => updateWidget(widget.id, { options: { ...(widget.options as object), xLabels, barSeries: series } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">条形图</span>
                <input type="checkbox"
                  checked={(widget.options as Record<string, unknown>).direction === 'horizontal'}
                  onChange={(e) => updateWidget(widget.id, {
                    options: { ...(widget.options as object), direction: e.target.checked ? 'horizontal' : 'vertical' },
                  })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">显示数值</span>
                <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).showLabel}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showLabel: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">正负着色</span>
                <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).colorBySign}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), colorBySign: e.target.checked } })}
                  className="rounded" />
              </label>
              <LabelSelectRow label="柱宽" value={String((widget.options as Record<string, unknown>).barWidth ?? '40%')}
                options={['30%','40%','50%','70%']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), barWidth: v } })} />
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 直方图配置 ═══ */}
        {widget.type === 'histogram' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-textSecondary/70">数据（数值数组，逗号/空格分隔）</span>
                <HistogramDataEditor
                  data={Array.isArray((widget.options as any).data) ? (widget.options as any).data as number[] : []}
                  onChange={(d) => updateWidget(widget.id, { options: { ...(widget.options as object), data: d } })} />
              </label>
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="柱色" value={((widget.options as Record<string, unknown>).barColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), barColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">分箱数量</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).binCount ?? 10)} min={2} max={30}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), binCount: Math.max(2, Math.min(30, Number(e.target.value) || 10)) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 置信区间图配置 ═══ */}
        {widget.type === 'confidence-band' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <LineChartDataEditor
                xLabels={Array.isArray((widget.options as any).xLabels) ? (widget.options as any).xLabels : ['周一','周二','周三','周四','周五','周六','周日']}
                lineSeries={((widget.options as any).mainSeries && Array.isArray((widget.options as any).mainSeries.data)) ? [(widget.options as any).mainSeries] : [{ name: '观测值', data: [42,45,44,48,46,50,49] }]}
                onChange={(xLabels, series) => updateWidget(widget.id, { options: { ...(widget.options as object), xLabels, mainSeries: series[0] } })} />
              <div className="mt-2 space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-textSecondary/70">上界（与主线同长度）</span>
                  <NumberArrayTextEditor
                    data={Array.isArray((widget.options as any).upper) ? (widget.options as any).upper as number[] : []}
                    onChange={(d) => updateWidget(widget.id, { options: { ...(widget.options as object), upper: d } })}
                    placeholder="46, 49, 48, 53, 51, 55, 54 ..." />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-textSecondary/70">下界（与主线同长度）</span>
                  <NumberArrayTextEditor
                    data={Array.isArray((widget.options as any).lower) ? (widget.options as any).lower as number[] : []}
                    onChange={(d) => updateWidget(widget.id, { options: { ...(widget.options as object), lower: d } })}
                    placeholder="38, 41, 40, 43, 41, 45, 44 ..." />
                </label>
              </div>
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="主线颜色" value={((widget.options as Record<string, unknown>).lineColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), lineColor: c } })} />
              <ColorSwatchRow label="区间颜色" value={((widget.options as Record<string, unknown>).bandColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), bandColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 大规模面积图配置 ═══ */}
        {widget.type === 'large-area-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <LargeAreaDataEditor
                points={Array.isArray((widget.options as any).points) ? (widget.options as any).points as { time: number; value: number }[] : []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), points: pts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="线颜色" value={((widget.options as Record<string, unknown>).lineColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), lineColor: c } })} />
              <ColorSwatchRow label="面积颜色" value={((widget.options as Record<string, unknown>).areaColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), areaColor: c } })} />
              <LabelSelectRow label="降采样" value={String((widget.options as Record<string, unknown>).sampling ?? 'lttb')}
                options={['lttb','average','max','min','sum','none']}
                labels={['LTTB','平均','最大','最小','求和','关闭']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), sampling: v } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 阶梯线图配置 ═══ */}
        {widget.type === 'step-line' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <StepLineDataEditor
                points={Array.isArray((widget.options as any).points) ? (widget.options as any).points as { x: number | string; value: number }[] : []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), points: pts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <LabelSelectRow label="阶梯拐点" value={String((widget.options as Record<string, unknown>).step ?? 'middle')}
                options={['start','middle','end']}
                labels={['起点拐','中点拐','终点拐']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), step: v } })} />
              <ColorSwatchRow label="线颜色" value={((widget.options as Record<string, unknown>).lineColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), lineColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 动态时间轴配置 ═══ */}
        {widget.type === 'dynamic-time' && (
          <>
            <CollapsibleFieldGroup label="动态" defaultOpen={true}>
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">动态追加</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).dynamic as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), dynamic: e.target.checked } })}
                  className="rounded" />
              </label>
              <LabelSelectRow label="更新间隔" value={String((widget.options as Record<string, unknown>).interval ?? 1000)}
                options={['500','1000','2000','5000']}
                labels={['0.5秒','1秒','2秒','5秒']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), interval: Number(v) } })} />
              <LabelSelectRow label="滑窗大小" value={String((widget.options as Record<string, unknown>).windowSize ?? 60)}
                options={['30','60','120','240']}
                labels={['30点','60点','120点','240点']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), windowSize: Number(v) } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="数值" defaultOpen={false}>
              <LargeAreaDataEditor
                points={Array.isArray((widget.options as any).points) ? (widget.options as any).points as { time: number; value: number }[] : []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), points: pts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="线颜色" value={((widget.options as Record<string, unknown>).lineColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), lineColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 散点图配置 ═══ */}
        {widget.type === 'scatter-plot' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <VoronoiDataEditor
                points={Array.isArray((widget.options as any).points) ? (widget.options as any).points : []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), points: pts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="点颜色" value={((widget.options as Record<string, unknown>).pointColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), pointColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">点大小</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).symbolSize ?? 8)} min={3} max={30}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), symbolSize: Math.max(3, Math.min(30, Number(e.target.value) || 8)) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 断轴走势图配置 ═══ */}
        {widget.type === 'intraday-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <IntradayDataEditor
                points={Array.isArray((widget.options as any).points) ? (widget.options as any).points as { time: string; value: number }[] : []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), points: pts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="线颜色" value={((widget.options as Record<string, unknown>).lineColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), lineColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 雷达图配置 ═══ */}
        {widget.type === 'radar-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <RadarDataEditor
                indicators={Array.isArray((widget.options as any).indicators) ? (widget.options as any).indicators : []}
                series={Array.isArray((widget.options as any).series) ? (widget.options as any).series : []}
                onChange={(inds, sers) => updateWidget(widget.id, { options: { ...(widget.options as object), indicators: inds, series: sers } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="线颜色" value={((widget.options as Record<string, unknown>).lineColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), lineColor: c } })} />
              <ColorSwatchRow label="面积颜色" value={((widget.options as Record<string, unknown>).areaColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), areaColor: c } })} />
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 热力图配置 ═══ */}
        {widget.type === 'heatmap' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <HeatmapDataEditor
                points={Array.isArray((widget.options as any).points) ? (widget.options as any).points as { x: number; y: number; value: number }[] : []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), points: pts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <LabelSelectRow label="色板" value={String((widget.options as any).paletteKey ?? 'electric')}
                options={['electric','ocean','fire','forest','purple']}
                labels={['电光蓝','海洋','火焰','森林','紫罗兰']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), paletteKey: v } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 关系图配置 ═══ */}
        {widget.type === 'relation-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <RelationDataEditor
                nodes={Array.isArray((widget.options as any).nodes) ? (widget.options as any).nodes : []}
                links={Array.isArray((widget.options as any).links) ? (widget.options as any).links : []}
                onChange={(ns, ls) => updateWidget(widget.id, { options: { ...(widget.options as object), nodes: ns, links: ls } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="节点颜色" value={((widget.options as Record<string, unknown>).nodeColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), nodeColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">隐藏重叠标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).hideOverlap as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), hideOverlap: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 桑基图配置 ═══ */}
        {widget.type === 'sankey-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <SankeyDataEditor
                nodes={Array.isArray((widget.options as any).nodes) ? (widget.options as any).nodes : []}
                links={Array.isArray((widget.options as any).links) ? (widget.options as any).links : []}
                onChange={(ns, ls) => updateWidget(widget.id, { options: { ...(widget.options as object), nodes: ns, links: ls } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <LabelSelectRow label="布局方向" value={String((widget.options as Record<string, unknown>).orient ?? 'horizontal')}
                options={['horizontal', 'vertical']}
                labels={['横向', '纵向']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), orient: v } })} />
              <LabelSelectRow label="高亮模式" value={String((widget.options as Record<string, unknown>).focusMode ?? 'adjacency')}
                options={['adjacency', 'none']}
                labels={['相邻链路', '无']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), focusMode: v } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">节点宽度</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).nodeWidth ?? 14)} min={4} max={60} step={1}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), nodeWidth: Number(e.target.value) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">节点间距</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).nodeGap ?? 12)} min={2} max={60} step={1}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), nodeGap: Number(e.target.value) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">连线透明度</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).lineOpacity ?? 0.35)} min={0.05} max={1} step={0.05}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), lineOpacity: Number(e.target.value) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 树形图配置 ═══ */}
        {widget.type === 'tree-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <TreeDataEditor
                trees={Array.isArray((widget.options as any).trees) ? (widget.options as any).trees : []}
                onChange={(ts) => updateWidget(widget.id, { options: { ...(widget.options as object), trees: ts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <LabelSelectRow label="朝向" value={String((widget.options as Record<string, unknown>).orient ?? 'LR')}
                options={['LR', 'TB', 'RL', 'BT']}
                labels={['左→右', '上→下', '右→左', '下→上']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), orient: v } })} />
              <ColorSwatchRow label="节点颜色" value={((widget.options as Record<string, unknown>).nodeColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), nodeColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">点击展开/折叠</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).expandCollapse as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), expandCollapse: e.target.checked } })}
                  className="rounded" />
              </label>
              <LabelSelectRow label="初始深度" value={String((widget.options as Record<string, unknown>).initialDepth ?? 2)}
                options={['1','2','3','4']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), initialDepth: Number(v) } })} />
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 矩形树图配置 ═══ */}
        {widget.type === 'treemap-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <HierarchyDataEditor
                label="树（节点：名称 + 值）"
                data={Array.isArray((widget.options as any).treemaps) ? (widget.options as any).treemaps : []}
                onChange={(ts) => updateWidget(widget.id, { options: { ...(widget.options as object), treemaps: ts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">面包屑导航</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).breadcrumb as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), breadcrumb: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">滚轮缩放</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).roam as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), roam: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">点击下钻</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).drillDown as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), drillDown: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 旭日图配置 ═══ */}
        {widget.type === 'sunburst-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <HierarchyDataEditor
                label="环（节点：名称 + 值）"
                data={Array.isArray((widget.options as any).sunbursts) ? (widget.options as any).sunbursts : []}
                onChange={(ts) => updateWidget(widget.id, { options: { ...(widget.options as object), sunbursts: ts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-textSecondary/70">点击下钻</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).drillDown as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), drillDown: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">顺时针</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).clockwise as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), clockwise: e.target.checked } })}
                  className="rounded" />
              </label>
              <LabelSelectRow label="排序" value={String((widget.options as Record<string, unknown>).sortMode ?? 'none')}
                options={['none', 'desc', 'asc']}
                labels={['数据顺序', '从大到小', '从小到大']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), sortMode: v } })} />
              <LabelSelectRow label="高亮模式" value={String((widget.options as Record<string, unknown>).focusMode ?? 'ancestor')}
                options={['ancestor', 'descendant', 'self', 'none']}
                labels={['祖先', '后代', '自身', '无']}
                onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), focusMode: v } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">显示标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showLabel as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showLabel: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 多 X 轴走势图配置 ═══ */}
        {widget.type === 'multiple-x-axis-chart' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <MultiXAxisDataEditor
                bottom={(widget.options as any).bottom}
                top={(widget.options as any).top}
                onChange={(b, t) => updateWidget(widget.id, { options: { ...(widget.options as object), bottom: b, top: t } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="底部线颜色" value={((widget.options as Record<string, unknown>).bottomColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), bottomColor: c } })} />
              <ColorSwatchRow label="顶部线颜色" value={((widget.options as Record<string, unknown>).topColor as string) ?? '#FF8C42'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), topColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">平滑曲线</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).smooth as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), smooth: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">显示图例</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showLegend as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showLegend: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">显示轴标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showAxisLabel as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showAxisLabel: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">轴标签旋转</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).labelRotate ?? 20)} min={0} max={90} step={1}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), labelRotate: Number(e.target.value) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ Voronoi 图配置 ═══ */}
        {widget.type === 'voronoi' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <VoronoiDataEditor
                points={Array.isArray((widget.options as any).points) ? (widget.options as any).points : []}
                onChange={(pts) => updateWidget(widget.id, { options: { ...(widget.options as object), points: pts } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="点颜色" value={((widget.options as Record<string, unknown>).pointColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), pointColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">显示区域</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showCells as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showCells: e.target.checked } })}
                  className="rounded" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 图片专属配置 ═══ */}
        {widget.type === 'image-widget' && (
          <CollapsibleFieldGroup label="图片" defaultOpen={true}>
            {/* 文件上传 */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-textSecondary/70">图片文件 (JPG/PNG/SVG，可多选)</span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  const existing: any[] = [...((widget.options as any).images || [])];
                  let loaded = 0;
                  files.forEach((file) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      existing.push({ url: reader.result as string, pinned: true });
                      loaded++;
                      if (loaded === files.length) {
                        updateWidget(widget.id, { options: { ...(widget.options as object), images: [...existing] } });
                      }
                    };
                    reader.readAsDataURL(file);
                  });
                }}
                className="text-[11px] text-textSecondary/70 file:mr-2 file:py-1 file:px-2 file:text-[11px] file:rounded file:border file:border-[rgba(0,212,255,0.2)] file:bg-surface-hover file:text-textSecondary hover:file:text-text file:cursor-pointer" />
            </label>

            {/* 图片列表 — 统一数组，图钉标记保护 */}
            {((widget.options as any).images as any[])?.length > 0 && (
              <div className="space-y-1 mt-1">
                {((widget.options as any).images as any[]).map((img: any, i: number) => {
                  const url = typeof img === 'string' ? img : img?.url || '';
                  const pinned = !!(img && typeof img === 'object' && img.pinned);
                  return (
                    <div key={i} className={`flex items-center gap-2 rounded p-1 transition-colors ${pinned ? 'bg-accent-warm/10 border border-accent-warm/25' : 'bg-surface-base/50'}`}>
                      <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      <span className="text-[10px] text-textSecondary/60 flex-1 min-w-0 truncate">图片 {i + 1}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = ((widget.options as any).images as any[]).map((item: any, j: number) =>
                            j === i ? { url: typeof item === 'string' ? item : item.url, pinned: !pinned } : item
                          );
                          updateWidget(widget.id, { options: { ...(widget.options as object), images: next } });
                        }}
                        className={`flex-shrink-0 p-1 rounded transition-all ${pinned ? 'text-accent-warm bg-accent-warm/15 hover:bg-accent-warm/25' : 'text-textSecondary/20 hover:text-textSecondary/50 hover:bg-surface-hover'}`}
                        title={pinned ? '已固定 · 点击取消' : '未固定 · 点击保护'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={pinned ? '1' : '1.5'} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v2" />
                          <path d="M4 7h16" />
                          <path d="M17 7l-1.5 9.5a2 2 0 0 1-2 1.5h-3a2 2 0 0 1-2-1.5L7 7" />
                          <path d="M9.5 21h5" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = ((widget.options as any).images as any[]).filter((_: any, j: number) => j !== i);
                          updateWidget(widget.id, { options: { ...(widget.options as object), images: next.length > 0 ? next : undefined } });
                        }}
                        className="text-negative/40 hover:text-negative flex-shrink-0 p-1 hover:bg-negative/10 rounded transition-colors"
                      >×</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 向后兼容：旧数据有 src 无 images 时显示移除按钮 */}
            {(widget.options as any).src && !((widget.options as any).images as string[])?.length && (
              <button
                onClick={() => updateWidget(widget.id, { options: { ...(widget.options as object), src: undefined } })}
                className="text-[11px] text-negative/60 hover:text-negative mt-1"
              >移除图片</button>
            )}

            {/* 轮播间隔 */}
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">轮播间隔(秒)</span>
              <input type="number" min={0} step={1} value={Number((widget.options as any).slideshowInterval ?? 0)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), slideshowInterval: Math.max(0, Number(e.target.value)) } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <p className="text-[10px] text-textSecondary/40 -mt-1">0 = 不轮播，显示第一张</p>

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

        {/* ═══ 视频专属配置 ═══ */}
        {widget.type === 'video-widget' && (
          <CollapsibleFieldGroup label="视频" defaultOpen={true}>
            {/* 文件上传 — 延迟上传模式（选文件不立刻上传，保存时才上传） */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-textSecondary/70">
                视频文件 (MP4/WebM，可多选)
                <span className="ml-1 text-accent-cool/60">{((widget.options as any).videos?.length ?? 0)}/4</span>
              </span>
              {((widget.options as any).videos?.length ?? 0) >= 4 ? (
                <p className="text-[10px] text-accent-warm/60">已达上限（4个），请先删除旧视频再添加</p>
              ) : (
                <input
                  type="file"
                  multiple
                  accept=".mp4,.webm,video/mp4,video/webm"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    const existing: any[] = [...((widget.options as any).videos || [])];
                    const remaining = 4 - existing.length;
                    const toAdd = files.slice(0, remaining);
                    let loaded = 0;
                    toAdd.forEach((file) => {
                      const blobUrl = stageUploadFile(file);
                      existing.push({ url: blobUrl, pinned: true });
                      loaded++;
                      if (loaded === toAdd.length) {
                        updateWidget(widget.id, { options: { ...(widget.options as object), videos: [...existing] } });
                      }
                    });
                  }}
                  className="text-[11px] text-textSecondary/70 file:mr-2 file:py-1 file:px-2 file:text-[11px] file:rounded file:border file:border-[rgba(0,212,255,0.2)] file:bg-surface-hover file:text-textSecondary hover:file:text-text file:cursor-pointer" />
              )}
            </label>

            {/* 视频列表 — 图钉保护 */}
            {((widget.options as any).videos as any[])?.length > 0 && (
              <div className="space-y-1 mt-1">
                {((widget.options as any).videos as any[]).map((vid: any, i: number) => {
                  const url = typeof vid === 'string' ? vid : vid?.url || '';
                  const pinned = !!(vid && typeof vid === 'object' && vid.pinned);
                  const isBlob = url.startsWith('blob:');
                  return (
                    <div key={i} className={`flex items-center gap-2 rounded p-1 transition-colors ${pinned ? 'bg-accent-warm/10 border border-accent-warm/25' : 'bg-surface-base/50'}`}>
                      <span className="text-[10px] text-textSecondary/60 flex-1 min-w-0 truncate">
                        {isBlob ? `📹 待上传` : `🎬 视频 ${i + 1}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = ((widget.options as any).videos as any[]).map((item: any, j: number) =>
                            j === i ? { url: typeof item === 'string' ? item : item.url, pinned: !pinned } : item
                          );
                          updateWidget(widget.id, { options: { ...(widget.options as object), videos: next } });
                        }}
                        className={`flex-shrink-0 p-1 rounded transition-all ${pinned ? 'text-accent-warm bg-accent-warm/15 hover:bg-accent-warm/25' : 'text-textSecondary/20 hover:text-textSecondary/50 hover:bg-surface-hover'}`}
                        title={pinned ? '已固定 · 点击取消' : '未固定 · 点击保护'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={pinned ? '1' : '1.5'}>
                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v4h1.6v-4H18v-2l-2-2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = ((widget.options as any).videos as any[]).filter((_: any, j: number) => j !== i);
                          updateWidget(widget.id, { options: { ...(widget.options as object), videos: next.length > 0 ? next : undefined } });
                        }}
                        className="text-negative/40 hover:text-negative flex-shrink-0 p-1 hover:bg-negative/10 rounded transition-colors"
                      >×</button>
                    </div>
                  );
                })}
              </div>
            )}

            <LabelSelectRow label="填充方式" value={String((widget.options as any).fit ?? 'contain')}
              options={['contain','cover','fill']}
              labels={['适配','裁剪','拉伸']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), fit: v } })} />

            {/* 播放选项 */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                ['muted', '静音'],
                ['autoplay', '自动播放'],
                ['loop', '循环'],
                ['controls', '控件'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-1 text-[11px] text-textSecondary/70">
                  <input type="checkbox" checked={!!(widget.options as any)[key]}
                    onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), [key]: e.target.checked } })}
                    className="w-3 h-3" />
                  {label}
                </label>
              ))}
            </div>
            <LabelSelectRow label="预加载" value={String((widget.options as any).preload ?? 'metadata')}
              options={['metadata','auto','none']}
              labels={['仅元数据','自动','不预加载']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), preload: v } })} />
          </CollapsibleFieldGroup>
        )}

        {/* ═══ 箱线图配置 ═══ */}
        {widget.type === 'box-plot' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <BoxPlotDataEditor
                categories={Array.isArray((widget.options as Record<string, unknown>).categories) ? (widget.options as Record<string, unknown>).categories as any[] : []}
                onChange={(cats) => updateWidget(widget.id, { options: { ...(widget.options as object), categories: cats } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="盒子颜色" value={((widget.options as Record<string, unknown>).boxColor as string) ?? '#00D4FF'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), boxColor: c } })} />
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">刻度线对齐标签</span>
                <input type="checkbox" checked={((widget.options as Record<string, unknown>).showTick as boolean) ?? true}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTick: e.target.checked } })}
                  className="rounded" />
              </label>
              <label className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-textSecondary/70">盒子宽度</span>
                <input type="number" value={Number((widget.options as Record<string, unknown>).boxWidth ?? 20)} min={5} max={50}
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), boxWidth: Number(e.target.value) } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
              </label>
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 蜡烛图配置 ═══ */}
        {widget.type === 'candlestick' && (
          <>
            <CollapsibleFieldGroup label="数值" defaultOpen={true}>
              <CandlestickDataEditor
                candles={Array.isArray((widget.options as Record<string, unknown>).candles) ? (widget.options as Record<string, unknown>).candles as any[] : []}
                onChange={(cs) => updateWidget(widget.id, { options: { ...(widget.options as object), candles: cs } })} />
            </CollapsibleFieldGroup>
            <CollapsibleFieldGroup label="样式" defaultOpen={false}>
              <ColorSwatchRow label="阳线颜色" value={((widget.options as Record<string, unknown>).upColor as string) ?? '#34d399'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), upColor: c } })} />
              <ColorSwatchRow label="阴线颜色" value={((widget.options as Record<string, unknown>).downColor as string) ?? '#f87171'} colors={PRESET_VALUE_COLORS} onChange={(c) => updateWidget(widget.id, { options: { ...(widget.options as object), downColor: c } })} />
            </CollapsibleFieldGroup>
          </>
        )}

        {/* ═══ 滚动表格配置 ═══ */}
        {/* ═══ 水位球配置 ═══ */}
        {widget.type === 'water-pond' && (
          <>
          <CollapsibleFieldGroup label="数据" defaultOpen={true}>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">百分比</span>
              <input type="number" min={0} max={100} step={1}
                value={Number((widget.options as any).value ?? 60)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), value: Math.max(0, Math.min(100, Number(e.target.value))) } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">标题</span>
              <input type="text" value={(widget.options as any).title ?? ''}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), title: e.target.value } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-28 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">后缀</span>
              <input type="text" value={(widget.options as any).suffix ?? '%'}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), suffix: e.target.value } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">标题颜色</span>
              <select value={(widget.options as any).titleColor ?? '#E8E8EC'}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), titleColor: e.target.value } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1 py-1 w-24 text-[11px] text-text focus:outline-none focus:border-accent-cool/50 transition-colors">
                {['#E8E8EC','#00D4FF','#FF8C42','#34d399','#f87171','#FFFFFF','#9E9EA8'].map(c => (
                  <option key={c} value={c} style={{backgroundColor:'#2C2C34',color:c}}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">标题字号</span>
              <input type="number" min={10} max={24} step={1}
                value={Number((widget.options as any).titleFontSize ?? 14)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), titleFontSize: Number(e.target.value) } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
          </CollapsibleFieldGroup>
          <CollapsibleFieldGroup label="样式" defaultOpen={false}>
            <LabelSelectRow label="形状" value={String((widget.options as any).shape ?? 'round')}
              options={['round','roundRect','rect']}
              labels={['圆形','圆角矩形','矩形']}
              onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), shape: v } })} />
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">波浪高度</span>
              <input type="number" min={5} max={100} step={5}
                value={Number((widget.options as any).waveHeight ?? 30)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), waveHeight: Number(e.target.value) } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">波浪层数</span>
              <input type="number" min={1} max={6} step={1}
                value={Number((widget.options as any).waveNum ?? 3)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), waveNum: Number(e.target.value) } })}
                className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-16 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
            </label>
          </CollapsibleFieldGroup>
          </>
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
              <span className="text-[11px] text-textSecondary/70">显示图标</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).showIcon}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showIcon: e.target.checked, showRing: e.target.checked ? false : (widget.options as Record<string, unknown>).showRing } })}
                className="rounded" />
            </label>
            {!!(widget.options as Record<string, unknown>).showIcon && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {ICON_PRESET_KEYS.map((key) => {
                    const active = (widget.options as Record<string, unknown>).customIconImage === 'supercons:' + key;
                    return (
                      <button key={key}
                        onClick={() => updateWidget(widget.id, { options: { ...(widget.options as object), customIconImage: active ? undefined : 'supercons:' + key } })}
                        title={key}
                        className={`w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                          active ? 'border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40'
                                 : 'border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-accent-cool/50 hover:bg-accent-cool/5'
                        }`}
                        style={{ color: '#00D4FF' }}
                      >
                        <IconPresetRenderer name={key} size={20} />
                      </button>
                    );
                  })}
                  {IMAGE_ICON_PRESETS.map((p) => {
                    const active = (widget.options as Record<string, unknown>).customIconImage === p.url;
                    return (
                      <button key={p.key}
                        onClick={() => updateWidget(widget.id, { options: { ...(widget.options as object), customIconImage: active ? undefined : p.url } })}
                        title={p.label}
                        className={`w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                          active ? 'border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40'
                                 : 'border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-accent-cool/50 hover:bg-accent-cool/5'
                        }`}
                      >
                        <img src={p.url} alt={p.label} className="w-5 h-5 object-contain" />
                      </button>
                    );
                  })}
                  {(widget.options as Record<string, unknown>).customIconImage && !String((widget.options as Record<string, unknown>).customIconImage).startsWith('supercons:') && !IMAGE_ICON_PRESETS.some(p => p.url === (widget.options as Record<string, unknown>).customIconImage) ? (
                    <button onClick={() => updateWidget(widget.id, { options: { ...(widget.options as object), customIconImage: undefined } })}
                      className="w-9 h-9 rounded-md border border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40 flex flex-col items-center justify-center flex-shrink-0"
                    >
                      <img src={String((widget.options as Record<string, unknown>).customIconImage)} alt="" className="w-5 h-5 object-contain rounded" />
                    </button>
                  ) : (
                    <label className="w-9 h-9 rounded-md border border-dashed border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-accent-cool/50 hover:bg-accent-cool/5 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer">
                      <span className="text-[10px] text-textSecondary/30">+</span>
                      <input type="file" accept=".png,.jpg,.jpeg,.svg" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = stageUploadFile(file);
                          updateWidget(widget.id, { options: { ...(widget.options as object), customIconImage: url } });
                        }} />
                    </label>
                  )}
                </div>
              </div>
            )}
            <hr className="border-[rgba(255,255,255,0.04)] my-1" />
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">占比环</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).showRing}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showRing: e.target.checked, showIcon: e.target.checked ? false : (widget.options as Record<string, unknown>).showIcon } })}
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

            <hr className="border-[rgba(255,255,255,0.04)] my-1" />
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-textSecondary/70">增长率</span>
              <input type="checkbox" checked={!!(widget.options as Record<string, unknown>).showTrend}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showTrend: e.target.checked } })}
                className="rounded" />
            </label>
            {!!(widget.options as Record<string, unknown>).showTrend && (
              <>
                <LabelSelectRow label="数据来源" value={String((widget.options as Record<string, unknown>).trendMode ?? 'auto')}
                  options={['auto','manual']} labels={['自动计算','手动输入']}
                  onChange={(v) => updateWidget(widget.id, { options: { ...(widget.options as object), trendMode: v } })} />
                {(widget.options as Record<string, unknown>).trendMode === 'manual' && (
                  <label className="flex items-center justify-between">
                    <span className="text-[11px] text-textSecondary/70">增长率(%)</span>
                    <input type="number" value={Number((widget.options as Record<string, unknown>).trend ?? 0)}
                      onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), trend: Number(e.target.value) } })}
                      className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-20 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
                  </label>
                )}
                <label className="flex items-center justify-between">
                  <span className="text-[11px] text-textSecondary/70">对比标签</span>
                  <input type="text" value={String((widget.options as Record<string, unknown>).trendLabel ?? '')}
                    onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), trendLabel: e.target.value } })}
                    placeholder="如: vs 昨日"
                    className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right" />
                </label>
              </>
            )}
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
              <label className="flex flex-col gap-1 mt-2">
                <span className="text-[11px] text-textSecondary/70">地图名</span>
                <input type="text" value={String((widget.options as Record<string, unknown>).mapName ?? '')}
                  placeholder="留空则不显示"
                  onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), mapName: e.target.value } })}
                  className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors" />
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

        {/* ═══ 赛博城市专属配置 ═══ */}
        {widget.type === 'cyber-city' && (
          <CollapsibleFieldGroup label="城市配置" defaultOpen={true}>
            <label className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-textSecondary/70">高度倍率</span>
              <input type="range" min={0.2} max={3} step={0.1}
                value={Number((widget.options as Record<string, unknown>).heightScale ?? 1)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), heightScale: Number(e.target.value) } })}
                className="w-24" />
              <span className="text-[11px] text-textSecondary/50 w-8 text-right font-mono">{(widget.options as Record<string, unknown>).heightScale as number ?? 1}x</span>
            </label>
            <label className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-textSecondary/70">显示网格</span>
              <input type="checkbox" checked={Boolean((widget.options as Record<string, unknown>).showGrid ?? true)}
                onChange={(e) => updateWidget(widget.id, { options: { ...(widget.options as object), showGrid: e.target.checked } })} />
            </label>
          </CollapsibleFieldGroup>
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
          {(widget.style.borderStyle === 'custom') && (
            <div className="mt-2 space-y-2">
              {widget.style.customBorderImage ? (
                <div className="flex items-center gap-2">
                  <img src={widget.style.customBorderImage} alt="自定义边框预览" className="w-16 h-10 rounded border border-[rgba(255,255,255,0.08)] object-cover" />
                  <button
                    onClick={() => updateWidget(widget.id, {
                      style: { ...widget.style, customBorderImage: undefined },
                    })}
                    className="text-[10px] text-textSecondary/50 hover:text-negative transition-colors"
                  >✕ 清除</button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-accent-cool border border-accent-cool/25 rounded hover:bg-accent-cool/10 transition-colors cursor-pointer">
                  <span>📁 上传边框图片</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = stageUploadFile(file);
                      updateWidget(widget.id, {
                        style: { ...widget.style, customBorderImage: url },
                      });
                    }}
                  />
                </label>
              )}
              <p className="text-[9px] text-textSecondary/30">支持 PNG / JPG / SVG，保存时自动上传</p>
            </div>
          )}
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
const PRESET_VALUE_COLORS = ["#FFFFFF", "#00D4FF", "#FF8C42", "#34d399", "#f87171"];
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
  { value: 'DataV_1', label: 'DataV_1' },
  { value: 'DataV_2', label: 'DataV_2' },
  { value: 'DataV_3', label: 'DataV_3' },
  { value: 'DataV_4', label: 'DataV_4' },
  { value: 'DataV_5', label: 'DataV_5' },
  { value: 'DataV_6', label: 'DataV_6' },
  { value: 'DataV_7', label: 'DataV_7' },
  { value: 'DataV_8', label: 'DataV_8' },
  { value: 'DataV_9', label: 'DataV_9' },
  { value: 'DataV_10', label: 'DataV_10' },
  { value: 'DataV_11', label: 'DataV_11' },
  { value: 'DataV_12', label: 'DataV_12' },
  { value: 'DataV_13', label: 'DataV_13' },
  { value: 'custom', label: '自定义图片' },
];

function BorderThumbnail({ style }: { style: WidgetStyle['borderStyle'] }) {
  const SIZE = 48;
  const PAD = 8;
  if (style === 'none') return <Ban size={20} strokeWidth={1.5} className="text-textSecondary/40" />;
  // 尚未实现的样式 → 占位符
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
      {style === 'DataV_1' && (
        <>
          {/* DataV BorderBox1 风格 — 四角折线 + 上下横线 */}
          <polyline points={`${PAD+2},${PAD+6} ${PAD+2},${PAD+2} ${PAD+6},${PAD+2}`} stroke="#00D4FF" strokeWidth="1" fill="none" />
          <polyline points={`${SIZE-PAD-6},${PAD+2} ${SIZE-PAD-2},${PAD+2} ${SIZE-PAD-2},${PAD+6}`} stroke="#00D4FF" strokeWidth="1" fill="none" />
          <polyline points={`${PAD+2},${SIZE-PAD-6} ${PAD+2},${SIZE-PAD-2} ${PAD+6},${SIZE-PAD-2}`} stroke="#00D4FF" strokeWidth="1" fill="none" />
          <polyline points={`${SIZE-PAD-6},${SIZE-PAD-2} ${SIZE-PAD-2},${SIZE-PAD-2} ${SIZE-PAD-2},${SIZE-PAD-6}`} stroke="#00D4FF" strokeWidth="1" fill="none" />
          {/* Top/bottom double lines */}
          <line x1={PAD+4} y1={PAD-0.5} x2={SIZE/2-3} y2={PAD-0.5} stroke="#00D4FF" strokeWidth="0.8" />
          <line x1={SIZE/2+3} y1={PAD-0.5} x2={SIZE-PAD-4} y2={PAD-0.5} stroke="#00D4FF" strokeWidth="0.8" />
          <line x1={PAD+1} y1={PAD+1.5} x2={SIZE/2-3} y2={PAD+1.5} stroke="#00D4FF" strokeWidth="0.4" opacity="0.5" />
          <line x1={SIZE/2+3} y1={PAD+1.5} x2={SIZE-PAD-1} y2={PAD+1.5} stroke="#00D4FF" strokeWidth="0.4" opacity="0.5" />
          <line x1={PAD+4} y1={SIZE-PAD+0.5} x2={SIZE-PAD-4} y2={SIZE-PAD+0.5} stroke="#00D4FF" strokeWidth="0.8" />
          {/* Center diamond */}
          <polygon points={`${SIZE/2},${PAD+1} ${SIZE/2+2},${PAD+3} ${SIZE/2},${PAD+5} ${SIZE/2-2},${PAD+3}`} fill="#00D4FF" opacity="0.5" />
          {/* Inner rect hint */}
          <rect x={PAD+6} y={PAD+7} width={SIZE-PAD*2-12} height={SIZE-PAD*2-14} rx="1" fill="none" stroke="#00D4FF" strokeWidth="0.3" opacity="0.3" />
        </>
      )}
      {style === 'DataV_2' && (
        <>
          {/* 双层矩形 + 四角圆点 */}
          <rect x={PAD} y={PAD} width={SIZE-PAD*2} height={SIZE-PAD*2} rx="1" fill="none" stroke="#00D4FF" strokeWidth="1" opacity="0.8" />
          <rect x={PAD+4} y={PAD+4} width={SIZE-PAD*2-8} height={SIZE-PAD*2-8} rx="1" fill="none" stroke="#00D4FF" strokeWidth="0.8" opacity="0.4" />
          <circle cx={PAD+3} cy={PAD+3} r="1.2" fill="#00D4FF" />
          <circle cx={SIZE-PAD-3} cy={PAD+3} r="1.2" fill="#00D4FF" />
          <circle cx={SIZE-PAD-3} cy={SIZE-PAD-3} r="1.2" fill="#00D4FF" />
          <circle cx={PAD+3} cy={SIZE-PAD-3} r="1.2" fill="#00D4FF" />
        </>
      )}
      {style === 'DataV_3' && (
        <>
          <rect x={PAD-2} y={PAD-2} width={SIZE-PAD*2+4} height={SIZE-PAD*2+4} fill="none" stroke="#00D4FF" strokeWidth="2" />
          <rect x={PAD+4} y={PAD+4} width={SIZE-PAD*2-8} height={SIZE-PAD*2-8} fill="none" stroke="#00D4FF" strokeWidth="0.8" opacity="0.6" />
          <rect x={PAD+10} y={PAD+10} width={SIZE-PAD*2-20} height={SIZE-PAD*2-20} fill="none" stroke="#00D4FF" strokeWidth="0.6" opacity="0.4" />
          <rect x={PAD+16} y={PAD+16} width={SIZE-PAD*2-32} height={SIZE-PAD*2-32} fill="none" stroke="#00D4FF" strokeWidth="0.4" opacity="0.25" />
        </>
      )}
      {style === 'DataV_4' && (
        <>
          {/* 顶部横线 + 虚线 */}
          <line x1={PAD} y1={PAD} x2={SIZE-PAD} y2={PAD} stroke="#00D4FF" strokeWidth="1" />
          <line x1={PAD} y1={PAD+4} x2={SIZE/2} y2={PAD+4} stroke="#00D4FF" strokeWidth="0.5" strokeDasharray="3 2" />
          <line x1={PAD-2} y1={PAD+10} x2={PAD-2} y2={SIZE/2} stroke="#00D4FF" strokeWidth="1.5" />
          <line x1={SIZE/2} y1={SIZE-PAD} x2={SIZE-PAD} y2={SIZE-PAD} stroke="#00D4FF" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        </>
      )}
      {style === 'DataV_5' && (
        <>
          {/* 多层不等距框 + 缺口 */}
          <rect x={PAD-1} y={PAD-1} width={SIZE-PAD*2+2} height={SIZE-PAD*2+2} fill="none" stroke="#00D4FF" strokeWidth="1" />
          <rect x={PAD+3} y={PAD+3} width={SIZE-PAD*2-6} height={SIZE-PAD*2-8} fill="none" stroke="#00D4FF" strokeWidth="0.6" opacity="0.5" />
          <line x1={PAD+8} y1={PAD+6} x2={SIZE-PAD-8} y2={PAD+6} stroke="#00D4FF" strokeWidth="2" opacity="0.6" />
        </>
      )}
      {style === 'DataV_6' && (
        <>
          {/* 四角圆点 + 十字线 */}
          <circle cx={PAD+2} cy={PAD+2} r="1.5" fill="#00D4FF" />
          <circle cx={SIZE-PAD-2} cy={PAD+2} r="1.5" fill="#00D4FF" />
          <circle cx={PAD+2} cy={SIZE-PAD-2} r="1.5" fill="#00D4FF" />
          <circle cx={SIZE-PAD-2} cy={SIZE-PAD-2} r="1.5" fill="#00D4FF" />
          <line x1={PAD+6} y1={PAD} x2={SIZE-PAD-6} y2={PAD} stroke="#00D4FF" strokeWidth="0.8" />
          <line x1={PAD+6} y1={SIZE-PAD} x2={SIZE-PAD-6} y2={SIZE-PAD} stroke="#00D4FF" strokeWidth="0.8" />
          <line x1={PAD-1} y1={PAD+8} x2={PAD-1} y2={SIZE-PAD-8} stroke="#00D4FF" strokeWidth="0.6" opacity="0.5" />
          <line x1={SIZE-PAD+1} y1={PAD+8} x2={SIZE-PAD+1} y2={SIZE-PAD-8} stroke="#00D4FF" strokeWidth="0.6" opacity="0.5" />
        </>
      )}
      {style === 'DataV_7' && (
        <>
          {/* 四角双层 L */}
          <polyline points={`${PAD-2},${PAD+4} ${PAD-2},${PAD-2} ${PAD+4},${PAD-2}`} fill="none" stroke="#00D4FF" strokeWidth="1.5" />
          <polyline points={`${PAD},${PAD+8} ${PAD},${PAD} ${PAD+8},${PAD}`} fill="none" stroke="#00D4FF" strokeWidth="2.5" opacity="0.6" />
          <polyline points={`${SIZE-PAD-4},${PAD-2} ${SIZE-PAD+2},${PAD-2} ${SIZE-PAD+2},${PAD+4}`} fill="none" stroke="#00D4FF" strokeWidth="1.5" />
          <polyline points={`${SIZE-PAD-8},${PAD} ${SIZE-PAD},${PAD} ${SIZE-PAD},${PAD+8}`} fill="none" stroke="#00D4FF" strokeWidth="2.5" opacity="0.6" />
        </>
      )}
      {style === 'DataV_8' && (
        <>
          {/* 跑马灯虚线框 */}
          <rect x={PAD-2} y={PAD-2} width={SIZE-PAD*2+4} height={SIZE-PAD*2+4} fill="none" stroke="#00D4FF" strokeWidth="0.8" />
          <rect x={PAD-2} y={PAD-2} width={SIZE-PAD*2+4} height={SIZE-PAD*2+4} fill="none" stroke="#00D4FF" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
        </>
      )}
      {style === 'DataV_9' && (
        <>
          {/* 渐变呼吸框 */}
          <rect x={PAD} y={PAD} width={SIZE-PAD*2} height={SIZE-PAD*2} rx="2" fill="none" stroke="#00D4FF" strokeWidth="1.5" />
          <rect x={PAD+4} y={PAD+4} width={SIZE-PAD*2-8} height={SIZE-PAD*2-8} rx="1" fill="none" stroke="#00D4FF" strokeWidth="0.5" opacity="0.4" />
        </>
      )}
      {style === 'DataV_10' && (
        <>
          {/* 四角三角 + 外框 */}
          <rect x={PAD} y={PAD} width={SIZE-PAD*2} height={SIZE-PAD*2} fill="none" stroke="#00D4FF" strokeWidth="0.8" />
          <polygon points={`${PAD+4},${PAD-2} ${PAD-2},${PAD-2} ${PAD-2},${PAD+4}`} fill="#00D4FF" opacity="0.5" />
          <polygon points={`${SIZE-PAD-4},${PAD-2} ${SIZE-PAD+2},${PAD-2} ${SIZE-PAD+2},${PAD+4}`} fill="#00D4FF" opacity="0.5" />
          <polygon points={`${PAD+4},${SIZE-PAD+2} ${PAD-2},${SIZE-PAD+2} ${PAD-2},${SIZE-PAD-4}`} fill="#00D4FF" opacity="0.5" />
          <polygon points={`${SIZE-PAD-4},${SIZE-PAD+2} ${SIZE-PAD+2},${SIZE-PAD+2} ${SIZE-PAD+2},${SIZE-PAD-4}`} fill="#00D4FF" opacity="0.5" />
        </>
      )}
      {style === 'DataV_11' && (
        <>
          {/* 标题凹槽 + 光点 */}
          <path d={`M${PAD+4},${PAD+6} L${SIZE/2-6},${PAD+6} L${SIZE/2-4},${PAD+10} L${SIZE/2+4},${PAD+10} L${SIZE/2+6},${PAD+6} L${SIZE-PAD-4},${PAD+6}`} fill="none" stroke="#00D4FF" strokeWidth="0.8" />
          <rect x={PAD+2} y={PAD+10} width={SIZE-PAD*2-4} height={SIZE-PAD*2-12} fill="none" stroke="#00D4FF" strokeWidth="0.5" opacity="0.5" />
          <circle cx={PAD+4} cy={PAD+4} r="1" fill="#00D4FF" />
          <circle cx={SIZE-PAD-4} cy={PAD+4} r="1" fill="#00D4FF" />
        </>
      )}
      {style === 'DataV_12' && (
        <>
          {/* 四角双层 L + 虚线 */}
          <path d={`M${PAD},${PAD+5} L${PAD},${PAD} L${PAD+5},${PAD}`} fill="none" stroke="#00D4FF" strokeWidth="1.5" />
          <path d={`M${PAD+2},${PAD+9} L${PAD+2},${PAD+2} L${PAD+9},${PAD+2}`} fill="none" stroke="#00D4FF" strokeWidth="0.8" opacity="0.4" />
          <path d={`M${SIZE-PAD-5},${PAD} L${SIZE-PAD},${PAD} L${SIZE-PAD},${PAD+5}`} fill="none" stroke="#00D4FF" strokeWidth="1.5" />
          <rect x={PAD+2} y={PAD+2} width={SIZE-PAD*2-4} height={SIZE-PAD*2-4} fill="none" stroke="#00D4FF" strokeWidth="0.4" strokeDasharray="3 2" opacity="0.4" />
        </>
      )}
      {style === 'DataV_13' && (
        <>
          {/* 虚线框 + 四角小 L */}
          <rect x={PAD+2} y={PAD+2} width={SIZE-PAD*2-4} height={SIZE-PAD*2-4} rx="1" fill="none" stroke="#00D4FF" strokeWidth="2" strokeDasharray="4 2" />
          <path d={`M${PAD-1},${PAD+6} L${PAD-1},${PAD-1} L${PAD+4},${PAD-3}`} fill="none" stroke="#00D4FF" strokeWidth="0.8" opacity="0.5" />
          <path d={`M${SIZE-PAD+1},${PAD+6} L${SIZE-PAD+1},${PAD-1} L${SIZE-PAD-4},${PAD-3}`} fill="none" stroke="#00D4FF" strokeWidth="0.8" opacity="0.5" />
        </>
      )}
      {style === 'custom' && (
        <>
          {/* 自定义图片图标 */}
          <rect x={PAD+2} y={PAD+6} width={SIZE-PAD*2-4} height={SIZE-PAD*2-12} rx="2" fill="none" stroke="#9E9EA8" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx={SIZE/2-4} cy={SIZE/2-2} r="4" fill="none" stroke="#9E9EA8" strokeWidth="1.5" />
          <path d={`M${SIZE/2-6},${SIZE/2} L${SIZE/2+6},${SIZE/2+4}`} stroke="#9E9EA8" strokeWidth="1.2" />
          <path d={`M${SIZE/2-3},${SIZE/2} L${SIZE/2+3},${SIZE/2+4}`} stroke="#9E9EA8" strokeWidth="1.2" />
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
