import { useEditorStore } from '../store/editorStore';
import { headerElementRegistry } from '@hugescreen/widgets';

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
                const label = key === 'text' ? '标题文字' : key === 'showSeconds' ? '显示秒' : key;
                const isBool = typeof defaultValue === 'boolean';

                return (
                  <label key={key} className="flex items-center justify-between">
                    <span className="text-[11px] text-textSecondary/70">{label}</span>
                    {isBool ? (
                      <input
                        type="checkbox"
                        checked={!!currentValue}
                        onChange={(e) =>
                          setHeaderSlot(headerSlot.id, headerSlot.elementType, {
                            ...headerSlot.options,
                            [key]: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(currentValue ?? '')}
                        onChange={(e) =>
                          setHeaderSlot(headerSlot.id, headerSlot.elementType, {
                            ...headerSlot.options,
                            [key]: e.target.value,
                          })
                        }
                        className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 w-32 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors text-right"
                      />
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
        <FieldGroup label="基本">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-textSecondary/70">组件名称</span>
            <input
              type="text"
              value={widget.displayName}
              onChange={(e) => updateWidget(widget.id, { displayName: e.target.value })}
              className="bg-surface-base border border-[rgba(255,255,255,0.06)] rounded px-2 py-1.5 text-xs text-text focus:outline-none focus:border-accent-cool/50 transition-colors"
            />
          </label>
        </FieldGroup>

        {/* ═══ 标题配置 ═══ */}
        <FieldGroup label="标题">
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
        </FieldGroup>

        <FieldGroup label="信息">
          <div className="text-xs text-textSecondary/60">
            <div className="flex justify-between py-1">
              <span>类型</span>
              <span className="font-mono">{widget.type}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>位置</span>
              <span className="font-mono">
                ({widget.layout.col}, {widget.layout.row})
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>尺寸</span>
              <span className="font-mono">
                {widget.layout.colSpan}×{widget.layout.rowSpan}
              </span>
            </div>
          </div>
        </FieldGroup>

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
