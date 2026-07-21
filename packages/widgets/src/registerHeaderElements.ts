import { headerElementRegistry } from './header-elements';
import { HeaderTitle } from './header-elements/HeaderTitle';
import { HeaderDateTime } from './header-elements/HeaderDateTime';
import { MiniGlobe } from './header-elements/MiniGlobe';
import { SpectrumBar } from './header-elements/SpectrumBar';
import { SignalTower } from './header-elements/PulseRing';
import { MiniWireSphere } from './header-elements/MiniWireSphere';

export function registerHeaderElements(): void {
  headerElementRegistry.register({
    type: 'header-title',
    name: '标题',
    icon: 'Type',
    defaultColSpan: 2,
    component: HeaderTitle,
    defaultConfig: {
      text: '数据监控中心',
      fontSize: '16px',
      fontWeight: '600',
      fontStyle: 'normal',
      color: '#ffffff',
      textAlign: 'left',
      borderStyle: 'none',
    },
  });

  headerElementRegistry.register({
    type: 'header-long-title',
    name: '长标题',
    icon: 'Type',
    defaultColSpan: 4,
    component: HeaderTitle,
    defaultConfig: {
      text: '实时数据监控中心 · 可视化分析平台',
      fontSize: '16px',
      fontWeight: '600',
      fontStyle: 'normal',
      color: '#ffffff',
      textAlign: 'left',
      borderStyle: 'none',
    },
  });

  headerElementRegistry.register({
    type: 'header-datetime',
    name: '日期时间',
    icon: 'Clock',
    defaultColSpan: 1,
    component: HeaderDateTime,
    defaultConfig: { showSeconds: true },
  });

  headerElementRegistry.register({
    type: 'mini-globe',
    name: '迷你地球',
    icon: 'Globe',
    defaultColSpan: 1,
    component: MiniGlobe,
    defaultConfig: {},
  });

  // ─── 装饰组件（纯视觉，无数据功能）───

  headerElementRegistry.register({
    type: 'spectrum-bar',
    name: '频谱跳动',
    icon: 'BarChart3',
    defaultColSpan: 1,
    component: SpectrumBar,
    defaultConfig: {},
  });

  headerElementRegistry.register({
    type: 'signal-tower',
    name: '信号塔',
    icon: 'LayoutDashboard',
    defaultColSpan: 1,
    component: SignalTower,
    defaultConfig: {},
  });

  headerElementRegistry.register({
    type: 'wire-sphere',
    name: '线框球',
    icon: 'Globe',
    defaultColSpan: 1,
    component: MiniWireSphere,
    defaultConfig: {},
  });

  console.log(
    `[HeaderElements] ${headerElementRegistry.getAll().length} header elements ready.`,
  );
}
