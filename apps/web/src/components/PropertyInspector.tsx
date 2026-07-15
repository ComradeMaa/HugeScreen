import { useEditorStore } from '../store/editorStore';

/**
 * 属性配置面板
 * 选中组件时显示其可编辑属性：名称、数据源、样式、动效等。
 * 基于组件的 JSON Schema 动态生成表单，当前为占位实现。
 */
export function PropertyInspector() {
  const { config, selectedWidgetId, updateWidget } = useEditorStore();

  const widget = config.widgets.find((w) => w.id === selectedWidgetId);

  if (!widget) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-4">
          属性
        </h2>
        <p className="text-xs text-textSecondary opacity-60 text-center py-8">
          选择一个组件以编辑其属性
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
        {/* 组件名称 */}
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

        {/* 组件类型 */}
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

        {/* 动效 */}
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
