// ─── 顶栏配置 ───

export interface HeaderSlotConfig {
  id: string;
  colSpan: number; // 在顶栏中的列宽占比（总和 = grid.cols）
  elementType: string | null; // null = 空槽位
  options: Record<string, unknown>;
}

export interface HeaderConfig {
  slots: HeaderSlotConfig[];
  visible?: boolean;
  /** 顶栏占几行（高度可调；长度始终横跨全屏，colSpan 固定 = grid.cols） */
  rowSpan?: number;
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
  backgroundPattern?: string;
  backgroundEffect?: string;
  backgroundImage?: string;   // 自定义背景图片 URL
  backgroundVideo?: string;   // 自定义背景视频 URL
  customComponents?: CustomComponentDef[];
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

export type WidgetCategory = 'stat' | 'chart' | 'table' | '3d' | 'media' | 'decorator' | 'custom' | 'map';

export interface WidgetLayout {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

// ─── 组合图表 (Composite Chart) ───

export type CompositeLayoutTemplate =
  | '2col'          // 两等列
  | '2row'          // 两等行
  | '3col'          // 三等列
  | '2x2'           // 2×2 网格 (4 子图)
  | '1top2bottom'   // 上宽下两
  | '1left2right'   // 左宽右两叠
  | 'topNarrow'     // 上 1/8 窄条 + 下 7/8
  | 'sandwich'      // 上 1/8 窄条 + 中 6/8 + 下 1/8 窄条
  | 'top4Bottom'    // 上 1/8 四等分窄条 + 下 7/8
  | 'top6Bottom';   // 上 1/8 六等分窄条 + 下 7/8

export type CompositeSubChartType = string;

export interface CompositeSlotConfig {
  id: string;
  chartType: CompositeSubChartType;
  chartOptions: Record<string, unknown>;
  dataSource?: DataSourceConfig;
  /** 若 chartType 是自定义组合组件，构建时将其完整配置快照于此，此后源组件被删除也不影响本槽位渲染 */
  inlineComposite?: CompositeConfig;
}

export interface CompositeConfig {
  layoutTemplate: CompositeLayoutTemplate;
  slots: CompositeSlotConfig[];
}

/** 自定义组合组件定义 — 随 ScreenConfig 持久化，加载时重新注册到组件池 */
export interface CustomComponentDef {
  type: string;          // 唯一类型标识，形如 composite-xxxx
  displayName: string;   // 显示名，如「自定义组件 1」
  composite: CompositeConfig;
  defaultSize?: { colSpan: number; rowSpan: number };
}

// ─── 地图钉 (Map Pins) ───

export type MapPinIcon = string;

export interface MapPinType {
  id: string;
  name: string;            // 图例显示名，如"数据中心"
  icon: MapPinIcon;
  color?: string;          // 默认 #00D4FF
}

export interface MapPinInstance {
  id: string;
  pinTypeId: string;       // 引用 PinType.id
  lat: number;
  lng: number;
}

// ─── 数据源 ───

export interface DataSourceConfig {
  type: 'rest' | 'websocket' | 'static' | 'mqtt';
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
  body?: unknown;
  /** MQTT 订阅主题列表（type='mqtt' 时使用） */
  topics?: string[];
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
  /** 边框样式：none=无, style1/style2=科技感边框, DataV_1~13=DataV边框, custom=自定义图片 */
  borderStyle?: 'none' | 'style1' | 'style2' | 'DataV_1' | 'DataV_2' | 'DataV_3' | 'DataV_4' | 'DataV_5' | 'DataV_6' | 'DataV_7' | 'DataV_8' | 'DataV_9' | 'DataV_10' | 'DataV_11' | 'DataV_12' | 'DataV_13' | 'custom';
  /** 自定义边框图片 URL（borderStyle='custom' 时生效）。支持 png/jpg/svg */
  customBorderImage?: string;
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
