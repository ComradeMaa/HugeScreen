import type { CompositeLayoutTemplate } from '@hugescreen/shared';
import { TEMPLATE_LABELS, LAYOUT_TEMPLATES, TEMPLATE_SLOT_COUNTS } from './types';

interface TemplatePickerProps {
  onSelect: (template: CompositeLayoutTemplate) => void;
  onCancel: () => void;
}

/** Thumbnail grid preview for each template using CSS Grid */
function TemplateThumbnail({ template }: { template: CompositeLayoutTemplate }) {
  // Map template to a small grid visualization
  const areas: Record<CompositeLayoutTemplate, { cols: number; cells: { area: string; label: string }[]; rows?: string }> = {
    '2col':          { cols: 2, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
    '2row':          { cols: 1, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
    '3col':          { cols: 3, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    '2x2':           { cols: 2, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }, { area: 'd', label: 'D' }] },
    '1top2bottom':   { cols: 2, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    '1left2right':   { cols: 2, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    'topNarrow':     { cols: 1, rows: '1fr 7fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
  };

  const { cols, cells, rows } = areas[template];
  // 1top2bottom: first cell spans full width
  // 1left2right: first cell spans full height (2 rows)
  const is1t2b = template === '1top2bottom';
  const is1l2r = template === '1left2right';
  const isTopNarrow = template === 'topNarrow';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: rows ?? (is1l2r ? '1fr 1fr' : '1fr 1fr'),
        gap: '2px',
        width: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      {cells.map((cell, i) => {
        let colSpan = 1;
        let rowSpan = 1;
        if (is1t2b && i === 0) colSpan = 2;
        if (is1l2r && i === 0) rowSpan = 2;

        return (
          <div
            key={cell.label}
            style={{
              gridColumn: `span ${colSpan}`,
              gridRow: `span ${rowSpan}`,
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'rgba(0,212,255,0.6)',
            }}
          >
            {cell.label}
          </div>
        );
      })}
    </div>
  );
}

export function TemplatePicker({ onSelect, onCancel }: TemplatePickerProps) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[rgba(44,44,52,0.92)] backdrop-blur-sm rounded-lg">
      <h3 className="text-sm font-semibold text-[#E8E8EC] mb-4 tracking-wide">选择布局模板</h3>
      <div className="grid grid-cols-3 gap-3 px-6 mb-5 max-w-[360px]">
        {LAYOUT_TEMPLATES.map(tpl => (
          <button
            key={tpl}
            onClick={() => onSelect(tpl)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-[rgba(255,255,255,0.06)] hover:border-[rgba(0,212,255,0.4)] hover:bg-[rgba(0,212,255,0.06)] transition-colors"
          >
            <TemplateThumbnail template={tpl} />
            <span className="text-[11px] text-[#9E9EA8]">{TEMPLATE_LABELS[tpl]}</span>
            <span className="text-[10px] text-[#9E9EA8]/50">{TEMPLATE_SLOT_COUNTS[tpl]} 槽位</span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="px-4 py-1.5 rounded text-[12px] text-[#9E9EA8] border border-[rgba(255,255,255,0.06)] hover:text-[#f87171] hover:border-[rgba(248,113,113,0.3)] transition-colors"
      >
        取消
      </button>
    </div>
  );
}
