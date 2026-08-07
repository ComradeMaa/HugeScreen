/**
 * 拖拽跨组件状态（模块级，避免循环依赖）。
 * dragover 阶段无法读取 dataTransfer.getData（Chrome 安全限制），
 * 面板拖拽的组件类型需在 dragstart 时暂存于此，drop 后再读 dataTransfer 兜底。
 */
export let dragPaletteType: string | null = null;

export function setDragPaletteType(t: string | null): void {
  dragPaletteType = t;
}
