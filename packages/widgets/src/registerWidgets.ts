import { lazy } from 'react';
import { widgetRegistry } from '@hugescreen/core';

export function registerBuiltinWidgets(): void {
  widgetRegistry.registerAll([
    // ─── 统计卡 ───
    {
      type: 'stat-card',
      name: '统计卡',
      description: '关键指标数值及趋势',
      icon: 'TrendingUp',
      category: 'stat',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 1, rowSpan: 1 },
      maxSize: { colSpan: 4, rowSpan: 3 },
      component: lazy(() => import('./stat-card/StatCard').then(m => ({ default: m.StatCard }))),
      configSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', title: '标题' },
          value: { type: 'number', title: '数值' },
          format: { type: 'string', title: '格式', enum: ['number', 'currency', 'percent'] },
        },
      },
      defaultConfig: { title: '指标', value: 0, format: 'number', showTrend: false, trendMode: 'auto', trendLabel: '', showIcon: false },
    },

    // ─── HUD 环形仪表（暂时隐藏）───
    // {
    //   type: 'hud-gauge',
    //   name: 'HUD 仪表',
    //   description: '7 层同心 HUD 环形进度指示器',
    //   icon: 'Gauge',
    //   category: 'stat',
    //   defaultSize: { colSpan: 2, rowSpan: 2 },
    //   minSize: { colSpan: 1, rowSpan: 1 },
    //   maxSize: { colSpan: 3, rowSpan: 3 },
    //   component: lazy(() => import('./stat-card/HudGauge').then(m => ({ default: m.HudGauge }))),
    //   configSchema: { type: 'object', properties: { percent: { type: 'number', title: '百分比' }, label: { type: 'string', title: '副标题' } } },
    //   defaultConfig: { percent: 98, label: 'CHONGDIANJINXIN' },
    // },

    // ─── 折线图 ───
    {
      type: 'line-chart',
      name: '折线图',
      description: '数据趋势变化',
      icon: 'LineChart',
      category: 'chart',
      defaultSize: { colSpan: 4, rowSpan: 6 },
      minSize: { colSpan: 2, rowSpan: 2 },
      maxSize: { colSpan: 8, rowSpan: 6 },
      component: lazy(() => import('./charts/LineChartWidget').then(m => ({ default: m.LineChartWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          smooth: { type: 'boolean', title: '平滑曲线' },
          showArea: { type: 'boolean', title: '显示面积' },
          xLabels: { type: 'array', title: 'X轴标签' },
          lineSeries: { type: 'array', title: '数据系列' },
        },
      },
      defaultConfig: {
        smooth: true,
        showArea: true,
        xLabels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        lineSeries: [
          { name: '系列1', data: [120, 200, 150, 80, 70, 110, 130] },
        ],
      },
    },

    // ─── 柱状图（含条形图模式）───
    {
      type: 'bar-chart',
      name: '柱状图',
      description: '竖向柱状或横向条形',
      icon: 'BarChart3',
      category: 'chart',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 2, rowSpan: 1 },
      maxSize: { colSpan: 4, rowSpan: 3 },
      component: lazy(() => import('./charts/BarChartWidget').then(m => ({ default: m.BarChartWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', title: '呈现方式', enum: ['vertical', 'horizontal'] },
          showLabel: { type: 'boolean', title: '显示数值' },
          categories: { type: 'array', title: '数据类别' },
        },
      },
      defaultConfig: {
        direction: 'vertical',
        showLabel: false,
        labelFontSize: '10px', labelFontWeight: '600', labelColor: '#FF8C42', barWidth: '50%',
        categories: [
          { name: '类别A', value: 182 },
          { name: '类别B', value: 234 },
          { name: '类别C', value: 165 },
          { name: '类别D', value: 298 },
          { name: '类别E', value: 210 },
        ],
      },
    },

    // ─── 柱线组合图（双 Y 轴）───
    {
      type: 'bar-line-chart',
      name: '柱线组合图',
      description: '柱状 + 折线双 Y 轴',
      icon: 'BarChart3',
      category: 'chart',
      defaultSize: { colSpan: 4, rowSpan: 4 },
      minSize: { colSpan: 2, rowSpan: 2 },
      maxSize: { colSpan: 8, rowSpan: 6 },
      component: lazy(() => import('./charts/BarLineChartWidget').then(m => ({ default: m.BarLineChartWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          smooth: { type: 'boolean', title: '平滑曲线' },
          showArea: { type: 'boolean', title: '面积填充' },
          barWidth: { type: 'string', title: '柱宽' },
          showLabel: { type: 'boolean', title: '显示数值' },
          xLabels: { type: 'array', title: 'X轴标签' },
          mixedSeries: { type: 'array', title: '混合系列' },
        },
      },
      defaultConfig: {
        smooth: true,
        showArea: false,
        barWidth: '50%',
        showLabel: false,
        xLabels: ['2020', '2021', '2022', '2023', '2024', '2025'],
        mixedSeries: [
          { name: '带宽', unit: 'T', type: 'bar', data: [0.6, 1.1, 1.8, 2.4, 3.2, 3.9] },
          { name: '机柜数', unit: '个', type: 'line', data: [120, 230, 410, 620, 850, 1080] },
        ],
      },
    },

    // ─── 饼图 ───
    {
      type: 'pie-chart',
      name: '饼图',
      description: '占比分布环形图',
      icon: 'PieChart',
      category: 'chart',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 2, rowSpan: 2 },
      maxSize: { colSpan: 3, rowSpan: 3 },
      component: lazy(() => import('./charts/PieChartWidget').then(m => ({ default: m.PieChartWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          donut: { type: 'boolean', title: '环形' },
          showLegend: { type: 'boolean', title: '图例' },
          showColorLegend: { type: 'boolean', title: '颜色图例' },
          titleText: { type: 'string', title: '图名' },
          titlePosition: { type: 'string', title: '图名位置', enum: ['none', 'topLeft', 'bottom'] },
          categories: { type: 'array', title: '数据类别' },
        },
      },
      defaultConfig: {
        donut: true,
        showLegend: false,
        showColorLegend: true,
        titleText: '',
        titlePosition: 'none',
        categories: [
          { name: '类别A', value: 335 },
          { name: '类别B', value: 310 },
          { name: '类别C', value: 234 },
          { name: '类别D', value: 135 },
          { name: '类别E', value: 548 },
        ],
      },
    },

    // ─── 图片 ───
    {
      type: 'image-widget',
      name: '图片',
      description: '图片展示',
      icon: 'Image',
      category: 'decorator',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 1, rowSpan: 1 },
      maxSize: { colSpan: 6, rowSpan: 6 },
      component: lazy(() => import('./decorators/ImageWidget').then(m => ({ default: m.ImageWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          src: { type: 'string', title: '图片数据' },
          opacity: { type: 'number', title: '透明度' },
          fit: { type: 'string', title: '填充方式', enum: ['contain', 'cover', 'fill'] },
        },
      },
      defaultConfig: {
        src: '',
        opacity: 1,
        fit: 'contain',
      },
    },

    // ─── 文本 ───
    {
      type: 'text-widget',
      name: '文本',
      description: '自定义文字显示',
      icon: 'Type',
      category: 'decorator',
      defaultSize: { colSpan: 2, rowSpan: 1 },
      minSize: { colSpan: 1, rowSpan: 1 },
      maxSize: { colSpan: 6, rowSpan: 3 },
      component: lazy(() => import('./decorators/TextWidget').then(m => ({ default: m.TextWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', title: '文字内容' },
          fontSize: { type: 'string', title: '字号' },
          fontWeight: { type: 'string', title: '字重' },
          fontStyle: { type: 'string', title: '斜体' },
          color: { type: 'string', title: '颜色' },
          textAlign: { type: 'string', title: '对齐' },
        },
      },
      defaultConfig: {
        text: '输入文字',
        fontSize: '16px',
        fontWeight: '400',
        fontStyle: 'normal',
        color: '#E8E8EC',
        textAlign: 'center',
      },
    },

    // ─── 赛博地图 ───
    {
      type: 'cyber-map',
      name: '赛博地图',
      description: '3D 赛博风格行政区划地图，支持地图钉配置',
      icon: 'Map',
      category: '3d',
      defaultSize: { colSpan: 6, rowSpan: 6 },
      minSize: { colSpan: 3, rowSpan: 3 },
      maxSize: { colSpan: 12, rowSpan: 12 },
      component: lazy(() => import('./geo/CyberMapWidget').then(m => ({ default: m.CyberMapWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          thickness: { type: 'number', title: '厚度' },
          showGrid: { type: 'boolean', title: '显示网格' },
        },
      },
      defaultConfig: {
        thickness: 3,
        showGrid: true,
        pinTypes: [],
        pinInstances: [],
      },
    },

    // ─── 赛博数据城市 ───
    {
      type: 'cyber-city',
      name: '赛博城市',
      description: '3D 赛博风格建筑群，基于 OSM 数据渲染线框城市',
      icon: 'Building2',
      category: '3d',
      defaultSize: { colSpan: 6, rowSpan: 6 },
      minSize: { colSpan: 3, rowSpan: 3 },
      maxSize: { colSpan: 12, rowSpan: 12 },
      component: lazy(() => import('./three-d/CyberCityWidget').then(m => ({ default: m.CyberCityWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          heightScale: { type: 'number', title: '高度倍率' },
          showGrid: { type: 'boolean', title: '显示网格' },
        },
      },
      defaultConfig: {
        heightScale: 1,
        showGrid: true,
      },
    },

    {
      type: 'video-widget',
      name: '视频',
      description: '本地视频或直播流播放',
      icon: 'Video',
      category: 'media',
      defaultSize: { colSpan: 3, rowSpan: 3 },
      minSize: { colSpan: 2, rowSpan: 2 },
      maxSize: { colSpan: 6, rowSpan: 6 },
      component: lazy(() => import('./decorators/VideoWidget').then(m => ({ default: m.VideoWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          videos: { type: 'array', title: '视频列表' },
          fit: { type: 'string', title: '填充方式', enum: ['contain', 'cover', 'fill'] },
          muted: { type: 'boolean', title: '静音' },
          autoplay: { type: 'boolean', title: '自动播放' },
          loop: { type: 'boolean', title: '循环播放' },
          controls: { type: 'boolean', title: '播放控件' },
          preload: { type: 'string', title: '预加载', enum: ['metadata', 'auto', 'none'] },
        },
      },
      defaultConfig: {
        videos: [],
        fit: 'contain',
        muted: true,
        autoplay: true,
        loop: true,
        controls: false,
        preload: 'metadata',
      },
    },

    {
      type: 'box-plot',
      name: '箱线图',
      description: '数据分布盒须图，展示最小值/Q1/中位数/Q3/最大值',
      icon: 'BarChart4',
      category: 'chart',
      defaultSize: { colSpan: 4, rowSpan: 3 },
      minSize: { colSpan: 3, rowSpan: 2 },
      maxSize: { colSpan: 8, rowSpan: 5 },
      component: lazy(() => import('./charts/BoxPlotWidget').then(m => ({ default: m.BoxPlotWidget }))),
      configSchema: {
        type: 'object',
        properties: {
          boxColor: { type: 'string', title: '盒子颜色' },
          boxWidth: { type: 'number', title: '盒子宽度' },
          categories: { type: 'array', title: '数据' },
        },
      },
      defaultConfig: {
        boxColor: '#00D4FF',
        boxWidth: 20,
        categories: [
          { name: 'A组', min: 10, q1: 30, median: 45, q3: 60, max: 85 },
          { name: 'B组', min: 15, q1: 35, median: 50, q3: 65, max: 90 },
          { name: 'C组', min: 20, q1: 40, median: 55, q3: 70, max: 95 },
          { name: 'D组', min: 12, q1: 32, median: 48, q3: 62, max: 88 },
          { name: 'E组', min: 8,  q1: 28, median: 42, q3: 58, max: 80 },
        ],
      },
    },

    {
      type: 'water-pond',
      name: '水位球',
      description: '波浪水位动画',
      icon: 'Droplets',
      category: 'chart',
      defaultSize: { colSpan: 2, rowSpan: 2 },
      minSize: { colSpan: 1, rowSpan: 1 },
      maxSize: { colSpan: 4, rowSpan: 4 },
      component: lazy(() => import('./charts/WaterLevelPond').then(m => ({ default: m.WaterLevelPond }))),
      configSchema: {
        type: 'object',
        properties: {
          value: { type: 'number', title: '水位百分比' },
          title: { type: 'string', title: '标题' },
          suffix: { type: 'string', title: '后缀' },
          shape: { type: 'string', title: '形状', enum: ['rect', 'roundRect', 'round'] },
          waveHeight: { type: 'number', title: '波浪高度' },
          waveNum: { type: 'number', title: '波浪层数' },
        },
      },
      defaultConfig: {
        value: 60,
        title: '',
        titleColor: '#E8E8EC',
        titleFontSize: 14,
        suffix: '%',
        shape: 'round',
        waveHeight: 30,
        waveNum: 3,
      },
    },

  ]);

  console.log(
    `[Widgets] ${widgetRegistry.getAll().length} widgets ready:`,
    widgetRegistry.getAll().map(w => w.type).join(', '),
  );
}
