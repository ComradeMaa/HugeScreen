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
    '3row':          { cols: 1, rows: '1fr 1fr 1fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    '3col':          { cols: 3, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    '2x2':           { cols: 2, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }, { area: 'd', label: 'D' }] },
    '1top2bottom':   { cols: 2, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    '1left2right':   { cols: 2, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    'topNarrow':     { cols: 1, rows: '1fr 7fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
    'sandwich':      { cols: 1, rows: '1fr 6fr 1fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }] },
    'top4Bottom':    { cols: 4, rows: '1fr 7fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }, { area: 'd', label: 'D' }, { area: 'e', label: 'E' }] },
    'top6Bottom':    { cols: 6, rows: '1fr 7fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }, { area: 'c', label: 'C' }, { area: 'd', label: 'D' }, { area: 'e', label: 'E' }, { area: 'f', label: 'F' }, { area: 'g', label: 'G' }] },
    // 两列 1/3 变体：3 列网格，a 1 列 + b 2 列（左 1/3）/ a 2 列 + b 1 列（右 1/3）
    '2colLeftThird': { cols: 3, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
    '2colRightThird': { cols: 3, cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
    // 两行 1/3 变体：1 列，a 1fr + b 2fr（上 1/3）/ a 2fr + b 1fr（下 1/3）
    '2rowTopThird': { cols: 1, rows: '1fr 2fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
    '2rowBottomThird': { cols: 1, rows: '2fr 1fr', cells: [{ area: 'a', label: 'A' }, { area: 'b', label: 'B' }] },
  };

  const { cols, cells, rows } = areas[template];
  // 1top2bottom: first cell spans full width
  // 1left2right: first cell spans full height (2 rows)
  const is1t2b = template === '1top2bottom';
  const is1l2r = template === '1left2right';
  const isTopNarrow = template === 'topNarrow';
  const isTop4Bottom = template === 'top4Bottom';
  const isTop6Bottom = template === 'top6Bottom';
  const isLeftThird = template === '2colLeftThird';
  const isRightThird = template === '2colRightThird';

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
        if (isTop4Bottom && i === 4) colSpan = 4;
        if (isTop6Bottom && i === 6) colSpan = 6;
        if (isLeftThird && i === 0) colSpan = 1; // A 左 1/3
        if (isLeftThird && i === 1) colSpan = 2; // B 右 2/3
        if (isRightThird && i === 0) colSpan = 2; // A 左 2/3
        if (isRightThird && i === 1) colSpan = 1; // B 右 1/3

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
      <h3 className="text-sm font-semibold text-[#E8E8EC] mb-3 tracking-wide shrink-0">选择布局模板</h3>
      <div className="grid grid-cols-3 gap-3 px-6 mb-3 max-w-[360px] overflow-y-auto max-h-[360px]">
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
        className="px-4 py-1.5 rounded text-[12px] text-[#9E9EA8] border border-[rgba(255,255,255,0.06)] hover:text-[#f87171] hover:border-[rgba(248,113,113,0.3)] transition-colors shrink-0"
      >
        取消
      </button>
    </div>
  );
}
