import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { headerElementRegistry } from '@hugescreen/widgets';
import type { WidgetStyle } from '@hugescreen/shared';
import { ChevronDown, Ban } from 'lucide-react';

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
};

/**
 * 属性配置面板
 * 选中普通组件 → 显示组件属性
 * 选中顶栏槽位 → 显示顶栏元素属性
 */
export function PropertyInspector() {
  const {
    config, selectedWidgetId, selectedHeaderSlotId,
    updateWidget, setHeaderSlot,
  } = useEditorStore();

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
          <CollapsibleFieldGroup label="数据" defaultOpen={false}>
            <BarCategoriesEditor
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
        )}

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
interface BarCategory { name: string; value: number; }

function BarCategoriesEditor({ categories, onChange }: { categories: BarCategory[]; onChange: (cats: BarCategory[]) => void }) {
  const updateCat = (i: number, patch: Partial<BarCategory>) => {
    const next = categories.map((c, j) => (j === i ? { ...c, ...patch } : c));
    onChange(next);
  };
  const removeCat = (i: number) => {
    if (categories.length <= 1) return;
    onChange(categories.filter((_, j) => j !== i));
  };
  const addCat = () => {
    onChange([...categories, { name: `类别${categories.length + 1}`, value: 100 }]);
  };

  return (
    <div className="space-y-1.5">
      {categories.map((cat, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="text"
            value={cat.name}
            onChange={(e) => updateCat(i, { name: e.target.value })}
            className="flex-1 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors"
            placeholder="名称"
          />
          <input
            type="number"
            value={cat.value}
            onChange={(e) => updateCat(i, { value: Number(e.target.value) || 0 })}
            className="w-16 bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-accent-cool/50 transition-colors text-right"
            placeholder="值"
          />
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

function LabelSelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-[11px] text-textSecondary/70">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-1 w-24 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors text-right appearance-none cursor-pointer">
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
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

/** 边框样式选择器 — 小方格概览图 */
const BORDER_STYLES: { value: WidgetStyle['borderStyle']; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'style1', label: '样式1' },
  { value: 'style2', label: '样式2' },
];

function BorderStylePicker({ value, onChange }: { value: WidgetStyle['borderStyle']; onChange: (v: WidgetStyle['borderStyle']) => void }) {
  return (
    <div className="flex gap-2 px-1">
      {BORDER_STYLES.map((s) => {
        const active = (value ?? 'none') === s.value;
        const isNone = s.value === 'none';
        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            title={s.label}
            className={`relative w-12 h-10 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
              active
                ? 'border-accent-cool bg-accent-cool/10 ring-1 ring-accent-cool/40'
                : 'border-[rgba(255,255,255,0.08)] bg-surface-base/50 hover:border-[rgba(255,255,255,0.15)]'
            }`}
          >
            {isNone ? (
              <Ban size={18} strokeWidth={1.5} className="text-textSecondary/40" />
            ) : (
              <span className="text-[9px] text-textSecondary/30">{s.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
