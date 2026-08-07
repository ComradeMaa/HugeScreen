import { describe, it, expect } from 'vitest';
import { clampToGrid, resizeCellFromHandle } from '../resize';

const GRID = { cols: 8, rows: 7, gap: 8, snapToGrid: true };
const MIN = { colSpan: 1, rowSpan: 1 };
const MAX = { colSpan: 12, rowSpan: 12 }; // 模拟图表类 maxSize 超网格值 → 由网格 clamp

describe('clampToGrid', () => {
  it('网格内正常值保持不变', () => {
    expect(clampToGrid({ col: 2, row: 3, colSpan: 4, rowSpan: 2 }, GRID, MIN, MAX))
      .toEqual({ col: 2, row: 3, colSpan: 4, rowSpan: 2 });
  });

  it('span 超出网格右边界 → 收缩到网格剩余', () => {
    expect(clampToGrid({ col: 6, row: 1, colSpan: 5, rowSpan: 1 }, GRID, MIN, MAX))
      .toEqual({ col: 6, row: 1, colSpan: 2, rowSpan: 1 });
  });

  it('span 到下限仍超界 → 平移收进网格', () => {
    // min 2 宽，col 7 放不下 2 宽 → 平移到 col 6
    expect(clampToGrid({ col: 7, row: 1, colSpan: 2, rowSpan: 1 }, GRID, { colSpan: 2, rowSpan: 1 }, MAX))
      .toEqual({ col: 6, row: 1, colSpan: 2, rowSpan: 1 });
  });

  it('row 下限 rowMin=1 保护顶栏（row 0 不可占）', () => {
    expect(clampToGrid({ col: 0, row: 0, colSpan: 1, rowSpan: 2 }, GRID, MIN, MAX))
      .toEqual({ col: 0, row: 1, colSpan: 1, rowSpan: 2 });
  });

  it('col 下限 0：负 col 收进网格（防组件左半出屏）', () => {
    expect(clampToGrid({ col: -1, row: 1, colSpan: 2, rowSpan: 2 }, GRID, MIN, MAX))
      .toEqual({ col: 0, row: 1, colSpan: 2, rowSpan: 2 });
  });

  it('max 上限生效（注册 maxSize 3×3）', () => {
    expect(clampToGrid({ col: 0, row: 1, colSpan: 8, rowSpan: 4 }, GRID, MIN, { colSpan: 3, rowSpan: 3 }))
      .toEqual({ col: 0, row: 1, colSpan: 3, rowSpan: 3 });
  });

  it('min 下限生效', () => {
    expect(clampToGrid({ col: 0, row: 1, colSpan: 1, rowSpan: 1 }, GRID, { colSpan: 2, rowSpan: 2 }, MAX))
      .toEqual({ col: 0, row: 1, colSpan: 2, rowSpan: 2 });
  });
});

describe('resizeCellFromHandle', () => {
  const start = { col: 2, row: 2, colSpan: 3, rowSpan: 2 };

  it('e 手柄：右边界移动，锚左', () => {
    expect(resizeCellFromHandle(start, 'e', 2, 0, GRID, MIN, MAX)).toEqual({ col: 2, row: 2, colSpan: 5, rowSpan: 2 });
    expect(resizeCellFromHandle(start, 'e', -1, 0, GRID, MIN, MAX)).toEqual({ col: 2, row: 2, colSpan: 2, rowSpan: 2 });
  });

  it('w 手柄：左边界移动，锚右（col 变 span 反向）', () => {
    expect(resizeCellFromHandle(start, 'w', 1, 0, GRID, MIN, MAX)).toEqual({ col: 3, row: 2, colSpan: 2, rowSpan: 2 });
    expect(resizeCellFromHandle(start, 'w', -1, 0, GRID, MIN, MAX)).toEqual({ col: 1, row: 2, colSpan: 4, rowSpan: 2 });
  });

  it('s 手柄：下边界移动', () => {
    expect(resizeCellFromHandle(start, 's', 0, 2, GRID, MIN, MAX)).toEqual({ col: 2, row: 2, colSpan: 3, rowSpan: 4 });
  });

  it('n 手柄：上边界移动，锚下；rowMin 保护顶栏', () => {
    // row 2 → 1，rowSpan 3
    expect(resizeCellFromHandle(start, 'n', 0, -1, GRID, MIN, MAX)).toEqual({ col: 2, row: 1, colSpan: 3, rowSpan: 3 });
    // 再往上是 row 0（顶栏）→ 卡在 row 1，锚定的下边界不动 → span = 6-1 = 5
    expect(resizeCellFromHandle({ col: 2, row: 2, colSpan: 3, rowSpan: 4 }, 'n', 0, -3, GRID, MIN, MAX))
      .toEqual({ col: 2, row: 1, colSpan: 3, rowSpan: 5 });
  });

  it('se 手柄：双向拉伸', () => {
    expect(resizeCellFromHandle(start, 'se', 2, 3, GRID, MIN, MAX)).toEqual({ col: 2, row: 2, colSpan: 5, rowSpan: 5 });
  });

  it('拖出网格边界 → clamp 收缩', () => {
    // e 手柄 +6 格：col 2 + span 9 = 11 > 8 → 收缩到网格
    const r = resizeCellFromHandle({ col: 2, row: 2, colSpan: 3, rowSpan: 2 }, 'e', 6, 0, GRID, MIN, MAX);
    expect(r.col + r.colSpan).toBe(8);
    expect(r.colSpan).toBe(6);
  });

  it('收缩到 1×1 时贴边停（span 不小于 1）', () => {
    expect(resizeCellFromHandle(start, 'e', -5, 0, GRID, MIN, MAX)).toEqual({ col: 2, row: 2, colSpan: 1, rowSpan: 2 });
  });
});
