// ─── 顶栏配置 ───

export interface HeaderSlotConfig {
  id: string;
  colSpan: number; // 在顶栏中的列宽占比（总和 = grid.cols）
  elementType: string | null; // null = 空槽位
  options: Record<string, unknown>;
}

export interface HeaderConfig {
  slots: HeaderSlotConfig[];
}

// ─── 大屏完整配置 ───

export interface ScreenConfig {
  id: string;
  name: string;
  version: '1.0';
  canvas: CanvasConfig;
  grid: GridConfig;
  header: HeaderConfig;
  responsive: ResponsiveConfig;
  widgets: WidgetConfig[];
  theme: ThemeConfig;
}

export interface CanvasConfig {
  width: number;
  height: number;
  scaleMode: 'auto' | 'width' | 'height' | 'none';
  backgroundColor: string;
}

export interface GridConfig {
  cols: number;
  rows: number;
  gap: number;
  snapToGrid: boolean;
}

// ─── 响应式 ───

export interface ResponsiveConfig {
  desktop: LayoutBreakpoint;
  tablet: LayoutBreakpoint;
  mobile: LayoutBreakpoint;
}

export interface LayoutBreakpoint {
  grid: { cols: number; rows: number; gap: number };
  widgetLayouts: Record<string, WidgetLayout>;
  hiddenWidgets: string[];
}

// ─── 组件配置 ───

export interface WidgetConfig {
  id: string;
  type: string;
  displayName: string;
  category: WidgetCategory;
  layout: WidgetLayout;
  dataSource: DataSourceConfig;
  options: Record<string, unknown>;
  animation: WidgetAnimation;
  style: WidgetStyle;
}

export type WidgetCategory = 'stat' | 'chart' | 'table' | '3d' | 'media' | 'decorator';

export interface WidgetLayout {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

// ─── 数据源 ───

export interface DataSourceConfig {
  type: 'rest' | 'websocket' | 'static';
  config: DataSourceOptions;
  staticData?: unknown;
  mapping: Record<string, string>;
  transform?: TransformStep[];
}

export interface DataSourceOptions {
  url?: string;
  method?: 'GET' | 'POST';
  interval?: number;
  throttle?: number;
  headers?: Record<string, string>;
  jsonPath?: string;
  reconnectInterval?: number;
}

export interface TransformStep {
  type: 'filter' | 'map' | 'sort' | 'aggregate';
  config: Record<string, unknown>;
}

// ─── 动效 ───

export interface WidgetAnimation {
  enabled: boolean;
  enter?: 'fadeIn' | 'slideUp' | 'none';
  loop?: 'subtle-pulse' | 'slow-breathe' | 'none';
  dataUpdate?: 'numberScroll' | 'morph' | 'none';
  particle?: ParticleConfig;
}

export interface ParticleConfig {
  enabled: boolean;
  type: 'dataFlow' | 'ambientDots' | 'none';
  density: 'low' | 'medium' | 'high';
}

// ─── 样式 ───

export interface WidgetStyle {
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  backgroundColor?: string;
  opacity?: number;
  title?: WidgetTitleConfig;
  /** 边框样式：none=无, style1=样式1, style2=样式2 */
  borderStyle?: 'none' | 'style1' | 'style2';
}

/** 一级/二级标题配置。存在即显示，不存在即不占空间 */
export interface WidgetTitleConfig {
  primary?: { text: string };
  secondary?: { text: string };
}

// ─── 主题 ───

export interface ThemeConfig {
  name: 'dark-premium' | 'dark-gold' | 'custom';
  colors: ThemeColors;
  font: ThemeFont;
}

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  primary: string;
  accent: string;
  text: string;
  textSecondary: string;
  dataHighlight: string;
  border: string;
  positive: string;
  negative: string;
}

export interface ThemeFont {
  family: string;
  dataFont: string;
}

// ─── 默认主题 ───

export const DEFAULT_THEME: ThemeConfig = {
  name: 'dark-premium',
  colors: {
    background: '#2C2C34',
    surface: '#2C2C34',
    surfaceHover: '#363640',
    primary: '#00D4FF',
    accent: '#FF8C42',
    text: '#E8E8EC',
    textSecondary: '#9E9EA8',
    dataHighlight: '#ffffff',
    border: 'rgba(255,255,255,0.06)',
    positive: '#34d399',
    negative: '#f87171',
  },
  font: {
    family: 'Inter, PingFang SC, sans-serif',
    dataFont: 'JetBrains Mono, monospace',
  },
};

// ─── 默认网格 ───

export const DEFAULT_GRID: GridConfig = {
  cols: 6,
  rows: 6,
  gap: 10,
  snapToGrid: true,
};

// ─── 默认画布 ───

export const DEFAULT_CANVAS: CanvasConfig = {
  width: 1920,
  height: 1080,
  scaleMode: 'auto',
  backgroundColor: '#2C2C34',
};
